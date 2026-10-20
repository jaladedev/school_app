-- Run against a throwaway Postgres: psql -v ON_ERROR_STOP=1 -f tests/sql/license.test.sql
-- Builds a minimal Supabase-like environment, applies the license migration
-- and asserts its behaviour. Any failed assertion raises and stops the run.

drop schema if exists public cascade; create schema public;
drop schema if exists auth cascade; create schema auth;
do $$ begin
  create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create type user_role as enum ('admin','teacher','student','parent');
create table profiles (id uuid primary key, role user_role not null, full_name text not null default 'x', is_active boolean not null default true);
create table classes (id uuid primary key default gen_random_uuid(), is_archived boolean not null default false);
create table student_profiles (id uuid primary key, class_id uuid);
create table announcements (id uuid primary key default gen_random_uuid(), title text);
create table payments (id uuid primary key default gen_random_uuid(), amount int);
create table audit_log (id uuid primary key default gen_random_uuid(), action text);
create function is_admin() returns boolean language sql stable security definer set search_path to 'public'
  as $$ select exists (select 1 from public.profiles where id = auth.uid() and role='admin' and is_active) $$;
alter table profiles enable row level security;
alter table announcements enable row level security;
alter table payments enable row level security;
alter table audit_log enable row level security;
create policy p_all on profiles for all to public using (true) with check (true);
create policy a_all on announcements for all to public using (true) with check (true);
create policy pay_all on payments for all to public using (true) with check (true);
create policy log_all on audit_log for all to public using (true) with check (true);
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant select on all tables in schema public to anon;

insert into profiles values ('00000000-0000-0000-0000-0000000000a1','admin'), ('00000000-0000-0000-0000-0000000000b1','teacher');
insert into classes (id) values ('00000000-0000-0000-0000-0000000000c1');
insert into classes (id, is_archived) values ('00000000-0000-0000-0000-0000000000c2', true);
insert into profiles values ('00000000-0000-0000-0000-0000000000d1','student'), ('00000000-0000-0000-0000-0000000000d2','student'), ('00000000-0000-0000-0000-0000000000d3','student');
insert into student_profiles values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000d3','00000000-0000-0000-0000-0000000000c2');

\i supabase/migrations/20261019120000_school_license.sql

create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
grant execute on function pg_temp.assert(boolean, text) to public;

-- A. No row: permissive
select pg_temp.assert(license_status() = 'none', 'status none with no row');
select pg_temp.assert(license_active(), 'none is writable');
select pg_temp.assert(license_has('messaging'), 'none has every feature');

-- B. First push inserts
select pg_temp.assert(set_license('11111111-1111-1111-1111-111111111111', 1, '2026/2027',
  now() + interval '10 days', now() + interval '31 days', 300, array['messaging'], true), 'first push applied');
select pg_temp.assert(license_status() = 'active', 'active');
select pg_temp.assert(license_has('messaging') and not license_has('transport'), 'features list honoured');

-- C. Stale / duplicate no-op; newer applies
select pg_temp.assert(not set_license('11111111-1111-1111-1111-111111111111', 1, 'X', now(), now(), 1, '{}'), 'duplicate version is no-op');
select pg_temp.assert(not set_license('11111111-1111-1111-1111-111111111111', 0 + 1, 'X', now(), now(), 1, '{}'), 'stale version is no-op');
select pg_temp.assert((select session from school_license) = '2026/2027', 'no-op left row untouched');

-- D. Wrong school
do $$ begin
  perform set_license('22222222-2222-2222-2222-222222222222', 9, 's', now(), now(), 1, '{}');
  raise exception 'ASSERT FAILED: wrong school accepted';
exception when sqlstate '42501' then null; end $$;

-- E. Access control on the table and function
set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000a1';
do $$ begin perform 1 from school_license; raise exception 'ASSERT FAILED: authenticated read table';
exception when insufficient_privilege then null; end $$;
do $$ begin perform set_license('11111111-1111-1111-1111-111111111111', 99, 's', now(), now(), 1, '{}');
  raise exception 'ASSERT FAILED: authenticated ran set_license';
exception when insufficient_privilege then null; end $$;
reset role;
set role anon;
do $$ begin perform set_license('11111111-1111-1111-1111-111111111111', 99, 's', now(), now(), 1, '{}');
  raise exception 'ASSERT FAILED: anon ran set_license';
exception when insufficient_privilege then null; end $$;
do $$ begin perform * from license_summary(); raise exception 'ASSERT FAILED: anon ran summary';
exception when insufficient_privilege then null; end $$;
reset role;

-- F. Summary: admin only; counts active students in non-archived classes
set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000b1';
do $$ begin perform * from license_summary(); raise exception 'ASSERT FAILED: teacher read summary';
exception when sqlstate '42501' then null; end $$;
set test.uid = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.assert((select student_count from license_summary()) = 2, 'student_count excludes archived class');
select pg_temp.assert((select status from license_info()) = 'active', 'license_info for signed-in user');
select pg_temp.assert((select features from license_summary()) = array['messaging'], 'summary shows features');
reset role;

-- G. Active: writes work
set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000b1';
insert into announcements (title) values ('hi');
reset role;

-- H. Grace: still writable
select set_license('11111111-1111-1111-1111-111111111111', 2, '2026/2027', now() - interval '1 day', now() + interval '20 days', 300, array['messaging']);
select pg_temp.assert(license_status() = 'grace' and license_active(), 'grace is writable');
set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000b1';
insert into announcements (title) values ('grace write ok');
reset role;

-- I. Expired: read-only except exempt tables
select set_license('11111111-1111-1111-1111-111111111111', 3, '2026/2027', now() - interval '30 days', now() - interval '1 day', 300, array['messaging']);
select pg_temp.assert(license_status() = 'expired' and not license_active(), 'expired');
select pg_temp.assert(not license_has('messaging'), 'expired loses add-ons');
set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.assert((select count(*) from announcements) = 2, 'reads still work when expired');
do $$ begin insert into announcements (title) values ('nope'); raise exception 'ASSERT FAILED: insert allowed when expired';
exception when insufficient_privilege then null; end $$;
do $$ declare n int; begin update announcements set title='x'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'ASSERT FAILED: update allowed when expired (% rows)', n; end if; end $$;
do $$ declare n int; begin delete from announcements; get diagnostics n = row_count;
  if n <> 0 then raise exception 'ASSERT FAILED: delete allowed when expired (% rows)', n; end if; end $$;
insert into payments (amount) values (100);
insert into audit_log (action) values ('still logging');
reset role;

-- J. Service role (control plane) is never gated and can reinstate
select pg_temp.assert(set_license('11111111-1111-1111-1111-111111111111', 4, '2027/2028', now() + interval '300 days', now() + interval '321 days', 300, array['messaging','transport']), 'renewal applied');
select pg_temp.assert(license_status() = 'active', 'renewed -> active');
set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000b1';
insert into announcements (title) values ('back to normal');
reset role;

-- K. Gate is idempotent and covers a table added later
create table homework (id uuid primary key default gen_random_uuid());
alter table homework enable row level security;
create policy hw_all on homework for all to public using (true) with check (true);
grant all on homework to authenticated;
select pg_temp.assert(apply_license_write_gate() = 3, 'gate reapplied to profiles, announcements and the new homework table');
select set_license('11111111-1111-1111-1111-111111111111', 5, 's', now() - interval '30 days', now() - interval '1 day', 300, '{}');
set role authenticated; set test.uid = '00000000-0000-0000-0000-0000000000b1';
do $$ begin insert into homework default values; raise exception 'ASSERT FAILED: new table not gated';
exception when insufficient_privilege then null; end $$;
reset role;

\echo ALL LICENSE SQL TESTS PASSED
