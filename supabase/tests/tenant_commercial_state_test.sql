-- Synthetic fixtures only; function reads must never provision commercial state.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);
create function pg_temp.commercial_id(n integer) returns uuid language sql immutable as $$
  select ('eeee0037-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
insert into public.barbershops(id,name,slug)
select pg_temp.commercial_id(n),'Commercial reader fixture','commercial-reader-'||n
from generate_series(1,3) n;
insert into public.barbers(id,name,barbershop_id)
values(pg_temp.commercial_id(10),'Reader barber',pg_temp.commercial_id(1));
insert into auth.users(id,aud,role,email,raw_user_meta_data)
select pg_temp.commercial_id(n),'authenticated','authenticated','commercial-'||n||'@example.test','{"role":"owner"}'::jsonb
from generate_series(101,107) n;
update public.profiles set barbershop_id=pg_temp.commercial_id(1) where id=pg_temp.commercial_id(101);
update public.profiles set barbershop_id=pg_temp.commercial_id(2) where id=pg_temp.commercial_id(102);
update public.profiles set role='barber',barbershop_id=pg_temp.commercial_id(1),barber_id=pg_temp.commercial_id(10) where id=pg_temp.commercial_id(103);
update public.profiles set active=false,barbershop_id=pg_temp.commercial_id(1) where id=pg_temp.commercial_id(104);
delete from public.profiles where id=pg_temp.commercial_id(105);
update public.profiles set barbershop_id=pg_temp.commercial_id(3) where id=pg_temp.commercial_id(107);
insert into public.commercial_plans(code,name) values('reader_a_037','Reader A'),('reader_b_037','Reader B');
insert into public.tenant_subscriptions(barbershop_id,plan_code,status) values
(pg_temp.commercial_id(1),'reader_a_037','active'),
(pg_temp.commercial_id(2),'reader_b_037','paused');

select has_function('public','get_tenant_commercial_state',array[]::text[],'zero-argument reader exists');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_tenant_commercial_state'),1::bigint,'no selector overload');
select ok((select prosecdef and provolatile='s' and proconfig=array['search_path=pg_catalog'] from pg_proc where oid='public.get_tenant_commercial_state()'::regprocedure),'restricted STABLE SECURITY DEFINER');
select is(pg_get_function_result('public.get_tenant_commercial_state()'::regprocedure),'TABLE(status text, plan_code text, trial_started_at timestamp with time zone, trial_ends_at timestamp with time zone, current_period_start timestamp with time zone, current_period_end timestamp with time zone)','only contracted fields and aliases');
select ok(has_function_privilege('authenticated','public.get_tenant_commercial_state()','EXECUTE'),'authenticated EXECUTE');
select ok(not has_function_privilege('anon','public.get_tenant_commercial_state()','EXECUTE'),'anon denied');
select ok(not has_function_privilege('service_role','public.get_tenant_commercial_state()','EXECUTE'),'service_role denied');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.get_tenant_commercial_state()'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC denied');
select ok(not has_table_privilege(r,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not has_any_column_privilege(r,t,'SELECT,INSERT,UPDATE,REFERENCES'),r||' has no table or column CRUD on '||t)
from unnest(array['anon','authenticated','service_role']) r
cross join unnest(array['public.commercial_plans','public.tenant_subscriptions']) t;
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.commercial_plans'::regclass,'public.tenant_subscriptions'::regclass)),'commercial RLS remains enabled');
select is((select count(*) from pg_policies where schemaname='public' and tablename in ('commercial_plans','tenant_subscriptions')),0::bigint,'no commercial policies added');

set local role anon;
select throws_ok($$select * from public.get_tenant_commercial_state()$$,'42501',null,'anon call denied');
reset role;
set local role service_role;
select throws_ok($$select * from public.get_tenant_commercial_state()$$,'42501',null,'service_role call denied');
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select throws_ok($$select * from public.get_tenant_commercial_state()$$,'P0001','TENANT_COMMERCIAL_STATE_FORBIDDEN','missing identity fails explicitly');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.commercial_id(103)::text,true);
set local role authenticated;
select throws_ok($$select * from public.get_tenant_commercial_state()$$,'P0001','TENANT_COMMERCIAL_STATE_FORBIDDEN','barber rejected');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.commercial_id(104)::text,true);
set local role authenticated;
select throws_ok($$select * from public.get_tenant_commercial_state()$$,'P0001','TENANT_COMMERCIAL_STATE_FORBIDDEN','inactive owner rejected');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.commercial_id(105)::text,true);
set local role authenticated;
select throws_ok($$select * from public.get_tenant_commercial_state()$$,'P0001','TENANT_COMMERCIAL_STATE_FORBIDDEN','missing profile rejected');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.commercial_id(106)::text,true);
set local role authenticated;
select throws_ok($$select * from public.get_tenant_commercial_state()$$,'P0001','TENANT_COMMERCIAL_STATE_FORBIDDEN','tenantless owner is not unassigned');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.commercial_id(101)::text,true);
select set_config('request.jwt.claims',jsonb_build_object('barbershop_id',pg_temp.commercial_id(2),'planType','pro','isPro',true)::text,true);
set local role authenticated;
select results_eq($$select status,plan_code from public.get_tenant_commercial_state()$$,$$select 'active'::text,'reader_a_037'::text$$,'owner A receives exactly A despite foreign tenant and legacy metadata');
select throws_ok($$select * from public.get_tenant_commercial_state('eeee0037-0000-4000-8000-000000000002'::uuid)$$,'42883',null,'cannot supply tenant selector');
select throws_ok($$select * from public.tenant_subscriptions$$,'42501',null,'owner cannot bypass reader');
select throws_ok($$insert into public.tenant_subscriptions default values$$,'42501',null,'owner cannot provision subscription');
select throws_ok($$update public.tenant_subscriptions set status='active'$$,'42501',null,'owner cannot set commercial status');
select throws_ok($$delete from public.tenant_subscriptions$$,'42501',null,'owner cannot delete commercial status');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.commercial_id(102)::text,true);
set local role authenticated;
select results_eq($$select status,plan_code from public.get_tenant_commercial_state()$$,$$select 'paused'::text,'reader_b_037'::text$$,'owner B receives exactly B');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.commercial_id(107)::text,true);
set local role authenticated;
select is((select count(*) from public.get_tenant_commercial_state()),1::bigint,'unassigned returns one row');
select is((select status from public.get_tenant_commercial_state()),'unassigned','real absence is unassigned');
select ok((select plan_code is null and trial_started_at is null and trial_ends_at is null and current_period_start is null and current_period_end is null from public.get_tenant_commercial_state()),'all unassigned details null');
reset role;
select is((select count(*) from public.tenant_subscriptions where barbershop_id=pg_temp.commercial_id(3)),0::bigint,'reader does not create subscription');
select set_config('request.jwt.claim.sub',pg_temp.commercial_id(101)::text,true);
update public.tenant_subscriptions set status='pending' where barbershop_id=pg_temp.commercial_id(1);
set local role authenticated;
select is((select status from public.get_tenant_commercial_state()),'pending','pending literal');
reset role;
update public.tenant_subscriptions set status='trialing',trial_started_at='2000-01-01T00:00:00Z',trial_ends_at='2000-01-15T00:00:00Z',current_period_started_at='2000-02-01T00:00:00Z',current_period_ends_at='2000-03-01T00:00:00Z' where barbershop_id=pg_temp.commercial_id(1);
set local role authenticated;
select is((select status from public.get_tenant_commercial_state()),'trialing','past trial remains trialing');
select is((select trial_started_at from public.get_tenant_commercial_state()),'2000-01-01T00:00:00Z'::timestamptz,'trial start preserved');
select is((select trial_ends_at from public.get_tenant_commercial_state()),'2000-01-15T00:00:00Z'::timestamptz,'trial end preserved');
select is((select current_period_start from public.get_tenant_commercial_state()),'2000-02-01T00:00:00Z'::timestamptz,'period start alias');
select is((select current_period_end from public.get_tenant_commercial_state()),'2000-03-01T00:00:00Z'::timestamptz,'period end alias');
reset role;
update public.tenant_subscriptions set status='canceled' where barbershop_id=pg_temp.commercial_id(1);
set local role authenticated;
select is((select status from public.get_tenant_commercial_state()),'canceled','canceled literal');
reset role;
select is((select count(*) from public.commercial_plans where code in ('reader_a_037','reader_b_037')),2::bigint,'reader does not provision plans');
select is((select count(*) from public.tenant_subscriptions where barbershop_id in (pg_temp.commercial_id(1),pg_temp.commercial_id(2),pg_temp.commercial_id(3))),2::bigint,'reader does not provision tenants');
select is((select status from public.tenant_subscriptions where barbershop_id=pg_temp.commercial_id(2)),'paused','foreign subscription unchanged');
select * from finish();
rollback;
