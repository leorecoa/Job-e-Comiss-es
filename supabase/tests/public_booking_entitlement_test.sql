begin;
create extension if not exists pgtap with schema extensions;
select plan(36);
create function pg_temp.entitlement_id(n integer) returns uuid language sql immutable as $$
  select ('eeee0042-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
insert into public.barbershops(id,name,slug,operational_timezone,slot_step_minutes,business_hours)
select pg_temp.entitlement_id(n),'Entitlement fixture','entitlement-042-'||n,'UTC',30,
  (select jsonb_object_agg(d,jsonb_build_object('active',true,'open','09:00','close','18:00'))
   from unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday']) d)
from generate_series(1,8) n;
insert into public.barbers(id,name,barbershop_id)
select pg_temp.entitlement_id(100+n),'Fixture barber',pg_temp.entitlement_id(n) from generate_series(1,8) n;
insert into public.services(id,name,barbershop_id,price,duration_minutes,commission_rate)
select pg_temp.entitlement_id(200+n),'Fixture service',pg_temp.entitlement_id(n),50,30,40 from generate_series(1,8) n;
insert into public.commercial_plans(code,name) values('public_entitlement_042','Fixture plan');
select private.set_tenant_subscription(pg_temp.entitlement_id(n),'public_entitlement_042',s,
  case when s='trialing' then clock_timestamp()+lo else null end,
  case when s='trialing' then clock_timestamp()+hi else null end,null,null)
from (values
 (2,'pending',interval '0',interval '0'),
 (3,'trialing',interval '1 day',interval '2 days'),
 (4,'trialing',interval '-1 day',interval '1 day'),
 (5,'trialing',interval '-2 days',interval '-1 day'),
 (6,'active',interval '0',interval '0'),
 (7,'paused',interval '0',interval '0'),
 (8,'canceled',interval '0',interval '0')
) v(n,s,lo,hi);
create temp table original_subscriptions as select * from public.tenant_subscriptions;
create temp table original_tenants as select * from public.barbershops;
-- Invoker helper calls the real public writer under service_role.
create function pg_temp.book(n integer, phone text default '11999999999', start_at timestamptz default '2035-01-08T09:00Z')
returns uuid language sql as $$
  select public.create_public_appointment(pg_temp.entitlement_id(n),pg_temp.entitlement_id(100+n),
    pg_temp.entitlement_id(200+n),'Public fixture',phone,start_at,start_at+interval '30 minutes')
$$;
set local role service_role;
select lives_ok('select pg_temp.book(1)','unassigned allowed');
select throws_ok('select pg_temp.book(2)','P0001','PUBLIC_APPOINTMENT_COMMERCIAL_UNAVAILABLE','pending denied without commercial details');
select throws_ok('select pg_temp.book(3)','P0001','PUBLIC_APPOINTMENT_COMMERCIAL_UNAVAILABLE','trial_not_started denied');
select lives_ok('select pg_temp.book(4)','trial_valid allowed');
select throws_ok('select pg_temp.book(5)','P0001','PUBLIC_APPOINTMENT_COMMERCIAL_UNAVAILABLE','trial_expired denied');
select lives_ok('select pg_temp.book(6)','active allowed');
select throws_ok('select pg_temp.book(7)','P0001','PUBLIC_APPOINTMENT_COMMERCIAL_UNAVAILABLE','paused denied');
select throws_ok('select pg_temp.book(8)','P0001','PUBLIC_APPOINTMENT_COMMERCIAL_UNAVAILABLE','canceled denied');
reset role;
select is((select count(*) from public.appointments where barbershop_id=pg_temp.entitlement_id(n)),
  case when n in (1,4,6) then 1 else 0 end::bigint,'expected appointment cardinality for tenant '||n)
from generate_series(1,8) n;
select results_eq('select * from public.tenant_subscriptions order by barbershop_id','select * from original_subscriptions order by barbershop_id','no commercial mutations or automatic provisioning');
select results_eq('select * from public.barbershops order by id','select * from original_tenants order by id','tenants unchanged');
select ok((select bool_and(service_value=50 and commission_rate=40 and status='scheduled' and end_at=start_at+interval '30 minutes' and financial_record_id is null)
  from public.appointments where barbershop_id in (select pg_temp.entitlement_id(n) from generate_series(1,8) n)),'operational snapshots preserved');
create temp table commitments as select * from public.appointments where barbershop_id=pg_temp.entitlement_id(6);
select private.set_tenant_subscription(pg_temp.entitlement_id(6),'public_entitlement_042','canceled',null,null,null,null);
set local role service_role;
select throws_ok($$select pg_temp.book(6,'11999999998','2035-01-08T10:00Z')$$,'P0001','PUBLIC_APPOINTMENT_COMMERCIAL_UNAVAILABLE','new demand denied after cancelation');
reset role;
select results_eq('select * from public.appointments where barbershop_id=pg_temp.entitlement_id(6)','select * from commitments','existing commitment unchanged');
set local role service_role;
select throws_ok($$select pg_temp.book(1,'11999999999','2035-01-08T10:00Z')$$,'P0001','PUBLIC_APPOINTMENT_RATE_LIMITED','phone rate limit preserved');
select throws_ok($$select pg_temp.book(1,'11999999998')$$,'P0001','PUBLIC_APPOINTMENT_SLOT_CONFLICT','overlap still rejected');
select throws_ok($$select public.create_public_appointment(pg_temp.entitlement_id(1),pg_temp.entitlement_id(102),pg_temp.entitlement_id(201),'Public fixture','11999999997','2035-01-08T10:00Z','2035-01-08T10:30Z')$$,'P0001','PUBLIC_APPOINTMENT_INVALID_BARBER','foreign barber rejected');
select throws_ok($$select public.create_public_appointment(pg_temp.entitlement_id(1),pg_temp.entitlement_id(101),pg_temp.entitlement_id(202),'Public fixture','11999999997','2035-01-08T10:00Z','2035-01-08T10:30Z')$$,'P0001','PUBLIC_APPOINTMENT_INVALID_SERVICE','foreign service rejected');
reset role;
select ok(has_function_privilege('service_role','public.create_public_appointment(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text)','EXECUTE'),'official proxy role can execute');
select ok(not has_function_privilege(r,'public.create_public_appointment(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text)','EXECUTE'),r||' cannot execute public writer') from unnest(array['anon','authenticated']) r;
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.create_public_appointment(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC has no EXECUTE');
select ok((select prosecdef and provolatile='v' and proconfig=array['search_path=pg_catalog'] from pg_proc where oid='public.create_public_appointment(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text)'::regprocedure),'writer security metadata unchanged');
select ok(has_table_privilege('service_role','public.appointments','INSERT'),'known privileged direct INSERT intentionally unchanged');
select ok(not has_table_privilege('authenticated','public.appointments','SELECT,INSERT,UPDATE,DELETE'),'browser CRUD remains closed');
select ok(not has_function_privilege(r,'private.resolve_tenant_entitlements(uuid)','EXECUTE'),r||' has no direct resolver authority') from unnest(array['anon','authenticated','service_role']) r;
select is((select count(*) from public.appointments where barbershop_id=pg_temp.entitlement_id(1)),1::bigint,'failed operational requests leave no rows');
select * from finish();
rollback;
