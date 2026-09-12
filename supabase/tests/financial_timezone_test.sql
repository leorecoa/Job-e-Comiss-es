begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

select ok(exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'barbershops' and column_name = 'financial_timezone' and is_nullable = 'YES' and column_default is null), 'nullable timezone has no default');
select is((select count(*) from public.barbershops where financial_timezone is not null), 0::bigint, 'existing seed tenants remain unconfigured');
select ok(not has_column_privilege('anon','public.barbershops','financial_timezone','select'), 'anon cannot read financial timezone');
select ok(has_column_privilege('anon','public.barbershops','name','select'), 'public branding read remains');
select ok(not has_table_privilege('anon','public.barbershops','update'), 'anon has no update');
select ok(has_function_privilege('authenticated','public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text)','execute'), 'authenticated executes overload');
select ok(not has_function_privilege('anon','public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text)','execute'), 'anon cannot execute overload');
select ok(not has_function_privilege('service_role','public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text)','execute'), 'service role gains no execute');
select ok(not exists(select 1 from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'create_owner_barbershop' and grantee = 'PUBLIC' and privilege_type = 'EXECUTE'), 'PUBLIC gains no execute');
select ok((select prosecdef from pg_proc where oid = 'public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text)'::regprocedure), 'overload is security definer');
select is((select proconfig from pg_proc where oid = 'public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text)'::regprocedure), array['search_path=pg_catalog'], 'overload search path is safe');

insert into auth.users (id, aud, role, email) values
('cccc0000-0000-4000-8000-000000000001','authenticated','authenticated','timezone-owner@example.test'),
('cccc0000-0000-4000-8000-000000000002','authenticated','authenticated','timezone-barber@example.test'),
('cccc0000-0000-4000-8000-000000000003','authenticated','authenticated','timezone-new@example.test'),
('cccc0000-0000-4000-8000-000000000004','authenticated','authenticated','timezone-invalid@example.test');
insert into public.profiles (id, role, active, barbershop_id, barber_id) values
('cccc0000-0000-4000-8000-000000000001','owner',true,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',null),
('cccc0000-0000-4000-8000-000000000002','barber',true,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111'),
('cccc0000-0000-4000-8000-000000000003','owner',true,null,null),
('cccc0000-0000-4000-8000-000000000004','owner',true,null,null);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"cccc0000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$update public.barbershops set financial_timezone = 'America/Recife' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$$, 'owner confirms valid timezone');
select is((select financial_timezone from public.barbershops where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'America/Recife', 'owner reads persisted timezone');
select lives_ok($$update public.barbershops set financial_timezone = 'America/New_York' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$$, 'owner can change timezone');
select throws_ok($$update public.barbershops set financial_timezone = 'Not/AZone' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$$, '22023', 'INVALID_FINANCIAL_TIMEZONE', 'database rejects invalid timezone');
select throws_ok($$update public.barbershops set financial_timezone = '+03:00' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$$, '22023', 'INVALID_FINANCIAL_TIMEZONE', 'database rejects raw offset');
select results_eq($$with changed as (update public.barbershops set financial_timezone = 'America/Recife' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2' returning id) select count(*) from changed$$, $$select 0::bigint$$, 'owner cannot update another tenant');
set local "request.jwt.claims" = '{"sub":"cccc0000-0000-4000-8000-000000000002","role":"authenticated"}';
select results_eq($$with changed as (update public.barbershops set financial_timezone = 'America/Recife' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' returning id) select count(*) from changed$$, $$select 0::bigint$$, 'barber cannot update own tenant');
select throws_ok($$select * from public.create_owner_barbershop('Forbidden','timezone-forbidden',null,null,null,null,null,null,'America/Recife')$$, 'P0001', 'OWNER_ONBOARDING_NOT_AUTHORIZED', 'barber cannot use onboarding overload');

set local "request.jwt.claims" = '{"sub":"cccc0000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok($$select * from public.create_owner_barbershop('New','timezone-new',null,null,null,null,null,null,'America/Sao_Paulo')$$, 'new owner creates timezone atomically');
select is((select b.financial_timezone from public.barbershops b join public.profiles p on p.barbershop_id = b.id where p.id = auth.uid()), 'America/Sao_Paulo', 'timezone belongs to authenticated owner tenant');
set local "request.jwt.claims" = '{"sub":"cccc0000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select * from public.create_owner_barbershop('Invalid','timezone-invalid',null,null,null,null,null,null,'Not/AZone')$$, '22023', 'INVALID_FINANCIAL_TIMEZONE', 'invalid onboarding rolls back');
select ok((select barbershop_id is null from public.profiles where id = auth.uid()), 'failed onboarding leaves owner unscoped');
select lives_ok($$select * from public.create_owner_barbershop('Legacy','timezone-legacy')$$, 'old onboarding contract still works');
select ok((select financial_timezone is null from public.barbershops where slug = 'timezone-legacy'), 'unconfirmed onboarding stays null');
reset role;
select is((select count(*) from public.barbershops where slug = 'timezone-invalid'), 0::bigint, 'no orphan tenant from failed onboarding');
select ok((select financial_timezone is null from public.barbershops where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 'other tenant stays unmodified');

select * from finish();
rollback;
