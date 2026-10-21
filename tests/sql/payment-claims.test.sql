-- Payment claims: constraints, RLS, and the license write gate exemption.
-- Runs against the fully migrated scratch database (tests/sql/run.sh).
\set ON_ERROR_STOP on
create or replace function pg_temp.assert(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', msg; end if;
end $$;
create or replace function pg_temp.fails(stmt text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  return true;
end $$;

begin;
-- Fixtures, inserted as the table owner (RLS does not apply).
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000f0d1'), -- parent
  ('00000000-0000-0000-0000-00000000f0d2'), -- other parent
  ('00000000-0000-0000-0000-00000000f0d3'), -- student
  ('00000000-0000-0000-0000-00000000f0d4'), -- admin
  ('00000000-0000-0000-0000-00000000f0d5'); -- unrelated student
insert into profiles (id, role, full_name, is_active) values
  ('00000000-0000-0000-0000-00000000f0d1', 'parent', 'Parent One', true),
  ('00000000-0000-0000-0000-00000000f0d2', 'parent', 'Parent Two', true),
  ('00000000-0000-0000-0000-00000000f0d3', 'student', 'Student One', true),
  ('00000000-0000-0000-0000-00000000f0d4', 'admin', 'Admin', true),
  ('00000000-0000-0000-0000-00000000f0d5', 'student', 'Student Two', true);
insert into student_profiles (id) values
  ('00000000-0000-0000-0000-00000000f0d3'),
  ('00000000-0000-0000-0000-00000000f0d5');
insert into guardian_links (parent_id, student_id) values
  ('00000000-0000-0000-0000-00000000f0d1', '00000000-0000-0000-0000-00000000f0d3');
insert into fee_structures (id, education_level, level_number, term, academic_year, title, amount_kobo)
values ('00000000-0000-0000-0000-00000000f0f2', 'primary', 1, 1, '2026/2027', 'Tuition', 5000000);
insert into invoices (id, student_id, fee_structure_id, term, academic_year, total_amount_kobo, status) values
  ('00000000-0000-0000-0000-00000000f0e1', '00000000-0000-0000-0000-00000000f0d3', '00000000-0000-0000-0000-00000000f0f2', 1, '2026/2027', 5000000, 'unpaid');

insert into payment_claims (id, invoice_id, student_id, claimed_by, amount_kobo, sent_on, sender_name, reference)
values ('00000000-0000-0000-0000-00000000f0f1', '00000000-0000-0000-0000-00000000f0e1',
        '00000000-0000-0000-0000-00000000f0d3', '00000000-0000-0000-0000-00000000f0d1',
        2500000, current_date, 'Parent One', 'INV-00000000');

-- One open claim per invoice.
select pg_temp.assert(pg_temp.fails($q$
  insert into payment_claims (invoice_id, student_id, claimed_by, amount_kobo, sent_on, sender_name, reference)
  values ('00000000-0000-0000-0000-00000000f0e1', '00000000-0000-0000-0000-00000000f0d3',
          '00000000-0000-0000-0000-00000000f0d1', 100, current_date, 'x', 'INV-00000000')
$q$), 'second pending claim on the same invoice is refused');

-- Rejecting needs a reason; confirming needs a payment.
select pg_temp.assert(pg_temp.fails($q$
  update payment_claims set status = 'rejected', decided_at = now()
  where id = '00000000-0000-0000-0000-00000000f0f1'
$q$), 'rejection without a reason is refused');
select pg_temp.assert(pg_temp.fails($q$
  update payment_claims set status = 'confirmed', decided_at = now()
  where id = '00000000-0000-0000-0000-00000000f0f1'
$q$), 'confirmation without a payment is refused');
select pg_temp.assert(pg_temp.fails($q$
  update payment_claims set amount_kobo = 0 where id = '00000000-0000-0000-0000-00000000f0f1'
$q$), 'zero amount is refused');

-- A rejected claim is kept and frees the invoice for a new claim.
update payment_claims set status = 'rejected', decided_at = now(), reject_reason = 'No matching credit'
  where id = '00000000-0000-0000-0000-00000000f0f1';
insert into payment_claims (invoice_id, student_id, claimed_by, amount_kobo, sent_on, sender_name, reference)
values ('00000000-0000-0000-0000-00000000f0e1', '00000000-0000-0000-0000-00000000f0d3',
        '00000000-0000-0000-0000-00000000f0d1', 2500000, current_date, 'Parent One', 'INV-00000000');

-- RLS: who can read.
create or replace function pg_temp.visible_as(uid text) returns integer language plpgsql as $$
declare n integer;
begin
  perform set_config('test.uid', uid, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into n from payment_claims;
  perform set_config('role', 'postgres', true);
  return n;
end $$;
select pg_temp.assert(pg_temp.visible_as('00000000-0000-0000-0000-00000000f0d1') = 2, 'payer sees own claims');
select pg_temp.assert(pg_temp.visible_as('00000000-0000-0000-0000-00000000f0d3') = 2, 'student sees claims for them');
select pg_temp.assert(pg_temp.visible_as('00000000-0000-0000-0000-00000000f0d4') = 2, 'admin sees all claims');
select pg_temp.assert(pg_temp.visible_as('00000000-0000-0000-0000-00000000f0d2') = 0, 'unlinked parent sees none');
select pg_temp.assert(pg_temp.visible_as('00000000-0000-0000-0000-00000000f0d5') = 0, 'unrelated student sees none');

-- Signed-in users cannot write at all.
select set_config('test.uid', '00000000-0000-0000-0000-00000000f0d1', true);
set local role authenticated;
select pg_temp.assert(pg_temp.fails($q$
  update payment_claims set status = 'pending'
$q$), 'authenticated cannot update claims');
select pg_temp.assert(pg_temp.fails($q$
  insert into payment_claims (invoice_id, student_id, claimed_by, amount_kobo, sent_on, sender_name, reference)
  values ('00000000-0000-0000-0000-00000000f0e1', '00000000-0000-0000-0000-00000000f0d3',
          '00000000-0000-0000-0000-00000000f0d1', 100, current_date, 'x', 'INV-00000000')
$q$), 'authenticated cannot insert claims');
reset role;

-- The write gate leaves payment_claims alone and still covers other tables.
select apply_license_write_gate();
select pg_temp.assert(not exists (
  select 1 from pg_policies where tablename = 'payment_claims' and policyname like 'license_gate_%'
), 'payment_claims has no license gate policies');
select pg_temp.assert(exists (
  select 1 from pg_policies where tablename = 'announcements' and policyname = 'license_gate_insert'
), 'other tables are still gated');

rollback;
\echo ALL PAYMENT CLAIMS SQL TESTS PASSED
