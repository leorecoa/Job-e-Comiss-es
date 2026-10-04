-- Administrative observations only; all fixtures and reads are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);
create function pg_temp.entitlement_id(n integer) returns uuid language sql immutable as $$
  select ('eeee0040-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
insert into public.barbershops(id,name,slug)
select pg_temp.entitlement_id(n),'Entitlement fixture','entitlement-040-'||n
from generate_series(1,8) n;
insert into public.commercial_plans(code,name) values('resolver_040','Generic resolver fixture');
create temp table expected (
  n integer, status text, condition text, allowed boolean, reason text
);
insert into expected values
  (1,NULL,'unassigned',true,'UNASSIGNED_COMPATIBILITY'),
  (2,'pending','pending',false,'COMMERCIAL_PENDING'),
  (3,'trialing','trial_valid',true,'TRIAL_VALID'),
  (4,'trialing','trial_not_started',false,'TRIAL_NOT_STARTED'),
  (5,'trialing','trial_expired',false,'TRIAL_EXPIRED'),
  (6,'active','active',true,'COMMERCIAL_ACTIVE'),
  (7,'paused','paused',false,'COMMERCIAL_PAUSED'),
  (8,'canceled','canceled',false,'COMMERCIAL_CANCELED');
select private.set_tenant_subscription(pg_temp.entitlement_id(n),'resolver_040',status,
  case n when 3 then now()-interval '1 day' when 4 then now()+interval '1 day' when 5 then now()-interval '2 days' end,
  case n when 3 then now()+interval '1 day' when 4 then now()+interval '2 days' when 5 then now()-interval '1 day' end,
  case n when 6 then now()-interval '2 days' end,
  case n when 6 then now()-interval '1 day' end)
from expected where n<>1;

create temp table before_subscriptions as select * from public.tenant_subscriptions;
create temp table before_plans as select * from public.commercial_plans;
create temp table before_tenants as select * from public.barbershops;
create temp table clock_bounds as select clock_timestamp() as before_read;
create temp table observed as
select e.n,r.* from expected e cross join lateral private.resolve_tenant_entitlements(pg_temp.entitlement_id(e.n)) r;
alter table clock_bounds add column after_read timestamptz default clock_timestamp();

select has_function('private','resolve_tenant_entitlements',array['uuid'],'private uuid-only resolver exists');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='resolve_tenant_entitlements'),1::bigint,'no overload or public counterpart');
select ok((select not prosecdef and provolatile='v' and proconfig=array['search_path=pg_catalog'] from pg_proc where oid='private.resolve_tenant_entitlements(uuid)'::regprocedure),'VOLATILE INVOKER with restrictive search_path');
select is(pg_get_function_result('private.resolve_tenant_entitlements(uuid)'::regprocedure),'TABLE(commercial_status text, commercial_condition text, can_create_internal_appointment boolean, can_accept_public_booking boolean, reason text, evaluated_at timestamp with time zone)','exact minimal output');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='private.resolve_tenant_entitlements(uuid)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC has no EXECUTE');
select ok(not has_function_privilege(r,'private.resolve_tenant_entitlements(uuid)','EXECUTE'),r||' has no effective EXECUTE')
from unnest(array['anon','authenticated','service_role']) r;
select ok(not has_table_privilege(r,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not has_any_column_privilege(r,t,'SELECT,INSERT,UPDATE,REFERENCES'),r||' has no commercial table/column access: '||t)
from unnest(array['anon','authenticated','service_role']) r
cross join unnest(array['public.commercial_plans','public.tenant_subscriptions']) t;
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.commercial_plans'::regclass,'public.tenant_subscriptions'::regclass)),'commercial RLS remains enabled');
select is((select count(*) from pg_policies where schemaname='public' and tablename in ('commercial_plans','tenant_subscriptions')),0::bigint,'no commercial policies');

select results_eq(
  format('select commercial_status,commercial_condition,can_create_internal_appointment,can_accept_public_booking,reason from observed where n=%s',n),
  format('select status,condition,allowed,allowed,reason from expected where n=%s',n),
  'one isolated literal status, condition, both capabilities and reason: '||condition)
from expected order by n;
select ok((select bool_and(evaluated_at is not null and isfinite(evaluated_at) and evaluated_at between before_read and after_read) from observed cross join clock_bounds),'every evaluation returns its current database instant');
select ok((select evaluated_at>=s.trial_started_at and evaluated_at<s.trial_ends_at from observed o join public.tenant_subscriptions s on s.barbershop_id=pg_temp.entitlement_id(o.n) where n=3),'valid trial obeys inclusive start and exclusive end');
select ok((select evaluated_at<s.trial_started_at from observed o join public.tenant_subscriptions s on s.barbershop_id=pg_temp.entitlement_id(o.n) where n=4),'future trial is before start');
select ok((select evaluated_at>=s.trial_ends_at from observed o join public.tenant_subscriptions s on s.barbershop_id=pg_temp.entitlement_id(o.n) where n=5),'expired trial is at or after end');
-- Wall-clock calls cannot deterministically hit the same microsecond as a fixture.
-- Inspect equality operators as supplemental coverage, not a mocked clock test.
select ok((select prosrc like '%evaluated_at < v_state.trial_started_at%' and prosrc like '%evaluated_at >= v_state.trial_ends_at%' from pg_proc where oid='private.resolve_tenant_entitlements(uuid)'::regprocedure),'boundary operators include start and exclude end');
select is((select regexp_count(prosrc,'pg_catalog\.clock_timestamp\(\)') from pg_proc where oid='private.resolve_tenant_entitlements(uuid)'::regprocedure),1,'database clock is captured once');
select throws_ok($$select * from private.resolve_tenant_entitlements(NULL)$$,'P0001','COMMERCIAL_ENTITLEMENT_TENANT_REQUIRED','NULL tenant is not unassigned');
select throws_ok($$select * from private.resolve_tenant_entitlements(pg_temp.entitlement_id(999))$$,'P0001','COMMERCIAL_ENTITLEMENT_TENANT_NOT_FOUND','missing tenant is not unassigned');
set local role anon;
select throws_ok($$select * from private.resolve_tenant_entitlements('eeee0040-0000-4000-8000-000000000001')$$,'42501',null,'anon cannot evaluate arbitrary tenants');
reset role;
set local role authenticated;
select throws_ok($$select * from private.resolve_tenant_entitlements('eeee0040-0000-4000-8000-000000000001')$$,'42501',null,'authenticated owner/barber cannot bypass the administrative boundary');
reset role;
set local role service_role;
select throws_ok($$select * from private.resolve_tenant_entitlements('eeee0040-0000-4000-8000-000000000001')$$,'42501',null,'service_role cannot evaluate tenants');
reset role;

-- These corrupt states are unreachable under 035. Never relax its constraints.
select throws_ok($$update public.tenant_subscriptions set status='trial_expired' where barbershop_id=pg_temp.entitlement_id(5)$$,'23514',null,'derived condition cannot be persisted as status');
select throws_ok($$update public.tenant_subscriptions set plan_code='missing_plan_040' where barbershop_id=pg_temp.entitlement_id(3)$$,'23503',null,'missing plan reference is rejected before evaluation');
select throws_ok($$update public.tenant_subscriptions set trial_started_at=NULL,trial_ends_at=NULL where barbershop_id=pg_temp.entitlement_id(3)$$,'23514',null,'trialing without a temporal pair is impossible');
select throws_ok($$update public.tenant_subscriptions set trial_ends_at=trial_started_at where barbershop_id=pg_temp.entitlement_id(3)$$,'23514',null,'zero-length trial is impossible');
select throws_ok($$update public.tenant_subscriptions set trial_ends_at='infinity' where barbershop_id=pg_temp.entitlement_id(3)$$,'23514',null,'non-finite trial is impossible');
select results_eq('select * from public.tenant_subscriptions order by barbershop_id','select * from before_subscriptions order by barbershop_id','no subscription provision, transition, timestamp change or cross-tenant mutation');
select results_eq('select * from public.commercial_plans order by code','select * from before_plans order by code','plans unchanged');
select results_eq('select * from public.barbershops order by id','select * from before_tenants order by id','tenants unchanged');
select ok(has_function_privilege('authenticated','public.get_tenant_commercial_state()','EXECUTE') and not has_function_privilege('service_role','public.get_tenant_commercial_state()','EXECUTE'),'reader ACL unchanged');
select ok(not has_function_privilege('authenticated','private.set_tenant_subscription(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz)','EXECUTE') and not has_function_privilege('service_role','private.set_tenant_subscription(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz)','EXECUTE'),'administrative writer authority unchanged');
select * from finish();
rollback;
