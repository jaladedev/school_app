-- School licensing, part 2: per-feature add-ons and guards inside RPCs.
--
-- Part 1 (20261019120000_school_license.sql) made the whole app read-only
-- when a license expires. This adds:
--
--   1. license_require(feature): one call that raises when the school is
--      read-only or the feature is not part of its plan.
--   2. license_info() now also returns the enabled feature list, so the
--      navigation can hide add-ons the school has not bought.
--   3. RLS write gates on the tables of each add-on (messaging, transport,
--      hostel, library, inventory). Reads are not gated here; the app hides
--      the pages. Turning a feature off never deletes its data.
--   4. A guard at the top of every SECURITY DEFINER function that writes.
--      Those functions run as their owner, so RLS does not apply to them
--      and a user could otherwise call them directly through the API.
--
-- Feature keys: messaging, transport, hostel, library, bulk_email,
-- inventory. bulk_email has no table of its own; it is enforced in the
-- app's server actions.
--
-- Re-run after any migration that creates a feature table or redefines one
-- of the guarded functions (CREATE OR REPLACE drops the guard line):
--   select apply_license_feature_gate();
--   select apply_license_rpc_guards();

-- ----------------------------------------------------------------------------
-- 1. license_require
-- ----------------------------------------------------------------------------

create or replace function license_require(p_feature text default null)
returns void
language plpgsql
stable
set search_path to 'public'
as $$
begin
  if not public.license_active() then
    raise exception 'This school''s subscription has lapsed, so changes are not allowed.'
      using errcode = '42501';
  end if;
  if p_feature is not null and not public.license_has(p_feature) then
    raise exception 'The % feature is not included in this school''s plan.', p_feature
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function license_require(text) from public, anon;
grant execute on function license_require(text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. license_info with the feature list
-- ----------------------------------------------------------------------------

-- The return type changes, so the function has to be dropped first.
drop function if exists license_info();

-- features is NULL when there is no license row (legacy or development
-- database), which the app treats as every feature enabled.
create function license_info()
returns table (
  status text,
  is_trial boolean,
  valid_until timestamp with time zone,
  grace_until timestamp with time zone,
  features text[]
)
language sql
stable security definer
set search_path to 'public'
as $$
  select public.license_status(), l.is_trial, l.valid_until, l.grace_until, l.features
  from (select 1) as one
  left join public.school_license l on true
  where (select auth.uid()) is not null;
$$;

revoke all on function license_info() from public, anon;
grant execute on function license_info() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Feature write gates (RLS)
-- ----------------------------------------------------------------------------

create or replace function license_feature_tables()
returns table (feature text, table_name text)
language sql
immutable
as $$
  select * from (values
    ('messaging', 'messages'),
    ('messaging', 'conversation_archives'),
    ('transport', 'vehicles'),
    ('transport', 'route_vehicle_history'),
    ('transport', 'transport_routes'),
    ('transport', 'transport_stops'),
    ('transport', 'transport_assignments'),
    ('transport', 'transport_fee_structures'),
    ('transport', 'transport_locations'),
    ('transport', 'transport_pickup_logs'),
    ('transport', 'transport_trip_status'),
    ('hostel', 'hostels'),
    ('hostel', 'hostel_rooms'),
    ('hostel', 'hostel_assignments'),
    ('hostel', 'hostel_fee_structures'),
    ('hostel', 'hostel_leave_logs'),
    ('hostel', 'hostel_visitor_logs'),
    ('hostel', 'hostel_waitlist'),
    ('library', 'library_books'),
    ('library', 'library_loans'),
    ('inventory', 'assets')
  ) as t(feature, table_name);
$$;

-- Adds three RESTRICTIVE policies (insert, update, delete) per feature
-- table, ANDed with the existing policies. Safe to run again. Tables in
-- the list that do not exist yet are skipped.
create or replace function apply_license_feature_gate()
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in select feature, table_name from public.license_feature_tables() order by 1, 2
  loop
    if to_regclass(format('public.%I', r.table_name)) is null then
      continue;
    end if;

    execute format('drop policy if exists license_feature_insert on public.%I', r.table_name);
    execute format('drop policy if exists license_feature_update on public.%I', r.table_name);
    execute format('drop policy if exists license_feature_delete on public.%I', r.table_name);

    execute format(
      'create policy license_feature_insert on public.%I as restrictive for insert to public with check ((select public.license_has(%L)))',
      r.table_name, r.feature);
    execute format(
      'create policy license_feature_update on public.%I as restrictive for update to public using ((select public.license_has(%L))) with check ((select public.license_has(%L)))',
      r.table_name, r.feature, r.feature);
    execute format(
      'create policy license_feature_delete on public.%I as restrictive for delete to public using ((select public.license_has(%L)))',
      r.table_name, r.feature);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function apply_license_feature_gate() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Guards inside SECURITY DEFINER functions that write
-- ----------------------------------------------------------------------------

-- Inserts `perform public.license_require(...)` as the first statement of
-- each listed function. Only SECURITY DEFINER functions need it: a
-- SECURITY INVOKER function runs as the caller and is already covered by
-- the policies above (create_quiz_with_questions, replace_quiz_questions
-- and swap_transport_stop_order are invoker functions).
--
-- Not guarded on purpose: record_invoice_payment and
-- replace_invoice_installments (fee payment must keep working), the
-- mark_all_*_read functions, and the log_* audit triggers.
--
-- Each function is rewritten from its own current definition, so the body,
-- grants and settings are unchanged. Functions already guarded are skipped.
create or replace function apply_license_rpc_guards()
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  v record;
  f record;
  v_def text;
  v_new text;
  v_count integer := 0;
begin
  for v in
    select * from (values
      ('answer_quiz_question', null),
      ('grade_quiz_essay_answers', null),
      ('start_quiz_attempt', null),
      ('submit_quiz_attempt', null),
      ('send_fee_reminders', null),
      ('assign_student_to_route', 'transport'),
      ('assign_student_to_hostel_room', 'hostel'),
      ('join_hostel_waitlist', 'hostel'),
      ('borrow_library_book', 'library'),
      ('return_library_book', 'library')
    ) as t(fname, feat)
  loop
    for f in
      select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v.fname and p.prosecdef
    loop
      v_def := pg_get_functiondef(f.oid);
      if v_def like '%license_require(%' then
        continue;
      end if;

      v_new := regexp_replace(
        v_def,
        E'(\n)(begin)(\n)',
        E'\\1\\2\\3  perform public.license_require(' || coalesce(quote_literal(v.feat), '') || E');\n',
        1, 1, 'i'
      );

      if v_new = v_def then
        raise exception 'apply_license_rpc_guards: could not find BEGIN in %', v.fname;
      end if;

      execute v_new;
      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke all on function apply_license_rpc_guards() from public, anon, authenticated;

select apply_license_feature_gate();
select apply_license_rpc_guards();
