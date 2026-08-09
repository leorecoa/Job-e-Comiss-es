begin;

create extension if not exists pgtap with schema extensions;
select plan(67);

select is((select count(*) from public.barbershops), 2::bigint, 'seed creates exactly two tenants');
select is((select count(distinct slug) from public.barbershops), 2::bigint, 'tenant slugs are distinct');
select is((select count(*) from public.barbershops bs where not exists (select 1 from public.barbers b where b.barbershop_id = bs.id and b.active)), 0::bigint, 'each tenant has an active barber');
select is((select count(*) from public.barbershops bs where not exists (select 1 from public.services s where s.barbershop_id = bs.id and s.active)), 0::bigint, 'each tenant has an active service');
select is((select count(*) from public.barbers b full join public.services s on s.barbershop_id = b.barbershop_id where b.barbershop_id is null or s.barbershop_id is null), 0::bigint, 'seed relationships stay inside their tenants');

select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('appointments', 'barbers', 'barbershops', 'profiles', 'services') and c.relrowsecurity), 5::bigint, 'RLS is enabled on all application tables');
select ok(not exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'appointments' and policyname = 'appointments_public_insert_scheduled'), 'legacy public insert policy is absent');
select ok(not has_table_privilege('anon', 'public.appointments', 'select'), 'anon has no direct appointments select');
select ok(not has_table_privilege('anon', 'public.appointments', 'insert'), 'anon has no direct appointments insert');
select ok(has_function_privilege('anon', 'public.create_public_appointment(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text)', 'execute'), 'anon can execute appointment creation RPC');
select ok(has_function_privilege('anon', 'public.get_public_appointment_slots(uuid)', 'execute'), 'anon can execute slots RPC');
select ok(not exists(select 1 from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'create_public_appointment' and grantee = 'PUBLIC' and privilege_type = 'EXECUTE'), 'PUBLIC cannot execute creation RPC');
select ok(not exists(select 1 from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'get_public_appointment_slots' and grantee = 'PUBLIC' and privilege_type = 'EXECUTE'), 'PUBLIC cannot execute slots RPC');

select ok(not exists(select 1 from information_schema.routine_privileges where routine_schema = 'private' and routine_name = 'current_user_barber_id' and grantee = 'PUBLIC' and privilege_type = 'EXECUTE'), 'PUBLIC has no direct execute on barber helper');
select ok(not exists(select 1 from information_schema.routine_privileges where routine_schema = 'private' and routine_name = 'current_user_barbershop_id' and grantee = 'PUBLIC' and privilege_type = 'EXECUTE'), 'PUBLIC has no direct execute on tenant helper');
select ok(not exists(select 1 from information_schema.routine_privileges where routine_schema = 'private' and routine_name = 'current_user_role' and grantee = 'PUBLIC' and privilege_type = 'EXECUTE'), 'PUBLIC has no direct execute on role helper');
select ok(not pg_catalog.has_function_privilege('anon', 'private.current_user_barber_id()', 'execute'), 'anon cannot execute barber helper');
select ok(not pg_catalog.has_function_privilege('anon', 'private.current_user_barbershop_id()', 'execute'), 'anon cannot execute tenant helper');
select ok(not pg_catalog.has_function_privilege('anon', 'private.current_user_role()', 'execute'), 'anon cannot execute role helper');
select ok(not pg_catalog.has_schema_privilege('anon', 'private', 'usage'), 'anon has no usage on private schema');
select ok(pg_catalog.has_schema_privilege('authenticated', 'private', 'usage'), 'authenticated has usage on private schema');
select ok(pg_catalog.has_function_privilege('authenticated', 'private.current_user_barber_id()', 'execute'), 'authenticated can execute barber helper');
select ok(pg_catalog.has_function_privilege('authenticated', 'private.current_user_barbershop_id()', 'execute'), 'authenticated can execute tenant helper');
select ok(pg_catalog.has_function_privilege('authenticated', 'private.current_user_role()', 'execute'), 'authenticated can execute role helper');
select ok(not pg_catalog.has_function_privilege('service_role', 'private.current_user_barber_id()', 'execute'), 'service_role cannot execute barber helper');
select ok(not pg_catalog.has_function_privilege('service_role', 'private.current_user_barbershop_id()', 'execute'), 'service_role cannot execute tenant helper');
select ok(not pg_catalog.has_function_privilege('service_role', 'private.current_user_role()', 'execute'), 'service_role cannot execute role helper');
select ok(not pg_catalog.has_schema_privilege('anon', 'private', 'create') and not pg_catalog.has_schema_privilege('authenticated', 'private', 'create') and not pg_catalog.has_schema_privilege('service_role', 'private', 'create'), 'application roles cannot create in private schema');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname in ('current_user_barber_id', 'current_user_barbershop_id', 'current_user_role') and p.prosecdef), 3::bigint, 'all private helpers remain security definer');
select is((select proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'current_user_barber_id'), array['search_path=public, private'], 'barber helper search path is unchanged');
select is((select proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'current_user_barbershop_id'), array['search_path=public, private'], 'tenant helper search path is unchanged');
select is((select proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'current_user_role'), array['search_path=public'], 'role helper search path is unchanged');
select ok(not pg_catalog.has_function_privilege('anon', 'public.link_barber_profile_by_email(text,uuid)', 'execute'), 'anon cannot execute authenticated profile RPC');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('aaaa0000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-alpha@example.test', now(), now()),
  ('bbbb0000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-beta@example.test', now(), now()),
  ('aaaa0000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'barber-alpha@example.test', now(), now()),
  ('aaaa0000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'cross-profile@example.test', now(), now());

insert into public.barbers (id, name, active, barbershop_id)
values ('55555555-5555-4555-8555-555555555555', 'Barber Alpha Two', true, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');

insert into public.profiles (id, display_name, role, active, barbershop_id, barber_id)
values
  ('aaaa0000-0000-4000-8000-000000000001', 'Owner Alpha Fixture', 'owner', true, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', null),
  ('bbbb0000-0000-4000-8000-000000000001', 'Owner Beta Fixture', 'owner', true, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', null),
  ('aaaa0000-0000-4000-8000-000000000002', 'Barber Alpha Fixture', 'barber', true, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111');

insert into public.appointments (id, client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id)
values
  ('60000000-0000-4000-8000-000000000001', 'Client Alpha', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, date_trunc('minute', now()) + interval '7 days', date_trunc('minute', now()) + interval '7 days 30 minutes', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('60000000-0000-4000-8000-000000000002', 'Client Beta', '0000000000', '22222222-2222-4222-8222-222222222222', 'Barber Beta', '44444444-4444-4444-8444-444444444444', 'Service Beta', 55, date_trunc('minute', now()) + interval '8 days', date_trunc('minute', now()) + interval '8 days 30 minutes', 'scheduled', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'),
  ('60000000-0000-4000-8000-000000000003', 'Client Alpha Two', '0000000000', '55555555-5555-4555-8555-555555555555', 'Barber Alpha Two', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, date_trunc('minute', now()) + interval '9 days', date_trunc('minute', now()) + interval '9 days 30 minutes', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaa0000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.barbers where barbershop_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 2::bigint, 'Owner A reads Tenant A barbers');
select is((select count(*) from public.barbers where barbershop_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 0::bigint, 'Owner A cannot read Tenant B barbers');
select is((select count(*) from public.services where barbershop_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 1::bigint, 'Owner A reads Tenant A services');
select is((select count(*) from public.services where barbershop_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 0::bigint, 'Owner A cannot read Tenant B services');
select results_eq($test$update public.services set price = 99 where id = '44444444-4444-4444-8444-444444444444' returning 1$test$, array[]::integer[], 'Owner A cannot update Tenant B');
select results_eq($test$delete from public.services where id = '44444444-4444-4444-8444-444444444444' returning 1$test$, array[]::integer[], 'Owner A cannot delete Tenant B');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"bbbb0000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.barbers where barbershop_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 1::bigint, 'Owner B reads Tenant B barbers');
select is((select count(*) from public.barbers where barbershop_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 0::bigint, 'Owner B cannot read Tenant A barbers');
select is((select count(*) from public.services where barbershop_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 1::bigint, 'Owner B reads Tenant B services');
select is((select count(*) from public.services where barbershop_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 0::bigint, 'Owner B cannot read Tenant A services');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaa0000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*) from public.appointments where id = '60000000-0000-4000-8000-000000000001'), 1::bigint, 'Barber A reads own appointment');
select is((select count(*) from public.appointments where id = '60000000-0000-4000-8000-000000000002'), 0::bigint, 'Barber A cannot read Tenant B appointment');
select is((select count(*) from public.appointments where id = '60000000-0000-4000-8000-000000000003'), 0::bigint, 'Barber A cannot read another barber appointment');
select results_eq($test$update public.appointments set notes = 'Own update' where id = '60000000-0000-4000-8000-000000000001' returning 1$test$, array[1], 'Barber A updates own appointment');
select results_eq($test$update public.appointments set notes = 'Blocked' where id = '60000000-0000-4000-8000-000000000002' returning 1$test$, array[]::integer[], 'Barber A cannot update Tenant B appointment');
select results_eq($test$update public.appointments set notes = 'Blocked' where id = '60000000-0000-4000-8000-000000000003' returning 1$test$, array[]::integer[], 'Barber A cannot update another barber appointment');

reset role;
select throws_ok($test$insert into public.appointments (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id) values ('Cross Barber', '0000000000', '22222222-2222-4222-8222-222222222222', 'Barber Beta', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, now() + interval '10 days', now() + interval '10 days 30 minutes', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$test$, '23503'::char(5), null, 'cross-tenant barber FK rejects appointment');
select throws_ok($test$insert into public.appointments (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id) values ('Cross Service', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '44444444-4444-4444-8444-444444444444', 'Service Beta', 55, now() + interval '11 days', now() + interval '11 days 30 minutes', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$test$, '23503'::char(5), null, 'cross-tenant service FK rejects appointment');
select throws_ok($test$insert into public.profiles (id, display_name, role, active, barbershop_id, barber_id) values ('aaaa0000-0000-4000-8000-000000000003', 'Cross Profile', 'barber', true, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '22222222-2222-4222-8222-222222222222')$test$, '23503'::char(5), null, 'cross-tenant barber FK rejects profile');

select lives_ok($test$insert into public.appointments (id, client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id) values ('70000000-0000-4000-8000-000000000001', 'Conflict Base', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, date_trunc('minute', now()) + interval '20 days', date_trunc('minute', now()) + interval '20 days 30 minutes', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$test$, 'first active slot is accepted');
select throws_ok($test$insert into public.appointments (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id) values ('Overlap', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, date_trunc('minute', now()) + interval '20 days 10 minutes', date_trunc('minute', now()) + interval '20 days 40 minutes', 'confirmed', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$test$, '23P01'::char(5), null, 'active overlap is rejected');
select ok(exists(select 1 from pg_constraint where conrelid = 'public.appointments'::regclass and conname = 'appointments_no_overlap'), 'exclusion constraint is versioned');
select ok(exists(select 1 from pg_indexes where schemaname = 'public' and indexname = 'appointments_unique_active_barbershop_barber_start'), 'active slot unique index is versioned');
select lives_ok($test$insert into public.appointments (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id) values ('Cancelled Overlap', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, date_trunc('minute', now()) + interval '20 days 10 minutes', date_trunc('minute', now()) + interval '20 days 40 minutes', 'cancelled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$test$, 'cancelled overlap follows exclusion predicate');
select throws_ok($test$insert into public.appointments (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id) values ('Completed Exact', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, date_trunc('minute', now()) + interval '20 days', date_trunc('minute', now()) + interval '20 days 30 minutes', 'completed', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$test$, '23505'::char(5), null, 'completed exact start follows unique index predicate');

set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';
select throws_ok('select * from public.appointments', '42501'::char(5), null, 'anon direct select is denied');
select throws_ok($test$insert into public.appointments (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id) values ('Blocked Direct', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, now() + interval '29 days', now() + interval '29 days 30 minutes', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$test$, '42501'::char(5), null, 'anon direct insert is denied');
select lives_ok($test$select public.create_public_appointment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Public Fixture', '0000000000', date_trunc('minute', now()) + interval '30 days', date_trunc('minute', now()) + interval '30 days 30 minutes', null)$test$, 'anon creates through RPC');

reset role;
select is((select status from public.appointments where client_name = 'Public Fixture'), 'scheduled', 'public RPC creates scheduled status');

set local role anon;
select throws_ok($test$select public.create_public_appointment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Public Conflict', '0000000000', date_trunc('minute', now()) + interval '30 days', date_trunc('minute', now()) + interval '30 days 30 minutes', null)$test$, 'P0001'::char(5), 'PUBLIC_APPOINTMENT_SLOT_CONFLICT', 'public RPC normalizes slot conflicts');
select throws_ok($test$select public.create_public_appointment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', 'Cross Tenant', '0000000000', date_trunc('minute', now()) + interval '31 days', date_trunc('minute', now()) + interval '31 days 30 minutes', null)$test$, 'P0001'::char(5), 'PUBLIC_APPOINTMENT_INVALID_BARBER', 'public RPC rejects cross-tenant barber');
select ok((select count(*) > 0 from public.get_public_appointment_slots('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')), 'anon reads occupied slots through RPC');
select ok(position('client_name' in lower(pg_get_function_result('public.get_public_appointment_slots(uuid)'::regprocedure))) = 0 and position('client_phone' in lower(pg_get_function_result('public.get_public_appointment_slots(uuid)'::regprocedure))) = 0 and position('financial' in lower(pg_get_function_result('public.get_public_appointment_slots(uuid)'::regprocedure))) = 0, 'slots RPC result excludes personal and financial fields');
select is((select count(*) from public.get_public_appointment_slots('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') where barbershop_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 0::bigint, 'slots RPC remains tenant scoped');

select * from finish();
rollback;
