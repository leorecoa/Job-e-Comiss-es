begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'barbershops' and column_name = 'operational_timezone' and is_nullable = 'YES' and column_default is null), 'operational timezone is nullable without default');
select is((select count(*) from public.barbershops where operational_timezone is not null), 0::bigint, 'existing tenants stay unconfigured');
select ok(not has_column_privilege('anon','public.barbershops','operational_timezone','select'), 'anon has no new read');
select ok(not has_column_privilege('anon','public.barbershops','operational_timezone','update'), 'anon has no update');
select ok(has_function_privilege('authenticated','public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text,text)','execute'), 'authenticated executes overload');
select ok(not has_function_privilege('anon','public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text,text)','execute'), 'anon cannot execute overload');
select ok(not has_function_privilege('service_role','public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text,text)','execute'), 'service role gains no execute');
select ok(not exists(select 1 from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'create_owner_barbershop' and grantee = 'PUBLIC' and privilege_type = 'EXECUTE'), 'PUBLIC gains no execute');
select ok((select prosecdef from pg_proc where oid = 'public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text,text)'::regprocedure), 'overload is security definer');
select is((select proconfig from pg_proc where oid = 'public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text,text)'::regprocedure), array['search_path=pg_catalog'], 'safe search path');

insert into auth.users (id, aud, role, email) values
('dddd0000-0000-4000-8000-000000000001','authenticated','authenticated','operational-owner@example.test'),
('dddd0000-0000-4000-8000-000000000002','authenticated','authenticated','operational-barber@example.test'),
('dddd0000-0000-4000-8000-000000000003','authenticated','authenticated','operational-new@example.test'),
('dddd0000-0000-4000-8000-000000000004','authenticated','authenticated','operational-invalid@example.test'),
('dddd0000-0000-4000-8000-000000000005','authenticated','authenticated','operational-both@example.test');
insert into public.profiles (id, role, active, barbershop_id, barber_id) values
('dddd0000-0000-4000-8000-000000000001','owner',true,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',null),
('dddd0000-0000-4000-8000-000000000002','barber',true,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111'),
('dddd0000-0000-4000-8000-000000000003','owner',true,null,null),
('dddd0000-0000-4000-8000-000000000004','owner',true,null,null),
('dddd0000-0000-4000-8000-000000000005','owner',true,null,null);
update public.barbershops set financial_timezone = 'UTC' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"dddd0000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$update public.barbershops set operational_timezone = null where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$$, 'accepts explicit NULL');
select lives_ok($$update public.barbershops set operational_timezone = 'America/Recife' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$$, 'owner saves Recife');
select is((select operational_timezone from public.barbershops where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'America/Recife', 'reads Recife');
select lives_ok($$update public.barbershops set operational_timezone = 'America/New_York' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$$, 'owner changes timezone');
select is((select operational_timezone from public.barbershops where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'America/New_York', 'reads New York');
select is((select financial_timezone from public.barbershops where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'UTC', 'financial timezone is independent');
select throws_ok($$update public.barbershops set operational_timezone = 'Not/AZone' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$$, '22023', 'INVALID_OPERATIONAL_TIMEZONE', 'rejects invalid zone');
select throws_ok($$update public.barbershops set operational_timezone = '+03:00' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$$, '22023', 'INVALID_OPERATIONAL_TIMEZONE', 'rejects raw offset');
select results_eq($$with changed as (update public.barbershops set operational_timezone = 'America/Recife' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2' returning id) select count(*) from changed$$, $$select 0::bigint$$, 'owner cannot change another tenant');
set local "request.jwt.claims" = '{"sub":"dddd0000-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq($$with changed as (update public.barbershops set operational_timezone = 'America/Recife' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' returning id) select count(*) from changed$$, $$select 0::bigint$$, 'barber cannot change timezone');
select throws_ok($$select * from public.create_owner_barbershop('Forbidden','operational-forbidden',null,null,null,null,null,null,null,'America/Recife')$$, 'P0001', 'OWNER_ONBOARDING_NOT_AUTHORIZED', 'barber cannot use operational onboarding overload');

set local "request.jwt.claims" = '{"sub":"dddd0000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok($$select * from public.create_owner_barbershop('New','operational-new',null,null,null,null,null,null,null,'America/New_York')$$, 'onboarding persists operational timezone atomically');
select is((select b.operational_timezone from public.barbershops b join public.profiles p on p.barbershop_id = b.id where p.id = auth.uid()), 'America/New_York', 'onboarded tenant has confirmed zone');
select ok((select b.financial_timezone is null from public.barbershops b join public.profiles p on p.barbershop_id = b.id where p.id = auth.uid()), 'onboarding does not infer financial timezone');
set local "request.jwt.claims" = '{"sub":"dddd0000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select * from public.create_owner_barbershop('Invalid','operational-invalid',null,null,null,null,null,null,null,'Not/AZone')$$, '22023', 'INVALID_OPERATIONAL_TIMEZONE', 'invalid onboarding rolls back');
select ok((select barbershop_id is null from public.profiles where id = auth.uid()), 'failed onboarding leaves owner unscoped');
select lives_ok($$select * from public.create_owner_barbershop('Legacy','operational-legacy')$$, 'legacy onboarding still works');
select ok((select operational_timezone is null from public.barbershops where slug = 'operational-legacy'), 'legacy onboarding remains unconfigured');
set local "request.jwt.claims" = '{"sub":"dddd0000-0000-4000-8000-000000000005","role":"authenticated"}';
select lives_ok($$select * from public.create_owner_barbershop('Both','operational-both',null,null,null,null,null,null,'UTC','America/New_York')$$, 'both explicitly confirmed timezones can be created atomically');
select ok((select operational_timezone = 'America/New_York' and financial_timezone = 'UTC' from public.barbershops where slug = 'operational-both'), 'confirmed timezones remain independent at creation');
reset role;
select is((select count(*) from public.barbershops where slug = 'operational-invalid'), 0::bigint, 'no orphan tenant after failure');

select * from finish();
rollback;
