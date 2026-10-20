-- School licensing (P1 of the hosted multi-school plan).
--
-- One row per school database says whether the school's subscription is
-- current. The row is written ONLY by the hosting control plane, through
-- set_license(), using the service role key. No school user can read or
-- write the table directly, whatever their role in the app, and the school
-- never holds Supabase credentials.
--
-- Status is derived from the clock, never stored:
--   none     no row yet (a legacy or development database); treated as
--            unrestricted so existing databases keep working until the
--            control plane seeds a row. Provisioning always seeds one.
--   active   now() <= valid_until
--   grace    valid_until < now() <= grace_until (everything still works)
--   expired  now() > grace_until (read-only for all roles)
--
-- When a school is expired the app is read-only: restrictive write policies
-- are added to every public table (apply_license_write_gate at the bottom),
-- except the tables that must keep working so parents can still pay fees
-- and the audit trail keeps recording. Reads are never gated, so report
-- cards, receipts and exports keep working.
--
-- Limits of the database gate: the service role bypasses RLS and
-- SECURITY DEFINER functions run as their owner, so the app's server
-- actions must also check the license (lib/license.ts). The database gate
-- is the backstop for direct API calls made with a user's own session.

-- ----------------------------------------------------------------------------
-- 1. Table
-- ----------------------------------------------------------------------------

create table if not exists school_license (
  -- Single-row table: the boolean primary key can only ever be true.
  singleton boolean not null default true,
  -- Identity of the school this database belongs to, assigned by the
  -- control plane. set_license refuses a push for a different school_id.
  school_id uuid not null,
  -- Monotonic. A push with a version <= the stored one is a no-op, so
  -- stale, duplicate or late pushes are harmless; a revoke is just a
  -- higher version.
  version bigint not null,
  session text not null,
  is_trial boolean not null default false,
  valid_until timestamp with time zone not null,
  grace_until timestamp with time zone not null,
  -- The included-student threshold. Only used for a warning banner; it
  -- never blocks access. NULL means no cap.
  student_cap integer,
  -- Enabled add-on features (for example 'messaging', 'transport').
  features text[] not null default '{}',
  updated_at timestamp with time zone not null default now(),
  constraint school_license_pkey primary key (singleton),
  constraint school_license_singleton check (singleton),
  constraint school_license_grace_order check (grace_until >= valid_until),
  constraint school_license_version_positive check (version > 0),
  constraint school_license_student_cap_positive check (student_cap is null or student_cap > 0)
);

-- RLS on with deliberately NO policies: neither anon nor authenticated can
-- touch the table. Grants are removed as well so a future permissive policy
-- added by mistake still would not expose it.
alter table school_license enable row level security;
revoke all on table school_license from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Status helpers (readable by everyone; they expose only the answer)
-- ----------------------------------------------------------------------------

create or replace function license_status()
returns text
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce(
    (select case
              when now() <= l.valid_until then 'active'
              when now() <= l.grace_until then 'grace'
              else 'expired'
            end
     from public.school_license l),
    'none'
  );
$$;

-- True when writes are allowed. 'none' is permissive on purpose (see top).
create or replace function license_active()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select public.license_status() in ('active', 'grace', 'none');
$$;

-- True when the school may use an add-on feature. Core features are never
-- passed through this function. Expired schools lose every add-on; a
-- database with no license row has every feature (legacy/development).
create or replace function license_has(p_feature text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select case public.license_status()
    when 'none' then true
    when 'expired' then false
    else coalesce(
      (select p_feature = any (l.features) from public.school_license l),
      false
    )
  end;
$$;

-- Banner information for any signed-in user: where the school stands, with
-- no feature list and no counts.
create or replace function license_info()
returns table (
  status text,
  is_trial boolean,
  valid_until timestamp with time zone,
  grace_until timestamp with time zone
)
language sql
stable security definer
set search_path to 'public'
as $$
  select public.license_status(), l.is_trial, l.valid_until, l.grace_until
  from (select 1) as one
  left join public.school_license l on true
  where (select auth.uid()) is not null;
$$;

-- Read-only summary for the school admin's settings page. Checks the caller
-- is an admin and returns only these fields; it never exposes the table.
-- student_count is the number of active students: an active student account
-- in a class that is not archived. Graduated and archived accounts do not
-- count.
create or replace function license_summary()
returns table (
  status text,
  session text,
  is_trial boolean,
  valid_until timestamp with time zone,
  grace_until timestamp with time zone,
  student_cap integer,
  features text[],
  student_count integer
)
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Only a school admin can view the license summary.'
      using errcode = '42501';
  end if;

  return query
  select
    public.license_status(),
    l.session,
    l.is_trial,
    l.valid_until,
    l.grace_until,
    l.student_cap,
    coalesce(l.features, '{}'::text[]),
    (
      select count(*)::integer
      from public.profiles p
      join public.student_profiles sp on sp.id = p.id
      join public.classes c on c.id = sp.class_id
      where p.role = 'student'
        and p.is_active
        and not c.is_archived
    )
  from (select 1) as one
  left join public.school_license l on true;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. set_license: the only way to write the row
-- ----------------------------------------------------------------------------

-- Returns true when the push was applied, false when it was a stale or
-- duplicate no-op. Raises when p_school_id is not this database's school.
create or replace function set_license(
  p_school_id uuid,
  p_version bigint,
  p_session text,
  p_valid_until timestamp with time zone,
  p_grace_until timestamp with time zone,
  p_student_cap integer,
  p_features text[],
  p_is_trial boolean default false
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.school_license%rowtype;
begin
  if p_school_id is null or p_version is null then
    raise exception 'set_license: school_id and version are required.'
      using errcode = '22023';
  end if;

  -- Serialize concurrent pushes.
  select * into v_row from public.school_license for update;

  if not found then
    insert into public.school_license (
      school_id, version, session, is_trial, valid_until, grace_until,
      student_cap, features
    ) values (
      p_school_id, p_version, p_session, coalesce(p_is_trial, false),
      p_valid_until, p_grace_until, p_student_cap,
      coalesce(p_features, '{}'::text[])
    );
    return true;
  end if;

  if v_row.school_id <> p_school_id then
    raise exception 'set_license: school_id mismatch (this database belongs to a different school).'
      using errcode = '42501';
  end if;

  if p_version <= v_row.version then
    return false;
  end if;

  update public.school_license
  set version = p_version,
      session = p_session,
      is_trial = coalesce(p_is_trial, false),
      valid_until = p_valid_until,
      grace_until = p_grace_until,
      student_cap = p_student_cap,
      features = coalesce(p_features, '{}'::text[]),
      updated_at = now();

  return true;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Grants
-- ----------------------------------------------------------------------------

revoke all on function set_license(uuid, bigint, text, timestamp with time zone, timestamp with time zone, integer, text[], boolean)
  from public, anon, authenticated;
grant execute on function set_license(uuid, bigint, text, timestamp with time zone, timestamp with time zone, integer, text[], boolean)
  to service_role;

-- RLS policies call these as the signed-in user, so they need execute.
revoke all on function license_status() from public;
revoke all on function license_active() from public;
revoke all on function license_has(text) from public;
grant execute on function license_status() to anon, authenticated, service_role;
grant execute on function license_active() to anon, authenticated, service_role;
grant execute on function license_has(text) to anon, authenticated, service_role;

revoke all on function license_info() from public, anon;
grant execute on function license_info() to authenticated, service_role;

revoke all on function license_summary() from public, anon;
grant execute on function license_summary() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Read-only write gate for lapsed schools
-- ----------------------------------------------------------------------------

-- Adds three RESTRICTIVE policies (insert, update, delete) to every public
-- table except the exempt ones. Restrictive policies are ANDed with the
-- table's existing permissive policies, so nothing existing changes while
-- the license is active. Safe to run again: it replaces its own policies.
--
-- Call it again from any later migration that creates a table:
--   select apply_license_write_gate();
create or replace function apply_license_write_gate(
  p_exempt text[] default array[
    -- Parents must still be able to pay fees and get receipts.
    'payments', 'invoices', 'invoice_installments',
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
