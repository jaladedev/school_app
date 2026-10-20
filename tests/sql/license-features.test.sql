-- Behavioural tests for the add-on gates and RPC guards, run against the
-- REAL schema (all repo migrations replayed; see tests/sql/run.sh).

create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
grant execute on function pg_temp.assert(boolean, text) to public;

-- Supabase grants these by default privileges; the scratch database has none.
grant select, insert, update, delete on all tables in schema public to authenticated;

truncate school_license;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local') on conflict do nothing;
insert into profiles (id, role, full_name) values ('00000000-0000-0000-0000-0000000000a1', 'admin', 'Test Admin')
  on conflict (id) do update set role = 'admin', is_active = true;

-- A. Structure
select pg_temp.assert((select count(distinct tablename) from pg_policies where policyname = 'license_feature_insert') = 21,
  'all 21 add-on tables have a feature gate');
select pg_temp.assert((select count(*) from pg_policies where policyname like 'license_feature_%') = 63, 'three policies per add-on table');
select pg_temp.assert(not exists (
  select 1 from (values ('answer_quiz_question'),('grade_quiz_essay_answers'),('start_quiz_attempt'),('submit_quiz_attempt'),
    ('send_fee_reminders'),('assign_student_to_route'),('assign_student_to_hostel_room'),('join_hostel_waitlist'),
    ('borrow_library_book'),('return_library_book')) as t(n)
  join pg_proc p on p.proname = t.n and p.pronamespace = 'public'::regnamespace and p.prosecdef
  where pg_get_functiondef(p.oid) not like '%license_require(%'),
  'every writing SECURITY DEFINER function is guarded');
select pg_temp.assert(
  (select count(*) from pg_proc where proname in ('record_invoice_payment','replace_invoice_installments')
     and pronamespace = 'public'::regnamespace and pg_get_functiondef(oid) like '%license_require(%') = 0,
  'fee payment functions are NOT guarded');

-- B. Idempotent
select pg_temp.assert(apply_license_rpc_guards() = 0, 'second guard run changes nothing');
select pg_temp.assert(apply_license_feature_gate() = 21, 'feature gate reapplies cleanly');

-- C. License with only the library add-on
select set_license('11111111-1111-1111-1111-111111111111', 1, '2026/2027',
  now() + interval '30 days', now() + interval '51 days', 300, array['library']);

set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.assert((select features from license_info()) = array['library'], 'license_info returns features');

insert into library_books (title) values ('Allowed: library is on');

do $$ begin insert into hostels (name, gender) values ('Blocked', 'male');
  raise exception 'ASSERT FAILED: hostel insert allowed without the hostel add-on';
exception when insufficient_privilege then null; end $$;
do $$ begin insert into messages (content) values ('Blocked');
  raise exception 'ASSERT FAILED: message insert allowed without the messaging add-on';
exception when insufficient_privilege or not_null_violation or check_violation then null; end $$;
do $$ begin insert into assets (name) values ('Blocked');
  raise exception 'ASSERT FAILED: asset insert allowed without the inventory add-on';
exception when insufficient_privilege then null; end $$;

-- RPC guards: feature off
do $$ begin perform join_hostel_waitlist(gen_random_uuid(), gen_random_uuid());
  raise exception 'ASSERT FAILED: waitlist RPC ran without the hostel add-on';
exception when insufficient_privilege then
  if sqlerrm not like '%hostel feature%' then raise; end if; end $$;
-- RPC guard: feature on -> passes the guard, fails later on its own checks
do $$ begin perform borrow_library_book(gen_random_uuid(), gen_random_uuid(), current_date - 1);
  raise exception 'ASSERT FAILED: expected the loan to be rejected on its own checks';
exception when others then
  if sqlerrm like '%feature%' or sqlerrm like '%lapsed%' then raise exception 'ASSERT FAILED: guard fired with feature on: %', sqlerrm; end if;
  if sqlerrm like 'ASSERT FAILED%' then raise; end if; end $$;
reset role;

-- D. Expired: everything non-exempt is blocked, including quiz RPCs
select set_license('11111111-1111-1111-1111-111111111111', 2, '2026/2027',
  now() - interval '30 days', now() - interval '1 day', 300, array['library','hostel']);
set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.assert((select status from license_info()) = 'expired', 'expired');
do $$ begin insert into library_books (title) values ('Blocked: expired');
  raise exception 'ASSERT FAILED: library insert allowed when expired';
exception when insufficient_privilege then null; end $$;
do $$ begin perform start_quiz_attempt(gen_random_uuid());
  raise exception 'ASSERT FAILED: quiz attempt started when expired';
exception when insufficient_privilege then
  if sqlerrm not like '%lapsed%' then raise; end if; end $$;
do $$ begin perform borrow_library_book(gen_random_uuid(), gen_random_uuid(), current_date + 5);
  raise exception 'ASSERT FAILED: loan issued when expired';
exception when insufficient_privilege then null; end $$;
reset role;

-- E. No license row: everything allowed (legacy / development)
truncate school_license;
set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000a1';
insert into hostels (name, gender) values ('Allowed: no license row', 'male');
select pg_temp.assert((select features from license_info()) is null, 'no row -> features NULL');
reset role;

\echo ALL LICENSE FEATURE SQL TESTS PASSED
