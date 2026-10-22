-- Read-only support sessions (audited impersonation).
--
-- The hosting control plane can open a short-lived session on a school as a
-- dedicated "platform support" admin account. That account's auth user has
-- app_metadata.read_only = true. app_metadata is signed into the user's JWT
-- and cannot be edited by the user, so the database can tell such a session
-- apart without a lookup. While it is set, every INSERT, UPDATE and DELETE
-- made with the session's own credentials is refused, on every public table.
--
-- Limits, same as the license gate (20261019120000_school_license.sql): the
-- service role bypasses RLS and SECURITY DEFINER functions run as their
-- owner, so the app's server actions must also refuse (assertRole in
-- lib/actions/authGuards.ts). This gate is the backstop for anything that
-- reaches the database with the session's own token.
--
-- After a migration adds a table, re-run: select apply_readonly_write_gate();

-- ----------------------------------------------------------------------------
-- 1. Is the current session a read-only support session?
-- ----------------------------------------------------------------------------
create or replace function is_read_only_session()
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'read_only')::boolean, false);
$$;

revoke all on function is_read_only_session() from public;
grant execute on function is_read_only_session() to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. Restrictive write policies on every public table with RLS enabled.
--    Restrictive policies are ANDed with the table's own policies, so they
--    can only remove access. Nothing is exempt: a support session must not
--    write anything, including the audit log (it writes through
--    log_impersonation_event below, which runs as the table owner).
-- ----------------------------------------------------------------------------
create or replace function apply_readonly_write_gate()
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
    order by c.relname
  loop
    execute format('drop policy if exists readonly_gate_insert on public.%I', v_table);
    execute format('drop policy if exists readonly_gate_update on public.%I', v_table);
    execute format('drop policy if exists readonly_gate_delete on public.%I', v_table);

    execute format(
      'create policy readonly_gate_insert on public.%I as restrictive for insert to public with check ((select not public.is_read_only_session()))',
      v_table);
    execute format(
      'create policy readonly_gate_update on public.%I as restrictive for update to public using ((select not public.is_read_only_session())) with check ((select not public.is_read_only_session()))',
      v_table);
    execute format(
      'create policy readonly_gate_delete on public.%I as restrictive for delete to public using ((select not public.is_read_only_session()))',
      v_table);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function apply_readonly_write_gate() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Single-use support links. The school app records each link's id (jti)
--    here when it is used, so a link cannot be replayed. Service role only:
--    RLS is on and there are no policies and no grants.
-- ----------------------------------------------------------------------------
create table if not exists impersonation_links_used (
  jti text primary key,
  used_at timestamptz not null default now()
);
alter table impersonation_links_used enable row level security;
revoke all on impersonation_links_used from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Audit trail for what a support session looks at. Callable only from a
--    read-only session, and it only ever writes under the caller's own id, so
--    it cannot be used to forge entries for anyone else.
-- ----------------------------------------------------------------------------
create or replace function log_impersonation_event(p_event text, p_path text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or not is_read_only_session() then
    raise exception 'Only a read-only support session can log impersonation events';
  end if;
  if p_event not in ('view', 'ended') then
    raise exception 'Unknown impersonation event %', p_event;
  end if;

  insert into audit_log (entity_type, entity_id, action, actor_id, metadata)
  values (
    'impersonation',
    auth.uid(),
    'impersonation.' || p_event,
    auth.uid(),
    jsonb_build_object(
      'path', left(coalesce(p_path, ''), 500),
      'support_user', auth.jwt() -> 'app_metadata' ->> 'impersonated_by'
    )
  );
end;
$$;

revoke all on function log_impersonation_event(text, text) from public, anon;
grant execute on function log_impersonation_event(text, text) to authenticated;

select apply_readonly_write_gate();
