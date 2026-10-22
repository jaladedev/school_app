-- Read-only support sessions: the write gate, the audit function and the
-- single-use link table. Runs against the fully migrated scratch database
-- (tests/sql/run.sh). The prelude's auth.jwt() reads the test.jwt setting.
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
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000050a1'), -- real school admin
  ('00000000-0000-0000-0000-0000000050a2'); -- support viewer
insert into profiles (id, role, full_name, is_active, must_change_password) values
  ('00000000-0000-0000-0000-0000000050a1', 'admin', 'School Admin', true, false),
  ('00000000-0000-0000-0000-0000000050a2', 'admin', 'Platform support (read-only)', true, false);
insert into classes (id, name, academic_year, education_level, level_number) values
  ('00000000-0000-0000-0000-0000000050b1', 'Class A', '2026/2027', 'primary', 1);

-- Both admins are signed in as role authenticated. Only the second carries
-- app_metadata.read_only in its token.
select pg_temp.assert(not is_read_only_session(), 'no token means not read-only');

-- A normal admin session can still write.
select set_config('test.uid', '00000000-0000-0000-0000-0000000050a1', true);
select set_config('test.jwt', '{"app_metadata":{"provider":"email"}}', true);
set local role authenticated;
select pg_temp.assert(not is_read_only_session(), 'normal admin is not read-only');
insert into classes (name, academic_year, education_level, level_number)
values ('By admin', '2026/2027', 'primary', 2);
update classes set name = 'Edited' where id = '00000000-0000-0000-0000-0000000050b1';
reset role;
select pg_temp.assert((select name from classes where id = '00000000-0000-0000-0000-0000000050b1') = 'Edited',
  'normal admin can update');

-- The support session can read but not write.
select set_config('test.uid', '00000000-0000-0000-0000-0000000050a2', true);
select set_config('test.jwt', '{"app_metadata":{"read_only":true,"impersonated_by":"support@example.com"}}', true);
set local role authenticated;
select pg_temp.assert(is_read_only_session(), 'support session is read-only');
select pg_temp.assert((select count(*) from classes) = 2, 'support session can read');
select pg_temp.assert(pg_temp.fails($q$
  insert into classes (name, academic_year, education_level, level_number)
  values ('By support', '2026/2027', 'primary', 3)
$q$), 'support session cannot insert');
-- An UPDATE or DELETE that the policy hides matches no rows instead of
-- raising, so check the data, not just the error.
update classes set name = 'Hacked';
delete from classes;
reset role;
select pg_temp.assert((select count(*) from classes where name = 'Hacked') = 0, 'support session cannot update');
select pg_temp.assert((select count(*) from classes) = 2, 'support session cannot delete');

-- It cannot write the audit log, or flip its own flag, directly.
set local role authenticated;
select pg_temp.assert(pg_temp.fails($q$
  insert into audit_log (entity_type, entity_id, action) values ('x', gen_random_uuid(), 'forged')
$q$), 'support session cannot insert audit rows directly');
reset role;

-- It logs through log_impersonation_event, under its own id.
set local role authenticated;
select log_impersonation_event('view', '/dashboard/admin/students');
reset role;
select pg_temp.assert((
  select count(*) from audit_log
  where action = 'impersonation.view' and actor_id = '00000000-0000-0000-0000-0000000050a2'
    and metadata ->> 'path' = '/dashboard/admin/students'
    and metadata ->> 'support_user' = 'support@example.com'
) = 1, 'view was logged with the support user');
set local role authenticated;
select pg_temp.assert(pg_temp.fails($q$ select log_impersonation_event('exported', '/x') $q$), 'unknown event is refused');
reset role;

-- A normal user cannot use the audit function to forge entries.
select set_config('test.uid', '00000000-0000-0000-0000-0000000050a1', true);
select set_config('test.jwt', '{"app_metadata":{}}', true);
set local role authenticated;
select pg_temp.assert(pg_temp.fails($q$ select log_impersonation_event('view', '/x') $q$), 'normal session cannot log impersonation');
reset role;

-- The single-use link table is not reachable by signed-in users.
set local role authenticated;
select pg_temp.assert(pg_temp.fails($q$ select * from impersonation_links_used $q$), 'links table is not readable');
select pg_temp.assert(pg_temp.fails($q$ insert into impersonation_links_used (jti) values ('x') $q$), 'links table is not writable');
reset role;

-- The gate covers every RLS table, including ones added later once it is re-run.
select pg_temp.assert(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
    and not exists (select 1 from pg_policies p where p.tablename = c.relname and p.policyname = 'readonly_gate_insert')
), 'every RLS table has the read-only gate');
create table pg_temp_probe_table (id int);
alter table pg_temp_probe_table enable row level security;
select pg_temp.assert(apply_readonly_write_gate() >= 1, 're-running the gate succeeds');
select pg_temp.assert(exists (
  select 1 from pg_policies where tablename = 'pg_temp_probe_table' and policyname = 'readonly_gate_delete'
), 're-running the gate covers a new table');

rollback;
\echo ALL READ-ONLY SESSION SQL TESTS PASSED
