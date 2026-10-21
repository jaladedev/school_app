-- Manual bank transfer with "I've sent it" (plan section 5.7, part A).
--
-- A claim never pays anything by itself: it only records that a payer says they
-- sent a transfer. A bursar or admin confirms it after checking the bank
-- statement, which records the payment through the existing
-- record_invoice_payment() function (method bank_transfer). Nothing here changes
-- how invoices or payments are written.
--
-- Writes to payment_claims come only from server actions using the service role.
-- Signed-in users get SELECT through RLS and nothing else.

-- ----------------------------------------------------------------------------
-- 1. School settings: bank details, which methods to show, Telegram chat
-- ----------------------------------------------------------------------------

alter table school_settings
  add column if not exists payment_methods text not null default 'both',
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_account_number text,
  add column if not exists payment_notify_chat_id text;

alter table school_settings
  drop constraint if exists school_settings_payment_methods_check;
alter table school_settings
  add constraint school_settings_payment_methods_check
  check (payment_methods in ('paystack', 'transfer', 'both'));

-- ----------------------------------------------------------------------------
-- 2. Claims
-- ----------------------------------------------------------------------------

create table if not exists payment_claims (
  id uuid not null default gen_random_uuid(),
  invoice_id uuid not null,
  student_id uuid not null,
  claimed_by uuid not null,
  amount_kobo bigint not null,
  sent_on date not null,
  sender_name text not null,
  -- The code the payer puts in the transfer narration (INV-XXXXXXXX), derived
  -- from the invoice id, so a bursar can match it against the statement.
  reference text not null,
  status text not null default 'pending',
  -- What the bursar actually credited, when it differs from amount_kobo.
  confirmed_amount_kobo bigint,
  decided_by uuid,
  decided_at timestamp with time zone,
  reject_reason text,
  payment_id uuid,
  created_at timestamp with time zone not null default now(),
  constraint payment_claims_pkey primary key (id),
  constraint payment_claims_invoice_id_fkey foreign key (invoice_id) references invoices(id),
  constraint payment_claims_student_id_fkey foreign key (student_id) references student_profiles(id),
  constraint payment_claims_claimed_by_fkey foreign key (claimed_by) references profiles(id),
  constraint payment_claims_decided_by_fkey foreign key (decided_by) references profiles(id),
  constraint payment_claims_payment_id_fkey foreign key (payment_id) references payments(id),
  constraint payment_claims_amount_positive check (amount_kobo > 0),
  constraint payment_claims_confirmed_amount_positive
    check (confirmed_amount_kobo is null or confirmed_amount_kobo > 0),
  constraint payment_claims_sender_name_present check (length(btrim(sender_name)) > 0),
  constraint payment_claims_status_check check (status in ('pending', 'confirmed', 'rejected')),
  constraint payment_claims_decision_consistent check (
    (status = 'pending' and decided_by is null and decided_at is null
       and payment_id is null and confirmed_amount_kobo is null and reject_reason is null)
    or (status = 'confirmed' and decided_at is not null
       and payment_id is not null and confirmed_amount_kobo is not null)
    or (status = 'rejected' and decided_at is not null
       and reject_reason is not null and length(btrim(reject_reason)) > 0)
  )
);

-- One open claim per invoice at a time, to stop duplicates.
create unique index if not exists payment_claims_one_pending_per_invoice
  on payment_claims (invoice_id) where status = 'pending';

create index if not exists payment_claims_status_created_idx
  on payment_claims (status, created_at);
create index if not exists payment_claims_claimed_by_idx
  on payment_claims (claimed_by);
create index if not exists payment_claims_student_idx
  on payment_claims (student_id);
create index if not exists payment_claims_invoice_idx
  on payment_claims (invoice_id);

alter table payment_claims enable row level security;

-- The payer, the student it is for, a linked guardian, and fee staff can read.
drop policy if exists payment_claims_select on payment_claims;
create policy payment_claims_select on payment_claims
  for select to authenticated
  using (
    claimed_by = (select auth.uid())
    or student_id = (select auth.uid())
    or exists (
      select 1 from guardian_links gl
      where gl.student_id = payment_claims.student_id
        and gl.parent_id = (select auth.uid())
    )
    or (select is_admin())
    or (select is_bursar())
  );

revoke all on payment_claims from anon;
revoke insert, update, delete, truncate on payment_claims from authenticated;

-- ----------------------------------------------------------------------------
-- 3. Lapsed schools can still take and confirm transfers
-- ----------------------------------------------------------------------------

-- Same function as in 20261019120000_school_license.sql with payment_claims
-- added to the exempt list, like payments and invoices: fee payment stays
-- allowed when the license has lapsed. Re-run safe.
create or replace function apply_license_write_gate(
  p_exempt text[] default array[
    -- Parents must still be able to pay fees and get receipts.
    'payments', 'invoices', 'invoice_installments', 'payment_claims',
    -- The audit trail must keep recording.
    'audit_log',
    -- Not reachable by any role.
    'school_license'
  ]
)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  v_table text;
  v_count integer := 0;
begin
  for v_table in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
      and not (c.relname = any (p_exempt))
    order by c.relname
  loop
    execute format('drop policy if exists license_gate_insert on public.%I', v_table);
    execute format('drop policy if exists license_gate_update on public.%I', v_table);
    execute format('drop policy if exists license_gate_delete on public.%I', v_table);

    execute format(
      'create policy license_gate_insert on public.%I as restrictive for insert to public with check ((select public.license_active()))',
      v_table);
    execute format(
      'create policy license_gate_update on public.%I as restrictive for update to public using ((select public.license_active())) with check ((select public.license_active()))',
      v_table);
    execute format(
      'create policy license_gate_delete on public.%I as restrictive for delete to public using ((select public.license_active()))',
      v_table);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function apply_license_write_gate(text[]) from public, anon, authenticated;

select apply_license_write_gate();
