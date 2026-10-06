begin;
create extension if not exists pgtap with schema extensions;
select plan(33);
create function pg_temp.coordination_id(n integer) returns uuid language sql immutable as $$
  select ('eeee0041-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
insert into public.barbershops(id,name,slug,operational_timezone,slot_step_minutes,business_hours)
select pg_temp.coordination_id(n),'Coordination fixture','coordination-041-'||n,'UTC',30,
  (select jsonb_object_agg(d,jsonb_build_object('active',true,'open','09:00','close','18:00'))
   from unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday']) d)
from generate_series(1,2) n;
insert into public.commercial_plans(code,name) values('coordination_041','Coordination fixture');
insert into public.barbers(id,name,barbershop_id) values(pg_temp.coordination_id(10),'Coordination barber',pg_temp.coordination_id(1));
insert into public.services(id,name,barbershop_id,price,duration_minutes,commission_rate)
values(pg_temp.coordination_id(20),'Coordination service',pg_temp.coordination_id(1),50,30,40);
insert into auth.users(id,aud,role,email,raw_user_meta_data)
select pg_temp.coordination_id(n),'authenticated','authenticated','coordination-'||n||'@example.test','{"role":"owner"}'::jsonb
from generate_series(101,102) n;
update public.profiles set barbershop_id=pg_temp.coordination_id(1) where id=pg_temp.coordination_id(101);
update public.profiles set barbershop_id=pg_temp.coordination_id(1),role='barber',barber_id=pg_temp.coordination_id(10) where id=pg_temp.coordination_id(102);

select has_function('private','set_tenant_subscription',array['uuid','text','text','timestamp with time zone','timestamp with time zone','timestamp with time zone','timestamp with time zone'],'writer signature preserved');
select is(pg_get_function_result('private.set_tenant_subscription(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz)'::regprocedure),'void','return type preserved');
select ok((select not prosecdef and provolatile='v' and proconfig=array['search_path=pg_catalog'] and pronargdefaults=0 from pg_proc where oid='private.set_tenant_subscription(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz)'::regprocedure),'INVOKER VOLATILE explicit arguments and safe path preserved');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='set_tenant_subscription'),1::bigint,'no overload');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='private.set_tenant_subscription(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC writer EXECUTE denied');
select ok(not has_function_privilege(r,'private.set_tenant_subscription(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz)','EXECUTE'),r||' writer EXECUTE denied') from unnest(array['anon','authenticated','service_role']) r;
select ok(not has_function_privilege(r,'private.resolve_tenant_entitlements(uuid)','EXECUTE'),r||' resolver EXECUTE denied') from unnest(array['anon','authenticated','service_role']) r;
select ok((select not prosecdef and provolatile='v' and proconfig=array['search_path=pg_catalog'] from pg_proc where oid='private.resolve_tenant_entitlements(uuid)'::regprocedure),'resolver metadata unchanged');
select is(current_setting('transaction_isolation'),'read committed','existing protocol isolation');
select is((select commercial_condition from private.resolve_tenant_entitlements(pg_temp.coordination_id(1))),'unassigned','first subscription starts without a row');
select lives_ok($$select private.set_tenant_subscription(pg_temp.coordination_id(1),'coordination_041','pending',null,null,null,null)$$,'initial insert works under tenant coordination');
select is((select status from public.tenant_subscriptions where barbershop_id=pg_temp.coordination_id(1)),'pending','pending persisted literally');
update public.tenant_subscriptions set created_at=now()-interval '1 day' where barbershop_id=pg_temp.coordination_id(1);
select lives_ok($$select private.set_tenant_subscription(pg_temp.coordination_id(1),'coordination_041','trialing','2030-01-01Z','2030-01-31Z','2030-01-01Z','2030-02-01Z')$$,'full replacement accepts explicit pairs');
select ok((select created_at=now()-interval '1 day' and updated_at=now() from public.tenant_subscriptions where barbershop_id=pg_temp.coordination_id(1)),'created_at preserved and updated_at remains transaction timestamp');
select results_eq($$select status,trial_started_at,trial_ends_at,current_period_started_at,current_period_ends_at from public.tenant_subscriptions where barbershop_id=pg_temp.coordination_id(1)$$,$$select 'trialing'::text,'2030-01-01Z'::timestamptz,'2030-01-31Z'::timestamptz,'2030-01-01Z'::timestamptz,'2030-02-01Z'::timestamptz$$,'full state persisted');
select lives_ok($$select private.set_tenant_subscription(pg_temp.coordination_id(1),'coordination_041','canceled',null,null,null,null)$$,'last replacement works without a transition matrix');
select ok((select trial_started_at is null and trial_ends_at is null and current_period_started_at is null and current_period_ends_at is null from public.tenant_subscriptions where barbershop_id=pg_temp.coordination_id(1)),'NULL clears optional pairs');
select is((select count(*) from public.tenant_subscriptions where barbershop_id=pg_temp.coordination_id(1) and status='canceled'),1::bigint,'one current canceled subscription');
select is((select commercial_condition from private.resolve_tenant_entitlements(pg_temp.coordination_id(2))),'unassigned','other tenant unchanged');
select ok((select not can_create_internal_appointment and not can_accept_public_booking from private.resolve_tenant_entitlements(pg_temp.coordination_id(1))),'resolver remains observationally restrictive');
select set_config('request.jwt.claim.sub',pg_temp.coordination_id(101)::text,true);
set local role authenticated;
select lives_ok($$select public.create_owner_appointment(pg_temp.coordination_id(20),pg_temp.coordination_id(10),'Owner fixture','11999999999','2035-01-08T09:00Z')$$,'owner creation is NOT commercially blocked');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.coordination_id(102)::text,true);
set local role authenticated;
select lives_ok($$select * from public.create_barber_appointment(pg_temp.coordination_id(20),'Barber fixture','11999999998','2035-01-08T10:00Z')$$,'barber creation is NOT commercially blocked');
reset role;
set local role service_role;
select throws_ok($$select public.create_public_appointment('eeee0041-0000-4000-8000-000000000001','eeee0041-0000-4000-8000-000000000010','eeee0041-0000-4000-8000-000000000020','Public fixture','11999999997','2035-01-08T11:00Z','2035-01-08T11:30Z')$$,'P0001','PUBLIC_APPOINTMENT_COMMERCIAL_UNAVAILABLE','042 denies public creation in canceled state');
reset role;
select is((select count(*) from public.appointments where barbershop_id=pg_temp.coordination_id(1)),2::bigint,'owner and barber still create despite canceled state; denied public write inserts nothing');
set local role anon;
select throws_ok($$select private.set_tenant_subscription('eeee0041-0000-4000-8000-000000000001','coordination_041','active',null,null,null,null)$$,'42501',null,'anon actual write denied');
reset role;
set local role authenticated;
select throws_ok($$select private.set_tenant_subscription('eeee0041-0000-4000-8000-000000000001','coordination_041','active',null,null,null,null)$$,'42501',null,'authenticated actual write denied');
reset role;
set local role service_role;
select throws_ok($$select private.set_tenant_subscription('eeee0041-0000-4000-8000-000000000001','coordination_041','active',null,null,null,null)$$,'42501',null,'service_role actual write denied');
reset role;
select ok((select bool_and(not has_table_privilege(r,t,'SELECT,INSERT,UPDATE,DELETE') and not has_any_column_privilege(r,t,'SELECT,INSERT,UPDATE,REFERENCES')) from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['public.commercial_plans','public.tenant_subscriptions']) t),'commercial table and column CRUD remain closed');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='private.resolve_tenant_entitlements(uuid)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC resolver EXECUTE remains denied');
select * from finish();
rollback;
