-- Local synthetic fixtures; psql includes the actual migration, not a copy.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);
select is((select count(*) from public.commercial_plans where code='founding_partner'),1::bigint,'pilot identity exists once');
select is((select code from public.commercial_plans where code='founding_partner'),'founding_partner','stable code');
select is((select name from public.commercial_plans where code='founding_partner'),'Parceiro Fundador','approved name');
create function pg_temp.pilot_id(n integer) returns uuid language sql immutable as $$
  select ('eeee0039-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
insert into public.barbershops(id,name,slug)
select pg_temp.pilot_id(n),'Pilot fixture','founding-partner-'||n from generate_series(1,3) n;
insert into auth.users(id,aud,role,email,raw_user_meta_data)
select pg_temp.pilot_id(n),'authenticated','authenticated','pilot-'||n||'@example.test','{"role":"owner"}'::jsonb
from generate_series(101,103) n;
update public.profiles set barbershop_id=pg_temp.pilot_id(1) where id=pg_temp.pilot_id(101);
update public.profiles set barbershop_id=pg_temp.pilot_id(2) where id=pg_temp.pilot_id(102);
update public.profiles set barbershop_id=pg_temp.pilot_id(3) where id=pg_temp.pilot_id(103);
insert into public.commercial_plans(code,name) values('pilot_other','Other fixture');
select private.set_tenant_subscription(pg_temp.pilot_id(2),'pilot_other','paused',null,null,null,null);
create temp table before_subscriptions as select * from public.tenant_subscriptions;
create temp table before_tenants as select * from public.barbershops;
create temp table before_other_plans as select * from public.commercial_plans where code<>'founding_partner';

-- Exercise both first registration and an exact repeat in this rollback-only test.
delete from public.commercial_plans where code='founding_partner';
\ir ../migrations/20260809003900_founding_partner_pilot_plan.sql
select is((select count(*) from public.commercial_plans where code='founding_partner'),1::bigint,'first registration creates exactly one plan');
create temp table first_plan as select * from public.commercial_plans where code='founding_partner';
\ir ../migrations/20260809003900_founding_partner_pilot_plan.sql
select results_eq($$select * from public.commercial_plans where code='founding_partner'$$,$$select * from first_plan$$,'repeat preserves identity and timestamps');
select results_eq($$select * from public.tenant_subscriptions order by barbershop_id$$,$$select * from before_subscriptions order by barbershop_id$$,'registration creates no subscriptions and changes none');
select results_eq($$select * from public.barbershops order by id$$,$$select * from before_tenants order by id$$,'registration changes no tenants');
select results_eq($$select * from public.commercial_plans where code<>'founding_partner' order by code$$,$$select * from before_other_plans order by code$$,'other plans unchanged');

-- Fixed past instants cross a DST boundary but represent exactly 720 hours.
set local timezone='America/New_York';
select lives_ok($$select private.set_tenant_subscription(pg_temp.pilot_id(1),'founding_partner','trialing',
  '2020-03-01T12:00:00Z','2020-03-31T12:00:00Z',null,null)$$,'administrative pilot assignment');
select is((select extract(epoch from trial_ends_at-trial_started_at) from public.tenant_subscriptions where barbershop_id=pg_temp.pilot_id(1)),2592000::numeric,'exactly 720 elapsed hours across DST');
select ok((select current_period_started_at is null and current_period_ends_at is null from public.tenant_subscriptions where barbershop_id=pg_temp.pilot_id(1)),'no billing cycle inferred');
create temp table assigned_pilot as select * from public.tenant_subscriptions where barbershop_id=pg_temp.pilot_id(1);
select set_config('request.jwt.claim.sub',pg_temp.pilot_id(101)::text,true);
set local role authenticated;
select is((select plan_code from public.get_tenant_commercial_state()),'founding_partner','reader returns pilot code');
select is((select status from public.get_tenant_commercial_state()),'trialing','past end still returns literal trialing');
select is((select trial_started_at from public.get_tenant_commercial_state()),'2020-03-01T12:00:00Z'::timestamptz,'exact start preserved');
select is((select trial_ends_at from public.get_tenant_commercial_state()),'2020-03-31T12:00:00Z'::timestamptz,'exclusive end preserved');
select ok((select current_period_start is null and current_period_end is null from public.get_tenant_commercial_state()),'reader returns null periods');
select throws_ok($$select private.set_tenant_subscription('eeee0039-0000-4000-8000-000000000001','founding_partner','active',null,null,null,null)$$,'42501',null,'owner cannot activate or change pilot');
reset role;
select results_eq($$select * from public.tenant_subscriptions where barbershop_id=pg_temp.pilot_id(1)$$,$$select * from assigned_pilot$$,'reading past trial causes no transition or renewal');
select results_eq($$select * from public.tenant_subscriptions where barbershop_id=pg_temp.pilot_id(2)$$,$$select * from before_subscriptions where barbershop_id=pg_temp.pilot_id(2)$$,'other tenant subscription unchanged');
select results_eq($$select * from public.barbershops order by id$$,$$select * from before_tenants order by id$$,'pilot does not change tenant active state');
select set_config('request.jwt.claim.sub',pg_temp.pilot_id(102)::text,true);
set local role authenticated;
select results_eq($$select plan_code,status from public.get_tenant_commercial_state()$$,$$select 'pilot_other'::text,'paused'::text$$,'other owner sees only own state');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.pilot_id(103)::text,true);
set local role authenticated;
select is((select status from public.get_tenant_commercial_state()),'unassigned','unassigned remains unassigned');
reset role;
select is((select count(*) from public.tenant_subscriptions where barbershop_id=pg_temp.pilot_id(3)),0::bigint,'unassigned has no row');
select ok(not has_table_privilege(r,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not has_any_column_privilege(r,t,'SELECT,INSERT,UPDATE,REFERENCES'),r||' commercial table and column ACL closed: '||t)
from unnest(array['anon','authenticated','service_role']) r
cross join unnest(array['public.commercial_plans','public.tenant_subscriptions']) t;
select ok(not has_function_privilege(r,'private.set_tenant_subscription(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz)','EXECUTE'),r||' writer denied')
from unnest(array['anon','authenticated','service_role']) r;
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='private.set_tenant_subscription(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC writer denied');
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.commercial_plans'::regclass,'public.tenant_subscriptions'::regclass)),'commercial RLS remains enabled');
select is((select count(*) from pg_policies where schemaname='public' and tablename in ('commercial_plans','tenant_subscriptions')),0::bigint,'commercial policies remain absent');
select * from finish();
rollback;
