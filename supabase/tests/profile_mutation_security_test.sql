begin;

create extension if not exists pgtap with schema extensions;
select plan(38);

select ok(has_table_privilege('authenticated', 'public.profiles', 'select'), 'authenticated retains direct profile select');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'insert'), 'authenticated has no profile insert');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'update'), 'authenticated has no profile update');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'delete'), 'authenticated has no profile delete');
select is((select count(*) from information_schema.column_privileges where table_schema = 'public' and table_name = 'profiles' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE', 'REFERENCES')), 0::bigint, 'authenticated has no column write privileges');
select ok(has_table_privilege('service_role', 'public.profiles', 'select') and has_table_privilege('service_role', 'public.profiles', 'insert') and has_table_privilege('service_role', 'public.profiles', 'update') and has_table_privilege('service_role', 'public.profiles', 'delete'), 'service_role retains administrative profile access');
select ok(not has_table_privilege('anon', 'public.profiles', 'select') and not has_table_privilege('anon', 'public.profiles', 'insert') and not has_table_privilege('anon', 'public.profiles', 'update') and not has_table_privilege('anon', 'public.profiles', 'delete'), 'anon has no profile access');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'profiles'), 2::bigint, 'profiles has only two policies');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname in ('profiles_select_own', 'profiles_owner_select_own_barbershop') and cmd = 'SELECT'), 2::bigint, 'required profile select policies remain');

select is((select prosecdef from pg_proc where oid = 'public.link_barber_profile_by_email(text,uuid)'::regprocedure), true, 'link RPC is security definer');
select is((select proconfig from pg_proc where oid = 'public.link_barber_profile_by_email(text,uuid)'::regprocedure), array['search_path=pg_catalog'], 'link RPC has controlled search path');
select ok(has_function_privilege('authenticated', 'public.link_barber_profile_by_email(text,uuid)', 'execute'), 'authenticated can execute link RPC');
select ok(not has_function_privilege('anon', 'public.link_barber_profile_by_email(text,uuid)', 'execute'), 'anon cannot execute link RPC');
select ok(not exists(select 1 from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'link_barber_profile_by_email' and grantee = 'PUBLIC' and privilege_type = 'EXECUTE'), 'PUBLIC cannot execute link RPC');
select ok(not has_function_privilege('service_role', 'public.link_barber_profile_by_email(text,uuid)', 'execute'), 'service_role cannot execute link RPC');
select ok(position('FOR UPDATE' in upper(pg_get_functiondef('public.link_barber_profile_by_email(text,uuid)'::regprocedure))) > 0, 'link RPC serializes mutable rows');

insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('01400000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-security@example.test', '{"role":"owner","display_name":"Security Owner"}', now(), now()),
  ('01400000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'barber-security@example.test', '{"role":"barber","display_name":"Security Barber"}', now(), now()),
  ('01400000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'target-security@example.test', '{"role":"barber","display_name":"Target Barber"}', now(), now());

select is((select count(*) from public.profiles where id = '01400000-0000-4000-8000-000000000001'), 1::bigint, 'trigger provisions owner profile');
select is((select count(*) from public.profiles where id = '01400000-0000-4000-8000-000000000002'), 1::bigint, 'trigger provisions barber profile');

insert into public.barbers (id, name, active, barbershop_id)
values ('01400000-0000-4000-8000-000000000010', 'Second Alpha Barber', true, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');

update public.profiles set barbershop_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' where id = '01400000-0000-4000-8000-000000000001';
update public.profiles set barbershop_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', barber_id = '11111111-1111-4111-8111-111111111111' where id = '01400000-0000-4000-8000-000000000002';

insert into public.appointments (id, client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id)
values
  ('01400000-0000-4000-8000-000000000020', 'Own Security Client', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, now() + interval '70 days', now() + interval '70 days 30 minutes', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('01400000-0000-4000-8000-000000000021', 'Other Security Client', '0000000000', '01400000-0000-4000-8000-000000000010', 'Second Alpha Barber', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, now() + interval '71 days', now() + interval '71 days 30 minutes', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"01400000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($test$update public.profiles set role = 'owner' where id = '01400000-0000-4000-8000-000000000002'$test$, '42501'::char(5), null, 'barber cannot change role');
select throws_ok($test$update public.profiles set active = false where id = '01400000-0000-4000-8000-000000000002'$test$, '42501'::char(5), null, 'barber cannot change active');
select throws_ok($test$update public.profiles set barber_id = '01400000-0000-4000-8000-000000000010' where id = '01400000-0000-4000-8000-000000000002'$test$, '42501'::char(5), null, 'barber cannot impersonate another professional');
select throws_ok($test$update public.profiles set barbershop_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2' where id = '01400000-0000-4000-8000-000000000002'$test$, '42501'::char(5), null, 'barber cannot change tenant');
select throws_ok($test$update public.profiles set display_name = 'Changed' where id = '01400000-0000-4000-8000-000000000002'$test$, '42501'::char(5), null, 'barber cannot change display name');
select throws_ok($test$update public.profiles set id = '01400000-0000-4000-8000-000000000099' where id = '01400000-0000-4000-8000-000000000002'$test$, '42501'::char(5), null, 'barber cannot change profile id');
select throws_ok($test$update public.profiles set created_at = now(), updated_at = now() where id = '01400000-0000-4000-8000-000000000002'$test$, '42501'::char(5), null, 'barber cannot change timestamps');
select throws_ok($test$delete from public.profiles where id = '01400000-0000-4000-8000-000000000002'$test$, '42501'::char(5), null, 'barber cannot delete profile');
select throws_ok($test$insert into public.profiles (id, role, active) values ('01400000-0000-4000-8000-000000000098', 'barber', true)$test$, '42501'::char(5), null, 'barber cannot insert profile');
select is((select barber_id from public.profiles where id = '01400000-0000-4000-8000-000000000002'), '11111111-1111-4111-8111-111111111111'::uuid, 'failed impersonation leaves barber link unchanged');
select is((select count(*) from public.get_internal_appointments() where client_name in ('Own Security Client', 'Other Security Client')), 1::bigint, 'barber still reads only own appointments after attack');

reset role;
update public.profiles set active = false where id = '01400000-0000-4000-8000-000000000002';
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"01400000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($test$select * from public.get_internal_appointments()$test$, 'P0001'::char(5), 'INTERNAL_APPOINTMENTS_FORBIDDEN', 'inactive barber profile fails closed');

reset role;
update public.profiles set active = true where id = '01400000-0000-4000-8000-000000000002';
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"01400000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($test$update public.profiles set display_name = 'Changed' where id = '01400000-0000-4000-8000-000000000002'$test$, '42501'::char(5), null, 'owner cannot update profiles directly');
select throws_ok($test$insert into public.profiles (id, role, active) values ('01400000-0000-4000-8000-000000000097', 'barber', true)$test$, '42501'::char(5), null, 'owner cannot insert profiles directly');
select throws_ok($test$delete from public.profiles where id = '01400000-0000-4000-8000-000000000002'$test$, '42501'::char(5), null, 'owner cannot delete profiles directly');
select lives_ok($test$select * from public.link_barber_profile_by_email('target-security@example.test', '01400000-0000-4000-8000-000000000010')$test$, 'owner links barber through trusted RPC');
select is((select barber_id from public.profiles where id = '01400000-0000-4000-8000-000000000003'), '01400000-0000-4000-8000-000000000010'::uuid, 'trusted RPC writes the selected barber link');
select lives_ok($test$select * from public.link_barber_profile_by_email('target-security@example.test', '01400000-0000-4000-8000-000000000010')$test$, 'repeated link call is idempotent');
select is((select count(*) from public.profiles where id = '01400000-0000-4000-8000-000000000003'), 1::bigint, 'repeated link creates no duplicate profile');
select throws_ok($test$select * from public.link_barber_profile_by_email('target-security@example.test', '22222222-2222-4222-8222-222222222222')$test$, 'P0001'::char(5), 'BARBER_NOT_IN_TENANT', 'link RPC rejects cross-tenant barber');

select * from finish();
rollback;
