begin;

create extension if not exists pgtap with schema extensions;
select plan(51);

select is((
  select is_nullable
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles' and column_name = 'barbershop_id'
), 'YES', 'profiles.barbershop_id is nullable during onboarding');
select ok(exists(select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_owner_without_barber_check'), 'owner barber consistency constraint exists');
select ok(exists(select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_barber_link_complete_check'), 'barber complete-link constraint exists');
select ok(exists(select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_barber_tenant_fkey'), 'tenant-scoped barber FK is preserved');
select ok(exists(select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_barbershop_id_fkey'), 'barbershop FK is preserved');
select ok(exists(select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_id_fkey'), 'Auth user FK is preserved');

select ok(to_regprocedure('private.provision_profile_from_auth_user()') is not null, 'private provisioning trigger function exists');
select is((select prosecdef from pg_proc where oid = 'private.provision_profile_from_auth_user()'::regprocedure), true, 'provisioning function is security definer');
select is((select proconfig from pg_proc where oid = 'private.provision_profile_from_auth_user()'::regprocedure), array['search_path=pg_catalog'], 'provisioning function has controlled search path');
select ok(exists(select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'provision_profile_after_auth_user_insert' and not tgisinternal), 'Auth provisioning trigger exists');
select ok(not pg_catalog.has_function_privilege('anon', 'private.provision_profile_from_auth_user()', 'execute'), 'anon cannot execute provisioning function');
select ok(not pg_catalog.has_function_privilege('authenticated', 'private.provision_profile_from_auth_user()', 'execute'), 'authenticated cannot execute provisioning function');
select ok(not pg_catalog.has_function_privilege('service_role', 'private.provision_profile_from_auth_user()', 'execute'), 'service_role cannot execute provisioning function');
select ok(not exists(select 1 from information_schema.routine_privileges where routine_schema = 'private' and routine_name = 'provision_profile_from_auth_user' and grantee = 'PUBLIC'), 'PUBLIC cannot execute provisioning function');

insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('01300000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-new@example.test', '{"role":"owner","display_name":"Owner New"}', now(), now()),
  ('01300000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'barber-new@example.test', '{"role":"barber","display_name":"Barber New"}', now(), now()),
  ('01300000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'missing-role@example.test', '{"display_name":"No Role"}', now(), now()),
  ('01300000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'invalid-role@example.test', '{"role":"admin","display_name":"Invalid"}', now(), now()),
  ('01300000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'owner-second@example.test', '{"role":"owner"}', now(), now());

select is((select count(*) from public.profiles where id = '01300000-0000-4000-8000-000000000001'), 1::bigint, 'new owner receives exactly one profile');
select is((select role from public.profiles where id = '01300000-0000-4000-8000-000000000001'), 'owner', 'owner metadata is preserved');
select is((select barbershop_id from public.profiles where id = '01300000-0000-4000-8000-000000000001'), null::uuid, 'new owner starts without tenant');
select is((select barber_id from public.profiles where id = '01300000-0000-4000-8000-000000000002'), null::uuid, 'new barber starts unlinked');
select is((select barbershop_id from public.profiles where id = '01300000-0000-4000-8000-000000000002'), null::uuid, 'new barber has no partial tenant link');
select is((select count(*) from public.profiles where id = '01300000-0000-4000-8000-000000000003'), 0::bigint, 'missing role does not create a profile');
select is((select count(*) from public.profiles where id = '01300000-0000-4000-8000-000000000004'), 0::bigint, 'invalid role does not create a profile');
select is((select display_name from public.profiles where id = '01300000-0000-4000-8000-000000000005'), null::text, 'email is not copied into display name');

select throws_ok($test$update public.profiles set barber_id = '11111111-1111-4111-8111-111111111111' where id = '01300000-0000-4000-8000-000000000001'$test$, '23514'::char(5), null, 'owner cannot receive barber link');
select throws_ok($test$update public.profiles set barbershop_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' where id = '01300000-0000-4000-8000-000000000002'$test$, '23514'::char(5), null, 'barber cannot receive partial tenant link');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"01300000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.profiles), 1::bigint, 'unscoped owner reads only own profile');
select is((select count(*) from public.barbershops), 0::bigint, 'unscoped owner reads no barbershops');
select is((select count(*) from public.barbers), 0::bigint, 'unscoped owner reads no barbers');
select is((select count(*) from public.services), 0::bigint, 'unscoped owner reads no services');
select throws_ok($test$select * from public.get_internal_appointments()$test$, 'P0001'::char(5), 'INTERNAL_APPOINTMENTS_FORBIDDEN', 'unscoped owner fails closed when reading appointments');
select throws_ok($test$update public.profiles set barbershop_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' where id = '01300000-0000-4000-8000-000000000001'$test$, '42501'::char(5), null, 'unscoped owner cannot choose a tenant directly');
select throws_ok($test$insert into public.barbershops (name, slug, active) values ('Blocked', 'blocked-direct', true)$test$, '42501'::char(5), null, 'unscoped owner cannot insert barbershop directly');
select throws_ok($test$insert into public.services (name, price, duration_minutes, active, barbershop_id) values ('Blocked', 1, 30, true, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$test$, '42501'::char(5), null, 'unscoped owner cannot insert tenant service');

select lives_ok($test$select * from public.create_owner_barbershop(' First Shop ', 'first-shop', ' 81999999999 ', ' Address ', '81999999999', ' Description ', null, 30)$test$, 'owner creates first barbershop through RPC');
select is((select count(*) from public.barbershops where slug = 'first-shop'), 1::bigint, 'RPC creates exactly one barbershop');
select is((select count(*) from public.profiles where id = '01300000-0000-4000-8000-000000000001' and barbershop_id = (select id from public.barbershops where slug = 'first-shop')), 1::bigint, 'RPC links exactly one owner profile');
select is((select name from public.barbershops where slug = 'first-shop'), 'First Shop', 'RPC normalizes name whitespace');
select throws_ok($test$select * from public.create_owner_barbershop('Second', 'second-shop')$test$, 'P0001'::char(5), 'OWNER_ONBOARDING_ALREADY_CONFIGURED', 'repeat onboarding cannot create a second tenant');
select is((select count(*) from public.barbershops where slug in ('first-shop', 'second-shop')), 1::bigint, 'repeat leaves exactly one tenant');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"01300000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok($test$select * from public.create_owner_barbershop('Duplicate', 'first-shop')$test$, 'P0001'::char(5), 'OWNER_ONBOARDING_SLUG_TAKEN', 'duplicate slug has stable public code');
select is((select barbershop_id from public.profiles where id = '01300000-0000-4000-8000-000000000005'), null::uuid, 'duplicate slug rolls back owner link');
reset role;
select is((select count(*) from public.barbershops where slug = 'first-shop'), 1::bigint, 'duplicate slug creates no phantom tenant');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"01300000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($test$select * from public.create_owner_barbershop('Barber Shop', 'barber-shop')$test$, 'P0001'::char(5), 'OWNER_ONBOARDING_NOT_AUTHORIZED', 'barber cannot execute owner onboarding operation');
select is((select count(*) from public.barbershops where slug = 'barber-shop'), 0::bigint, 'barber failure leaves no tenant');

reset role;
select ok(has_function_privilege('authenticated', 'public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer)', 'execute'), 'authenticated can execute onboarding RPC');
select ok(not has_function_privilege('anon', 'public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer)', 'execute'), 'anon cannot execute onboarding RPC');
select ok(not has_function_privilege('service_role', 'public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer)', 'execute'), 'service_role cannot execute onboarding RPC');
select ok(not exists(select 1 from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'create_owner_barbershop' and grantee = 'PUBLIC' and privilege_type = 'EXECUTE'), 'PUBLIC cannot execute onboarding RPC');
select is((select prosecdef from pg_proc where oid = 'public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer)'::regprocedure), true, 'onboarding RPC is security definer');
select is((select proconfig from pg_proc where oid = 'public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer)'::regprocedure), array['search_path=pg_catalog'], 'onboarding RPC has controlled search path');
select ok(position('FOR UPDATE' in upper(pg_get_functiondef('public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer)'::regprocedure))) > 0, 'onboarding RPC serializes calls by profile row');
select ok(not exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'barbershops' and policyname = 'barbershops_authenticated_insert'), 'direct authenticated barbershop insert policy is removed');

select * from finish();
rollback;
