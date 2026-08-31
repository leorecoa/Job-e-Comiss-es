begin;

create extension if not exists pgtap with schema extensions;
select plan(230);

select is((select count(*) from public.barbershops), 2::bigint, 'seed creates exactly two tenants');
select is((select count(distinct slug) from public.barbershops), 2::bigint, 'tenant slugs are distinct');
select is((select count(*) from public.barbershops bs where not exists (select 1 from public.barbers b where b.barbershop_id = bs.id and b.active)), 0::bigint, 'each tenant has an active barber');
select is((select count(*) from public.barbershops bs where not exists (select 1 from public.services s where s.barbershop_id = bs.id and s.active)), 0::bigint, 'each tenant has an active service');
select is((select count(*) from public.barbers b full join public.services s on s.barbershop_id = b.barbershop_id where b.barbershop_id is null or s.barbershop_id is null), 0::bigint, 'seed relationships stay inside their tenants');

select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('appointments', 'barbers', 'barbershops', 'profiles', 'services') and c.relrowsecurity), 5::bigint, 'RLS is enabled on all application tables');
select ok(not exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'appointments' and policyname = 'appointments_public_insert_scheduled'), 'legacy public insert policy is absent');
select ok(not has_table_privilege('anon', 'public.appointments', 'select'), 'anon has no direct appointments select');
select ok(not has_table_privilege('anon', 'public.appointments', 'insert'), 'anon has no direct appointments insert');
select ok(not has_table_privilege('authenticated', 'public.appointments', 'select'), 'authenticated has no direct appointments select');
select ok(not has_table_privilege('authenticated', 'public.appointments', 'update'), 'authenticated has no direct appointments update');
select ok(not has_table_privilege('authenticated', 'public.appointments', 'delete'), 'authenticated has no direct appointments delete');
select ok(not exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'appointments' and policyname = 'appointments_owner_delete_own_barbershop'), 'owner appointment delete policy is absent');
select ok(has_function_privilege('authenticated', 'public.get_internal_appointments()', 'execute'), 'authenticated executes internal appointment read RPC');
select ok(has_function_privilege('authenticated', 'public.update_owner_appointment(uuid,text,text,uuid,text,uuid,text,numeric,numeric,timestamptz,timestamptz,text,text)', 'execute'), 'authenticated executes owner appointment update RPC');
select ok(not has_function_privilege('anon', 'public.get_internal_appointments()', 'execute'), 'anon cannot execute internal appointment read RPC');
select ok(not has_function_privilege('anon', 'public.update_owner_appointment(uuid,text,text,uuid,text,uuid,text,numeric,numeric,timestamptz,timestamptz,text,text)', 'execute'), 'anon cannot execute owner appointment update RPC');
select ok(not has_function_privilege('service_role', 'public.get_internal_appointments()', 'execute'), 'service role has no unnecessary internal appointment read execute');
select ok(not has_function_privilege('service_role', 'public.update_owner_appointment(uuid,text,text,uuid,text,uuid,text,numeric,numeric,timestamptz,timestamptz,text,text)', 'execute'), 'service role has no unnecessary owner appointment update execute');
select ok(not exists(select 1 from information_schema.routine_privileges where routine_schema = 'public' and routine_name in ('get_internal_appointments', 'update_owner_appointment') and grantee = 'PUBLIC' and privilege_type = 'EXECUTE'), 'PUBLIC cannot execute internal appointment RPCs');
select is((select count(*) from pg_proc where oid in ('public.get_internal_appointments()'::regprocedure, 'public.update_owner_appointment(uuid,text,text,uuid,text,uuid,text,numeric,numeric,timestamptz,timestamptz,text,text)'::regprocedure) and prosecdef), 2::bigint, 'internal appointment RPCs are security definer');
select is((select count(*) from pg_proc where oid in ('public.get_internal_appointments()'::regprocedure, 'public.update_owner_appointment(uuid,text,text,uuid,text,uuid,text,numeric,numeric,timestamptz,timestamptz,text,text)'::regprocedure) and proconfig = array['search_path=pg_catalog']), 2::bigint, 'internal appointment RPCs keep controlled search paths');
select is(pg_get_function_result('public.get_internal_appointments()'::regprocedure), 'TABLE(viewer_role text, id uuid, barbershop_id uuid, client_name text, client_phone text, barber_id uuid, barber_name text, service_id uuid, service_type text, service_value numeric, commission_rate numeric, start_at timestamp with time zone, end_at timestamp with time zone, status text, notes text, financial_record_id text, created_at timestamp with time zone, updated_at timestamp with time zone)', 'internal appointment read signature is explicit');
select ok(not has_function_privilege('anon', 'public.create_public_appointment(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text)', 'execute'), 'anon cannot bypass the creation proxy');
select is((select pg_get_function_identity_arguments(p.oid) from pg_proc p where p.oid = 'public.create_public_appointment(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text)'::regprocedure), 'p_barbershop_id uuid, p_barber_id uuid, p_service_id uuid, p_client_name text, p_client_phone text, p_start_at timestamp with time zone, p_end_at timestamp with time zone, p_notes text', 'appointment creation RPC signature remains exact');
select is(pg_get_function_result('public.create_public_appointment(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text)'::regprocedure), 'uuid', 'appointment creation RPC still returns uuid');
select is((select prosecdef from pg_proc where oid = 'public.create_public_appointment(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text)'::regprocedure), true, 'appointment creation RPC remains security definer');
select is((select proconfig from pg_proc where oid = 'public.create_public_appointment(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text)'::regprocedure), array['search_path=pg_catalog'], 'appointment creation RPC keeps controlled search path');
select ok(not has_function_privilege('authenticated', 'public.create_public_appointment(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text)', 'execute'), 'authenticated cannot bypass the creation proxy');
select ok(has_function_privilege('service_role', 'public.create_public_appointment(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text)', 'execute'), 'proxy credential can execute appointment creation RPC');
select is((select count(*) from pg_indexes where schemaname = 'public' and indexname in ('idx_appointments_public_phone_created_at', 'idx_appointments_public_phone_active_start')), 2::bigint, 'public booking abuse query indexes are versioned');
select ok(position('pg_advisory_xact_lock' in pg_get_functiondef('public.create_public_appointment(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text)'::regprocedure)) > 0, 'appointment creation RPC serializes tenant and phone attempts');
select ok(not has_function_privilege('anon', 'public.get_public_appointment_slots(uuid)', 'execute'), 'anon cannot bypass the slots proxy');
select ok(not exists(select 1 from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'create_public_appointment' and grantee = 'PUBLIC' and privilege_type = 'EXECUTE'), 'PUBLIC cannot execute creation RPC');
select ok(not exists(select 1 from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'get_public_appointment_slots' and grantee = 'PUBLIC' and privilege_type = 'EXECUTE'), 'PUBLIC cannot execute slots RPC');
select is(to_regclass('public.public_appointment_slots'), null::regclass, 'legacy public slots view is absent');
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'public_appointment_slots' and c.relkind in ('v', 'm')), 0::bigint, 'no legacy public slots view remains in pg_catalog');
select is((select count(*) from information_schema.table_privileges where table_schema = 'public' and table_name = 'public_appointment_slots'), 0::bigint, 'no legacy public slots grants remain');
select ok(to_regprocedure('public.get_public_appointment_slots(uuid)') is not null, 'public slots RPC exists with uuid input');
select is(pg_get_function_result('public.get_public_appointment_slots(uuid)'::regprocedure), 'TABLE(barber_id uuid, barber_name text, start_at timestamp with time zone, end_at timestamp with time zone, status text, barbershop_id uuid)', 'public slots RPC result signature remains exact');
select is((select prosecdef from pg_proc where oid = 'public.get_public_appointment_slots(uuid)'::regprocedure), true, 'public slots RPC remains security definer');
select is((select proconfig from pg_proc where oid = 'public.get_public_appointment_slots(uuid)'::regprocedure), array['search_path=pg_catalog'], 'public slots RPC keeps controlled search path');
select ok(not has_function_privilege('authenticated', 'public.get_public_appointment_slots(uuid)', 'execute'), 'authenticated cannot bypass the slots proxy');
select ok(not has_function_privilege('service_role', 'public.get_public_appointment_slots(uuid)', 'execute'), 'proxy credential cannot bypass the slug-scoped slots RPC');
select ok(to_regprocedure('public.get_public_appointment_slots_by_slug(text)') is not null, 'proxy slots RPC exists with slug input');
select is(pg_get_function_result('public.get_public_appointment_slots_by_slug(text)'::regprocedure), 'TABLE(barber_id uuid, barber_name text, start_at timestamp with time zone, end_at timestamp with time zone, status text)', 'proxy slots RPC exposes only the minimal projection');
select is((select prosecdef from pg_proc where oid = 'public.get_public_appointment_slots_by_slug(text)'::regprocedure), true, 'proxy slots RPC is security definer');
select is((select proconfig from pg_proc where oid = 'public.get_public_appointment_slots_by_slug(text)'::regprocedure), array['search_path=pg_catalog'], 'proxy slots RPC keeps controlled search path');
select ok(has_function_privilege('service_role', 'public.get_public_appointment_slots_by_slug(text)', 'execute'), 'proxy credential can execute slug slots RPC');
select ok(not has_function_privilege('anon', 'public.get_public_appointment_slots_by_slug(text)', 'execute') and not has_function_privilege('authenticated', 'public.get_public_appointment_slots_by_slug(text)', 'execute'), 'browser roles cannot execute slug slots RPC');
select ok(not exists(select 1 from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'get_public_appointment_slots_by_slug' and grantee = 'PUBLIC' and privilege_type = 'EXECUTE'), 'PUBLIC cannot execute slug slots RPC');

select ok(not exists(select 1 from information_schema.table_privileges where table_schema = 'public' and table_name = 'profiles' and grantee = 'PUBLIC'), 'PUBLIC has no direct profiles privileges');
select ok(not has_table_privilege('anon', 'public.profiles', 'select') and not has_table_privilege('anon', 'public.profiles', 'insert') and not has_table_privilege('anon', 'public.profiles', 'update') and not has_table_privilege('anon', 'public.profiles', 'delete') and not has_table_privilege('anon', 'public.profiles', 'truncate') and not has_table_privilege('anon', 'public.profiles', 'references') and not has_table_privilege('anon', 'public.profiles', 'trigger'), 'anon has no direct profiles privileges');
select ok(has_table_privilege('authenticated', 'public.profiles', 'select'), 'authenticated can select profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'insert'), 'authenticated cannot insert profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'update'), 'authenticated cannot update profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'delete'), 'authenticated cannot delete profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'truncate'), 'authenticated cannot truncate profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'references'), 'authenticated has no profiles references privilege');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'trigger'), 'authenticated has no profiles trigger privilege');
select ok(has_table_privilege('service_role', 'public.profiles', 'select') and has_table_privilege('service_role', 'public.profiles', 'insert') and has_table_privilege('service_role', 'public.profiles', 'update') and has_table_privilege('service_role', 'public.profiles', 'delete') and has_table_privilege('service_role', 'public.profiles', 'truncate') and has_table_privilege('service_role', 'public.profiles', 'references') and has_table_privilege('service_role', 'public.profiles', 'trigger'), 'service_role retains all profiles privileges');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles RLS remains enabled');
select is((select count(*) from pg_policies where schemaname = 'public' and tablename = 'profiles'), 2::bigint, 'only profile select policies remain');
select ok(has_function_privilege('authenticated', 'public.link_barber_profile_by_email(text,uuid)', 'execute'), 'authenticated can execute profile linking RPC');

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

select is((select count(*) from storage.buckets where id = 'barbershop-branding'), 1::bigint, 'branding bucket exists');
select is((select public from storage.buckets where id = 'barbershop-branding'), true, 'branding bucket remains public');
select is((select file_size_limit from storage.buckets where id = 'barbershop-branding'), 5242880::bigint, 'branding bucket keeps the 5 MB limit');
select is((select allowed_mime_types from storage.buckets where id = 'barbershop-branding'), array['image/png', 'image/jpeg', 'image/webp']::text[], 'branding bucket keeps the exact MIME types');
select is((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and (qual like '%barbershop-branding%' or with_check like '%barbershop-branding%')), 4::bigint, 'branding policies are consolidated to four');
select is((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('storage_branding_owner_delete', 'storage_branding_owner_insert', 'storage_branding_owner_update')), 0::bigint, 'duplicate branding policies are absent');
select is((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('Owner delete own barbershop branding', 'Owner insert own barbershop branding', 'Owner update own barbershop branding', 'Owner select own barbershop branding for upsert')), 4::bigint, 'canonical branding policies remain present');
select is((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owner delete own barbershop branding' and permissive = 'PERMISSIVE' and roles = array['authenticated']::name[] and cmd = 'DELETE' and qual = $$((bucket_id = 'barbershop-branding'::text) AND ((storage.foldername(name))[1] = (private.current_user_barbershop_id())::text) AND (private.current_user_role() = 'owner'::text))$$ and with_check is null), 1::bigint, 'canonical branding delete policy is unchanged');
select is((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owner insert own barbershop branding' and permissive = 'PERMISSIVE' and roles = array['authenticated']::name[] and cmd = 'INSERT' and qual is null and with_check = $$((bucket_id = 'barbershop-branding'::text) AND ((storage.foldername(name))[1] = (private.current_user_barbershop_id())::text) AND (private.current_user_role() = 'owner'::text))$$), 1::bigint, 'canonical branding insert policy is unchanged');
select is((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owner update own barbershop branding' and permissive = 'PERMISSIVE' and roles = array['authenticated']::name[] and cmd = 'UPDATE' and qual = $$((bucket_id = 'barbershop-branding'::text) AND ((storage.foldername(name))[1] = (private.current_user_barbershop_id())::text) AND (private.current_user_role() = 'owner'::text))$$ and with_check = $$((bucket_id = 'barbershop-branding'::text) AND ((storage.foldername(name))[1] = (private.current_user_barbershop_id())::text) AND (private.current_user_role() = 'owner'::text))$$), 1::bigint, 'canonical branding update policy is unchanged');
select ok(not exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read barbershop branding'), 'public branding read policy is absent');
select is((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Owner select own barbershop branding for upsert' and permissive = 'PERMISSIVE' and roles = array['authenticated']::name[] and cmd = 'SELECT' and qual like '%storage.allow_any_operation%' and qual like '%object.get_authenticated_info%' and qual like '%object.get_authenticated%' and qual like '%object.upload%' and qual like '%object.delete_many%' and qual like '%private.current_user_barbershop_id%' and qual like '%private.current_user_role%'), 1::bigint, 'owner branding select is authenticated, tenant-scoped, and operation-aware');
select is((select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT' and (qual like '%barbershop-branding%' or with_check like '%barbershop-branding%') and (roles && array['anon', 'public']::name[] or qual not like '%storage.allow_any_operation%')), 0::bigint, 'no broad branding SELECT policy remains');

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('aaaa0000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-alpha@example.test', now(), now()),
  ('bbbb0000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner-beta@example.test', now(), now()),
  ('aaaa0000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'barber-alpha@example.test', now(), now()),
  ('aaaa0000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'cross-profile@example.test', now(), now()),
  ('aaaa0000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'self-profile@example.test', now(), now());

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

insert into storage.objects (bucket_id, name, owner_id, metadata)
values
  ('barbershop-branding', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/owner-source.png', 'aaaa0000-0000-4000-8000-000000000001', '{}'::jsonb),
  ('barbershop-branding', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/delete-source.png', 'aaaa0000-0000-4000-8000-000000000001', '{}'::jsonb),
  ('barbershop-branding', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2/owner-source.png', 'bbbb0000-0000-4000-8000-000000000001', '{}'::jsonb);

set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';
select is((select count(*) from storage.objects where bucket_id = 'barbershop-branding'), 0::bigint, 'anon cannot list public branding metadata');
select throws_ok($test$insert into storage.objects (bucket_id, name) values ('barbershop-branding', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/anon.png')$test$, '42501'::char(5), null, 'anon cannot insert branding objects');
select results_eq($test$update storage.objects set metadata = '{"blocked":true}'::jsonb where bucket_id = 'barbershop-branding' returning 1$test$, array[]::integer[], 'anon cannot update branding objects');
select ok(not exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE' and 'anon' = any(roles)), 'anon has no branding delete policy');

reset role;

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaa0000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from storage.objects where bucket_id = 'barbershop-branding'), 0::bigint, 'Owner A cannot list branding metadata without an allowed object operation');
select is((select count(*) from public.get_internal_appointments()), 2::bigint, 'Owner A reads all Tenant A appointments through RPC');
select is((select count(*) from public.get_internal_appointments() where barbershop_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 0::bigint, 'Owner A reads no Tenant B appointments through RPC');
select is((select client_phone from public.get_internal_appointments() where id = '60000000-0000-4000-8000-000000000001'), '0000000000', 'owner contract includes client phone');
select is((select service_value from public.get_internal_appointments() where id = '60000000-0000-4000-8000-000000000001'), 40::numeric, 'owner contract includes service value');
select lives_ok($test$select * from public.update_owner_appointment('60000000-0000-4000-8000-000000000001', 'Client Alpha', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, null, date_trunc('minute', now()) + interval '7 days', date_trunc('minute', now()) + interval '7 days 30 minutes', 'confirmed', 'Owner update')$test$, 'owner updates own tenant appointment through RPC');
select throws_ok($test$delete from public.appointments where id = '60000000-0000-4000-8000-000000000001'$test$, '42501'::char(5), null, 'owner cannot delete appointments directly');
select is((select count(*) from public.get_internal_appointments() where id = '60000000-0000-4000-8000-000000000001'), 1::bigint, 'owner appointment remains after direct delete attempt');
select throws_ok($test$select * from public.update_owner_appointment('60000000-0000-4000-8000-000000000002', 'Client Beta', '0000000000', '22222222-2222-4222-8222-222222222222', 'Barber Beta', '44444444-4444-4444-8444-444444444444', 'Service Beta', 55, null, date_trunc('minute', now()) + interval '8 days', date_trunc('minute', now()) + interval '8 days 30 minutes', 'confirmed', null)$test$, 'P0001'::char(5), 'OWNER_APPOINTMENT_INVALID_BARBER', 'owner update cannot target another tenant');
select is((select count(*) from public.barbers where barbershop_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 2::bigint, 'Owner A reads Tenant A barbers');
select is((select count(*) from public.barbers where barbershop_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 0::bigint, 'Owner A cannot read Tenant B barbers');
select is((select count(*) from public.services where barbershop_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 1::bigint, 'Owner A reads Tenant A services');
select is((select count(*) from public.services where barbershop_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 0::bigint, 'Owner A cannot read Tenant B services');
select results_eq($test$update public.services set price = 99 where id = '44444444-4444-4444-8444-444444444444' returning 1$test$, array[]::integer[], 'Owner A cannot update Tenant B');
select results_eq($test$delete from public.services where id = '44444444-4444-4444-8444-444444444444' returning 1$test$, array[]::integer[], 'Owner A cannot delete Tenant B');
select is((select count(*) from public.profiles where id = 'aaaa0000-0000-4000-8000-000000000001'), 1::bigint, 'Owner A reads own profile');
select is((select count(*) from public.profiles where barbershop_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 0::bigint, 'Owner A cannot read Tenant B profiles');
select throws_ok($test$update public.profiles set display_name = 'Blocked' where id = 'bbbb0000-0000-4000-8000-000000000001'$test$, '42501'::char(5), null, 'Owner A cannot update Tenant B profile');
select throws_ok($test$delete from public.profiles where id = 'bbbb0000-0000-4000-8000-000000000001'$test$, '42501'::char(5), null, 'profile delete is unavailable to authenticated owners');
select throws_ok($test$insert into public.profiles (id, display_name, role, active, barbershop_id, barber_id) values ('aaaa0000-0000-4000-8000-000000000003', 'Cross Tenant Profile', 'owner', true, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', null)$test$, '42501'::char(5), null, 'Owner A cannot insert a Tenant B profile');
select lives_ok($test$insert into storage.objects (bucket_id, name, owner_id) values ('barbershop-branding', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/upload.png', 'aaaa0000-0000-4000-8000-000000000001')$test$, 'Owner A inserts branding in Tenant Alpha directory');
select ok((storage.foldername('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/owner-source.png'))[1] = private.current_user_barbershop_id()::text and private.current_user_role() = 'owner', 'Owner A update policy accepts Tenant Alpha directory');
select ok((storage.foldername('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/delete-source.png'))[1] = private.current_user_barbershop_id()::text and private.current_user_role() = 'owner', 'Owner A delete policy accepts Tenant Alpha directory');
select throws_ok($test$insert into storage.objects (bucket_id, name, owner_id) values ('barbershop-branding', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2/cross-insert.png', 'aaaa0000-0000-4000-8000-000000000001')$test$, '42501'::char(5), null, 'Owner A cannot insert branding in Tenant Beta directory');
select results_eq($test$update storage.objects set metadata = '{"blocked":true}'::jsonb where bucket_id = 'barbershop-branding' and name = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2/owner-source.png' returning 1$test$, array[]::integer[], 'Owner A cannot update Tenant Beta branding');
select ok(not ((storage.foldername('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2/owner-source.png'))[1] = private.current_user_barbershop_id()::text and private.current_user_role() = 'owner'), 'Owner A delete policy rejects Tenant Beta directory');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"bbbb0000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*) from public.barbers where barbershop_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 1::bigint, 'Owner B reads Tenant B barbers');
select is((select count(*) from public.barbers where barbershop_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 0::bigint, 'Owner B cannot read Tenant A barbers');
select is((select count(*) from public.services where barbershop_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 1::bigint, 'Owner B reads Tenant B services');
select is((select count(*) from public.services where barbershop_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 0::bigint, 'Owner B cannot read Tenant A services');
select is((select count(*) from public.profiles where id = 'bbbb0000-0000-4000-8000-000000000001'), 1::bigint, 'Owner B reads own profile');
select is((select count(*) from public.profiles where barbershop_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 0::bigint, 'Owner B cannot read Tenant A profiles');
select throws_ok($test$insert into storage.objects (bucket_id, name, owner_id) values ('barbershop-branding', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/cross-insert.png', 'bbbb0000-0000-4000-8000-000000000001')$test$, '42501'::char(5), null, 'Owner B cannot insert branding in Tenant Alpha directory');
select results_eq($test$update storage.objects set metadata = '{"blocked":true}'::jsonb where bucket_id = 'barbershop-branding' and name = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/owner-source.png' returning 1$test$, array[]::integer[], 'Owner B cannot update Tenant Alpha branding');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaa0000-0000-4000-8000-000000000002","role":"authenticated"}';
select ok(not exists(select 1 from pg_policies where schemaname = 'public' and tablename = 'appointments' and policyname = 'appointments_barber_update_own'), 'barber appointment update policy is absent');
select is((select count(*) from public.get_internal_appointments() where id = '60000000-0000-4000-8000-000000000001'), 1::bigint, 'Barber A reads own appointment through RPC');
select is((select count(*) from public.get_internal_appointments() where id = '60000000-0000-4000-8000-000000000002'), 0::bigint, 'Barber A cannot read Tenant B appointment');
select is((select count(*) from public.get_internal_appointments() where id = '60000000-0000-4000-8000-000000000003'), 0::bigint, 'Barber A cannot read another barber appointment');
select ok((select client_phone is null from public.get_internal_appointments() where id = '60000000-0000-4000-8000-000000000001'), 'barber contract excludes client phone');
select ok((select notes is null from public.get_internal_appointments() where id = '60000000-0000-4000-8000-000000000001'), 'barber contract excludes notes');
select ok((select service_value is null from public.get_internal_appointments() where id = '60000000-0000-4000-8000-000000000001'), 'barber contract excludes service value');
select ok((select commission_rate is null from public.get_internal_appointments() where id = '60000000-0000-4000-8000-000000000001'), 'barber contract excludes commission rate');
select ok((select financial_record_id is null from public.get_internal_appointments() where id = '60000000-0000-4000-8000-000000000001'), 'barber contract excludes financial record id');
select throws_ok($test$update public.appointments set notes = 'Own update' where id = '60000000-0000-4000-8000-000000000001'$test$, '42501'::char(5), null, 'Barber A cannot update own appointment');
select throws_ok($test$update public.appointments set notes = 'Blocked' where id = '60000000-0000-4000-8000-000000000002'$test$, '42501'::char(5), null, 'Barber A cannot update Tenant B appointment');
select throws_ok($test$update public.appointments set notes = 'Blocked' where id = '60000000-0000-4000-8000-000000000003'$test$, '42501'::char(5), null, 'Barber A cannot update another barber appointment');
select is((select count(*) from public.profiles where id = 'aaaa0000-0000-4000-8000-000000000002'), 1::bigint, 'Barber A reads own profile');
select is((select count(*) from public.profiles where barbershop_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 0::bigint, 'Barber A cannot read Tenant B profiles');
select is((select count(*) from storage.objects where bucket_id = 'barbershop-branding'), 0::bigint, 'Barber A cannot list branding metadata');
select throws_ok($test$insert into storage.objects (bucket_id, name, owner_id) values ('barbershop-branding', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/barber.png', 'aaaa0000-0000-4000-8000-000000000002')$test$, '42501'::char(5), null, 'Barber A cannot insert branding objects');
select results_eq($test$update storage.objects set metadata = '{"blocked":true}'::jsonb where bucket_id = 'barbershop-branding' returning 1$test$, array[]::integer[], 'Barber A cannot update branding objects');
select ok(private.current_user_role() <> 'owner', 'Barber A does not satisfy branding delete policy');
select lives_ok($test$insert into public.appointments (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id) values ('Barber Scheduled', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, now() + interval '70 days', now() + interval '70 days 30 minutes', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$test$, 'barber inserts own scheduled appointment');
select throws_ok($test$insert into public.appointments (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id) values ('Barber Confirmed', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, now() + interval '71 days', now() + interval '71 days 30 minutes', 'confirmed', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$test$, '42501'::char(5), null, 'barber cannot insert confirmed appointment');
select throws_ok($test$insert into public.appointments (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id) values ('Barber Completed', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, now() + interval '72 days', now() + interval '72 days 30 minutes', 'completed', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$test$, '42501'::char(5), null, 'barber cannot insert completed appointment');
select throws_ok($test$insert into public.appointments (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id) values ('Barber Cancelled', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, now() + interval '73 days', now() + interval '73 days 30 minutes', 'cancelled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$test$, '42501'::char(5), null, 'barber cannot insert cancelled appointment');
select throws_ok($test$insert into public.appointments (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id) values ('Barber No Show', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, now() + interval '74 days', now() + interval '74 days 30 minutes', 'no_show', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$test$, '42501'::char(5), null, 'barber cannot insert no-show appointment');
select throws_ok($test$insert into public.appointments (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id, financial_record_id) values ('Barber Financial', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, now() + interval '75 days', now() + interval '75 days 30 minutes', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'forbidden')$test$, '42501'::char(5), null, 'barber cannot insert appointment linked to finance');
select throws_ok($test$insert into public.appointments (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id) values ('Other Barber', '0000000000', '55555555-5555-4555-8555-555555555555', 'Barber Alpha Two', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, now() + interval '76 days', now() + interval '76 days 30 minutes', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')$test$, '42501'::char(5), null, 'barber cannot insert for another barber');
select throws_ok($test$insert into public.appointments (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id) values ('Other Tenant', '0000000000', '22222222-2222-4222-8222-222222222222', 'Barber Beta', '44444444-4444-4444-8444-444444444444', 'Service Beta', 55, now() + interval '77 days', now() + interval '77 days 30 minutes', 'scheduled', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2')$test$, '42501'::char(5), null, 'barber cannot insert in another tenant');
select throws_ok($test$delete from public.appointments where id = '60000000-0000-4000-8000-000000000001'$test$, '42501'::char(5), null, 'barber cannot delete appointments without direct SELECT privilege');
select is((select count(*) from public.get_internal_appointments() where id = '60000000-0000-4000-8000-000000000001'), 1::bigint, 'barber appointment remains after delete attempt');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaa0000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($test$insert into public.profiles (id, display_name, role, active, barbershop_id, barber_id) values ('aaaa0000-0000-4000-8000-000000000004', 'Self Profile', 'owner', true, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', null)$test$, '42501'::char(5), null, 'authenticated user cannot create an owner profile with an arbitrary tenant');
select is((select count(*) from public.profiles where id = 'aaaa0000-0000-4000-8000-000000000004'), 0::bigint, 'blocked direct onboarding leaves no profile');
select is((select count(*) from public.barbershops where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 0::bigint, 'profile without tenant cannot read a tenant before provisioning');

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
select throws_ok($test$select public.create_public_appointment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Blocked RPC', '(919) 111-1111', date_trunc('minute', now()) + interval '30 days', date_trunc('minute', now()) + interval '30 days 30 minutes', null)$test$, '42501'::char(5), null, 'anon cannot bypass creation proxy');

reset role;
set local role service_role;
select lives_ok($test$select public.create_public_appointment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Public Fixture', '(919) 111-1111', date_trunc('minute', now()) + interval '30 days', date_trunc('minute', now()) + interval '30 days 30 minutes', null)$test$, 'proxy credential creates through controlled RPC');
reset role;
select is((select status from public.appointments where client_name = 'Public Fixture'), 'scheduled', 'public RPC creates scheduled status');
select is((select client_phone from public.appointments where client_name = 'Public Fixture'), '9191111111', 'public RPC stores normalized phone digits');

set local role service_role;
select throws_ok($test$select public.create_public_appointment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Public Repeat', '9191111111', date_trunc('minute', now()) + interval '31 days', date_trunc('minute', now()) + interval '31 days 30 minutes', null)$test$, 'P0001'::char(5), 'PUBLIC_APPOINTMENT_RATE_LIMITED', 'public RPC rate limits the same tenant and phone for 60 seconds');
select lives_ok($test$select public.create_public_appointment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Other Phone', '9191111112', date_trunc('minute', now()) + interval '32 days', date_trunc('minute', now()) + interval '32 days 30 minutes', null)$test$, 'another phone is not rate limited');
select lives_ok($test$select public.create_public_appointment('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444', 'Other Tenant', '9191111111', date_trunc('minute', now()) + interval '33 days', date_trunc('minute', now()) + interval '33 days 30 minutes', null)$test$, 'same phone in another tenant is not rate limited');
select throws_ok($test$select public.create_public_appointment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Public Conflict', '9191111113', date_trunc('minute', now()) + interval '30 days', date_trunc('minute', now()) + interval '30 days 30 minutes', null)$test$, 'P0001'::char(5), 'PUBLIC_APPOINTMENT_SLOT_CONFLICT', 'public RPC normalizes slot conflicts');
select throws_ok($test$select public.create_public_appointment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', 'Cross Tenant', '0000000000', date_trunc('minute', now()) + interval '31 days', date_trunc('minute', now()) + interval '31 days 30 minutes', null)$test$, 'P0001'::char(5), 'PUBLIC_APPOINTMENT_INVALID_BARBER', 'public RPC rejects cross-tenant barber');

reset role;
insert into public.appointments (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id, created_at)
values
  ('Active Limit One', '9191111114', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, date_trunc('minute', now()) + interval '40 days', date_trunc('minute', now()) + interval '40 days 30 minutes', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', now() - interval '2 minutes'),
  ('Active Limit Two', '9191111114', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, date_trunc('minute', now()) + interval '41 days', date_trunc('minute', now()) + interval '41 days 30 minutes', 'confirmed', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', now() - interval '2 minutes'),
  ('Active Limit Three', '9191111114', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, date_trunc('minute', now()) + interval '42 days', date_trunc('minute', now()) + interval '42 days 30 minutes', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', now() - interval '2 minutes'),
  ('Ignored Cancelled', '9191111115', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, date_trunc('minute', now()) + interval '44 days', date_trunc('minute', now()) + interval '44 days 30 minutes', 'cancelled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', now() - interval '2 minutes'),
  ('Ignored Completed', '9191111115', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, date_trunc('minute', now()) + interval '45 days', date_trunc('minute', now()) + interval '45 days 30 minutes', 'completed', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', now() - interval '2 minutes'),
  ('Ignored No Show', '9191111115', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, date_trunc('minute', now()) + interval '46 days', date_trunc('minute', now()) + interval '46 days 30 minutes', 'no_show', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', now() - interval '2 minutes');

set local role service_role;
select throws_ok($test$select public.create_public_appointment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Active Limit Four', '9191111114', date_trunc('minute', now()) + interval '43 days', date_trunc('minute', now()) + interval '43 days 30 minutes', null)$test$, 'P0001'::char(5), 'PUBLIC_APPOINTMENT_ACTIVE_LIMIT', 'fourth future active appointment is blocked');
select lives_ok($test$select public.create_public_appointment('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Ignored Statuses Allowed', '9191111115', date_trunc('minute', now()) + interval '47 days', date_trunc('minute', now()) + interval '47 days 30 minutes', null)$test$, 'completed cancelled and no-show do not count toward active limit');
select ok((select count(*) > 0 from public.get_public_appointment_slots_by_slug('tenant-alpha')), 'proxy reads occupied slots through slug RPC');
select ok(position('client_name' in lower(pg_get_function_result('public.get_public_appointment_slots(uuid)'::regprocedure))) = 0 and position('client_phone' in lower(pg_get_function_result('public.get_public_appointment_slots(uuid)'::regprocedure))) = 0 and position('financial' in lower(pg_get_function_result('public.get_public_appointment_slots(uuid)'::regprocedure))) = 0, 'slots RPC result excludes personal and financial fields');
select is((select count(*) from public.get_public_appointment_slots_by_slug('tenant-alpha') slots join public.barbers b on b.id = slots.barber_id where b.barbershop_id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 0::bigint, 'slots RPC remains tenant scoped');

reset role;

select ok(to_regclass('public.financial_records') is not null, 'financial records table is versioned');
select ok((select relrowsecurity from pg_class where oid = 'public.financial_records'::regclass), 'financial records RLS is enabled');
select ok(has_table_privilege('authenticated', 'public.financial_records', 'select'), 'authenticated can read financial records through RLS');
select ok(not has_table_privilege('authenticated', 'public.financial_records', 'insert'), 'authenticated cannot insert financial records directly');
select ok(not has_table_privilege('anon', 'public.financial_records', 'select'), 'anon cannot read financial records');
select ok(not has_function_privilege('anon', 'public.complete_appointment_with_financial_record(uuid)', 'execute'), 'anon cannot execute financial completion RPC');
select ok(not exists(select 1 from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'complete_appointment_with_financial_record' and grantee = 'PUBLIC' and privilege_type = 'EXECUTE'), 'PUBLIC cannot execute financial completion RPC');
select ok(has_function_privilege('authenticated', 'public.complete_appointment_with_financial_record(uuid)', 'execute'), 'authenticated can execute financial completion RPC');
select is((select prosecdef from pg_proc where oid = 'public.complete_appointment_with_financial_record(uuid)'::regprocedure), true, 'financial completion RPC is security definer');
select is((select proconfig from pg_proc where oid = 'public.complete_appointment_with_financial_record(uuid)'::regprocedure), array['search_path=pg_catalog'], 'financial completion RPC has controlled search path');
select ok(exists(select 1 from pg_constraint where conrelid = 'public.financial_records'::regclass and conname = 'financial_records_appointment_key'), 'one financial record per appointment is enforced');
select ok(exists(select 1 from pg_constraint where conrelid = 'public.financial_records'::regclass and conname = 'financial_records_appointment_tenant_fkey'), 'financial appointment relationship is tenant scoped');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaa0000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($test$select * from public.complete_appointment_with_financial_record('60000000-0000-4000-8000-000000000001')$test$, 'owner completes own tenant appointment');
select is((select status from public.get_internal_appointments() where id = '60000000-0000-4000-8000-000000000001'), 'completed', 'completion updates appointment status');
select ok((select financial_record_id is not null from public.get_internal_appointments() where id = '60000000-0000-4000-8000-000000000001'), 'completion links financial record');
select is((select count(*) from public.financial_records where appointment_id = '60000000-0000-4000-8000-000000000001'), 1::bigint, 'completion creates exactly one financial record');
select is((select service_type from public.financial_records where appointment_id = '60000000-0000-4000-8000-000000000001'), 'Service Alpha', 'financial record preserves service type');
select is((select service_value from public.financial_records where appointment_id = '60000000-0000-4000-8000-000000000001'), 40.00::numeric, 'financial record preserves service value');
select is((select commission_rate from public.financial_records where appointment_id = '60000000-0000-4000-8000-000000000001'), (select commission_rate from public.services where id = '33333333-3333-4333-8333-333333333333'), 'financial record preserves the effective commission rate');
select ok((select commission_value = round(service_value * commission_rate / 100, 2) from public.financial_records where appointment_id = '60000000-0000-4000-8000-000000000001'), 'commission value is calculated in PostgreSQL');
select lives_ok($test$select * from public.complete_appointment_with_financial_record('60000000-0000-4000-8000-000000000001')$test$, 'repeated completion is idempotent');
select is((select count(*) from public.financial_records where appointment_id = '60000000-0000-4000-8000-000000000001'), 1::bigint, 'repeated completion does not duplicate financial record');
select throws_ok($test$select * from public.complete_appointment_with_financial_record('60000000-0000-4000-8000-000000000002')$test$, 'P0001'::char(5), 'FINANCIAL_COMPLETION_APPOINTMENT_NOT_FOUND', 'owner cannot complete cross-tenant appointment');

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaa0000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($test$select * from public.complete_appointment_with_financial_record('60000000-0000-4000-8000-000000000001')$test$, 'P0001'::char(5), 'FINANCIAL_COMPLETION_FORBIDDEN', 'barber cannot complete own appointment');
select throws_ok($test$select * from public.complete_appointment_with_financial_record('60000000-0000-4000-8000-000000000003')$test$, 'P0001'::char(5), 'FINANCIAL_COMPLETION_FORBIDDEN', 'barber cannot complete another barber appointment');
select is((select count(*) from public.financial_records), 1::bigint, 'barber reads only own financial records');

reset role;
insert into public.appointments (id, client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, commission_rate, start_at, end_at, status, barbershop_id)
values
  ('80000000-0000-4000-8000-000000000001', 'Cancelled Finance', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, 50, now() + interval '60 days', now() + interval '60 days 30 minutes', 'cancelled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('80000000-0000-4000-8000-000000000002', 'Repair Finance', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, 50, now() + interval '61 days', now() + interval '61 days 30 minutes', 'completed', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('80000000-0000-4000-8000-000000000003', 'Rollback Finance', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, 50, now() + interval '62 days', now() + interval '62 days 30 minutes', 'scheduled', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('80000000-0000-4000-8000-000000000004', 'No Show Finance', '0000000000', '11111111-1111-4111-8111-111111111111', 'Barber Alpha', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, 50, now() + interval '63 days', now() + interval '63 days 30 minutes', 'no_show', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaa0000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($test$select * from public.complete_appointment_with_financial_record('80000000-0000-4000-8000-000000000001')$test$, 'P0001'::char(5), 'FINANCIAL_COMPLETION_INVALID_STATUS', 'cancelled appointment cannot be completed');
select is((select count(*) from public.financial_records where appointment_id = '80000000-0000-4000-8000-000000000001'), 0::bigint, 'blocked status creates no financial record');
select is((select status from public.get_internal_appointments() where id = '80000000-0000-4000-8000-000000000001'), 'cancelled', 'blocked status remains unchanged');
select throws_ok($test$select * from public.complete_appointment_with_financial_record('80000000-0000-4000-8000-000000000004')$test$, 'P0001'::char(5), 'FINANCIAL_COMPLETION_INVALID_STATUS', 'no-show appointment cannot be completed');
select is((select count(*) from public.financial_records where appointment_id = '80000000-0000-4000-8000-000000000004'), 0::bigint, 'no-show creates no financial record');
select lives_ok($test$select * from public.complete_appointment_with_financial_record('80000000-0000-4000-8000-000000000002')$test$, 'completed appointment with null link can be repaired');
select ok((select financial_record_id is not null from public.get_internal_appointments() where id = '80000000-0000-4000-8000-000000000002'), 'repair fills financial record link');
select throws_ok($test$insert into public.financial_records (appointment_id, barbershop_id, barber_id, service_id, service_type, service_value, commission_rate, commission_value, completed_at) values ('80000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Service Alpha', 40, 50, 20, now())$test$, '42501'::char(5), null, 'authenticated cannot insert financial records directly');
select is((select count(*) from public.financial_records where barbershop_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 0::bigint, 'owner cannot read cross-tenant financial records');

reset role;
create function pg_temp.reject_rollback_financial_record() returns trigger language plpgsql as $$
begin
  if new.appointment_id = '80000000-0000-4000-8000-000000000003'::uuid then
    raise exception 'forced financial failure';
  end if;
  return new;
end;
$$;
create trigger test_reject_financial_record before insert on public.financial_records
for each row execute function pg_temp.reject_rollback_financial_record();
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"aaaa0000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($test$select * from public.complete_appointment_with_financial_record('80000000-0000-4000-8000-000000000003')$test$, 'P0001'::char(5), 'forced financial failure', 'financial insert failure aborts completion');
select is((select status from public.get_internal_appointments() where id = '80000000-0000-4000-8000-000000000003'), 'scheduled', 'financial failure rolls appointment status back');
select is((select count(*) from public.financial_records where appointment_id = '80000000-0000-4000-8000-000000000003'), 0::bigint, 'financial failure leaves no financial record');

reset role;
set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';
select throws_ok('select * from public.financial_records', '42501'::char(5), null, 'anon direct financial read is denied');

select * from finish();
rollback;
