-- Synthetic fixtures only; no administrative state survives this test.
begin;
create extension if not exists pgtap with schema extensions;
select plan(58);
create function pg_temp.writer_id(n integer) returns uuid language sql immutable as $$
  select ('eeee0038-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
insert into public.barbershops(id,name,slug)
select pg_temp.writer_id(n),'Writer fixture','subscription-writer-'||n from generate_series(1,3) n;
insert into public.commercial_plans(code,name) values ('writer_a','Writer A'),('writer_b','Writer B');
insert into auth.users(id,aud,role,email,raw_user_meta_data)
select pg_temp.writer_id(n),'authenticated','authenticated','writer-'||n||'@example.test','{"role":"owner"}'::jsonb
from generate_series(101,103) n;
update public.profiles set barbershop_id=pg_temp.writer_id(1) where id=pg_temp.writer_id(101);
update public.profiles set barbershop_id=pg_temp.writer_id(2) where id=pg_temp.writer_id(102);
update public.profiles set barbershop_id=pg_temp.writer_id(3) where id=pg_temp.writer_id(103);
select ok((select not prosecdef and provolatile='v' and proconfig=array['search_path=pg_catalog'] and pronargdefaults=0
  from pg_proc where oid='private.set_tenant_subscription(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz)'::regprocedure),'restricted invoker, volatile, explicit arguments');
select is(pg_get_function_result('private.set_tenant_subscription(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz)'::regprocedure),'void','no administrative data returned');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid='private.set_tenant_subscription(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC denied');
select lives_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_a','pending',null,null,null,null)$$,'administrative creation');
select lives_ok($$select private.set_tenant_subscription(pg_temp.writer_id(2),'writer_b','paused',null,null,null,null)$$,'second tenant creation');
create temp table foreign_snapshot as select to_jsonb(s) as snapshot from public.tenant_subscriptions s where barbershop_id=pg_temp.writer_id(2);
update public.tenant_subscriptions set created_at=now()-interval '1 day' where barbershop_id=pg_temp.writer_id(1);
select lives_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_b','trialing','2030-01-01Z','2030-01-08Z','2030-01-01Z','2030-02-01Z')$$,'administrative replacement with explicit dates');
select results_eq($$select plan_code,status,trial_started_at,trial_ends_at,current_period_started_at,current_period_ends_at from public.tenant_subscriptions where barbershop_id=pg_temp.writer_id(1)$$,
  $$select 'writer_b'::text,'trialing'::text,'2030-01-01Z'::timestamptz,'2030-01-08Z'::timestamptz,'2030-01-01Z'::timestamptz,'2030-02-01Z'::timestamptz$$,'full explicit state persisted');
select ok((select created_at=now()-interval '1 day' and updated_at=now() from public.tenant_subscriptions where barbershop_id=pg_temp.writer_id(1)),'creation preserved and existing update trigger honored');
select lives_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_a','active',null,null,null,null)$$,'active accepted without transition inference');
select is((select status from public.tenant_subscriptions where barbershop_id=pg_temp.writer_id(1)),'active','active remains persisted');
select lives_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_a','paused',null,null,null,null)$$,'paused accepted without transition inference');
select is((select status from public.tenant_subscriptions where barbershop_id=pg_temp.writer_id(1)),'paused','paused remains persisted');
select lives_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_a','canceled',null,null,null,null)$$,'canceled accepted without transition inference');
select is((select status from public.tenant_subscriptions where barbershop_id=pg_temp.writer_id(1)),'canceled','canceled remains persisted');
select lives_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_a','pending',null,null,null,null)$$,'pending accepted without transition inference');
select is((select status from public.tenant_subscriptions where barbershop_id=pg_temp.writer_id(1)),'pending','pending remains persisted');
select ok((select trial_started_at is null and trial_ends_at is null and current_period_started_at is null and current_period_ends_at is null from public.tenant_subscriptions where barbershop_id=pg_temp.writer_id(1)),'explicit NULL clears pairs');
create temp table before_failure as select to_jsonb(s) as snapshot from public.tenant_subscriptions s where barbershop_id=pg_temp.writer_id(1);
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(999),'writer_a','active',null,null,null,null)$$,'P0001','TENANT_SUBSCRIPTION_TENANT_NOT_FOUND','rejects unknown tenant');
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'missing','active',null,null,null,null)$$,'P0001','TENANT_SUBSCRIPTION_PLAN_NOT_FOUND','rejects unknown plan');
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_a','unassigned',null,null,null,null)$$,'P0001','TENANT_SUBSCRIPTION_INVALID_STATUS','rejects invalid status unassigned');
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_a','paid',null,null,null,null)$$,'P0001','TENANT_SUBSCRIPTION_INVALID_STATUS','rejects invalid status paid');
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_a',null,null,null,null,null)$$,'P0001','TENANT_SUBSCRIPTION_INVALID_STATUS','rejects invalid status null');
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_b','trialing',null,null,null,null)$$,'23514',null,'rejects trial requires dates');
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_b','active','2030-01-01Z',null,null,null)$$,'23514',null,'rejects incomplete trial');
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_b','active',null,'2030-01-01Z',null,null)$$,'23514',null,'rejects missing trial start');
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_b','active','2030-02-01Z','2030-01-01Z',null,null)$$,'23514',null,'rejects reversed trial');
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_b','active','2030-01-01Z','2030-01-01Z',null,null)$$,'23514',null,'rejects empty trial');
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_b','active','2030-01-01Z','infinity',null,null)$$,'23514',null,'rejects infinite trial');
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_b','active',null,null,'2030-01-01Z',null)$$,'23514',null,'rejects incomplete period');
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_b','active',null,null,null,'2030-01-01Z')$$,'23514',null,'rejects missing period start');
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_b','active',null,null,'2030-02-01Z','2030-01-01Z')$$,'23514',null,'rejects reversed period');
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_b','active',null,null,'2030-01-01Z','2030-01-01Z')$$,'23514',null,'rejects empty period');
select throws_ok($$select private.set_tenant_subscription(pg_temp.writer_id(1),'writer_b','active',null,null,'-infinity','2030-01-01Z')$$,'23514',null,'rejects infinite period');
select is((select to_jsonb(s) from public.tenant_subscriptions s where barbershop_id=pg_temp.writer_id(1)),(select snapshot from before_failure),'failures leave no partial update');
select is((select count(*) from public.tenant_subscriptions where barbershop_id=pg_temp.writer_id(1)),1::bigint,'one current subscription after replacements');
select is((select to_jsonb(s) from public.tenant_subscriptions s where barbershop_id=pg_temp.writer_id(2)),(select snapshot from foreign_snapshot),'foreign tenant unchanged');
select ok(not has_function_privilege('anon','private.set_tenant_subscription(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz)','EXECUTE'),'anon has no EXECUTE');
select ok(not has_table_privilege('anon',t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not has_any_column_privilege('anon',t,'SELECT,INSERT,UPDATE,REFERENCES'),'anon: table and column ACL closed '||t)
from unnest(array['public.commercial_plans','public.tenant_subscriptions']) t;
set local role anon;
select throws_ok($$select private.set_tenant_subscription('eeee0038-0000-4000-8000-000000000001','writer_a','active',null,null,null,null)$$,'42501',null,'anon actual call denied');
reset role;
select ok(not has_function_privilege('authenticated','private.set_tenant_subscription(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz)','EXECUTE'),'authenticated has no EXECUTE');
select ok(not has_table_privilege('authenticated',t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not has_any_column_privilege('authenticated',t,'SELECT,INSERT,UPDATE,REFERENCES'),'authenticated: table and column ACL closed '||t)
from unnest(array['public.commercial_plans','public.tenant_subscriptions']) t;
set local role authenticated;
select throws_ok($$select private.set_tenant_subscription('eeee0038-0000-4000-8000-000000000001','writer_a','active',null,null,null,null)$$,'42501',null,'authenticated actual call denied');
reset role;
select ok(not has_function_privilege('service_role','private.set_tenant_subscription(uuid,text,text,timestamptz,timestamptz,timestamptz,timestamptz)','EXECUTE'),'service_role has no EXECUTE');
select ok(not has_table_privilege('service_role',t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not has_any_column_privilege('service_role',t,'SELECT,INSERT,UPDATE,REFERENCES'),'service_role: table and column ACL closed '||t)
from unnest(array['public.commercial_plans','public.tenant_subscriptions']) t;
set local role service_role;
select throws_ok($$select private.set_tenant_subscription('eeee0038-0000-4000-8000-000000000001','writer_a','active',null,null,null,null)$$,'42501',null,'service_role actual call denied');
reset role;
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.commercial_plans'::regclass,'public.tenant_subscriptions'::regclass)),'RLS still enabled');
select is((select count(*) from pg_policies where schemaname='public' and tablename in ('commercial_plans','tenant_subscriptions')),0::bigint,'no policies added');
select set_config('request.jwt.claim.sub',pg_temp.writer_id(101)::text,true);
set local role authenticated;
select results_eq($$select status,plan_code from public.get_tenant_commercial_state()$$,$$select 'pending'::text,'writer_a'::text$$,'owner 101 observes only own pending state');
select throws_ok($$select private.set_tenant_subscription('eeee0038-0000-4000-8000-000000000002','writer_a','active',null,null,null,null)$$,'42501',null,'owner cannot write even with another tenant ID');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.writer_id(102)::text,true);
set local role authenticated;
select results_eq($$select status,plan_code from public.get_tenant_commercial_state()$$,$$select 'paused'::text,'writer_b'::text$$,'owner 102 observes only own paused state');
select throws_ok($$select private.set_tenant_subscription('eeee0038-0000-4000-8000-000000000002','writer_a','active',null,null,null,null)$$,'42501',null,'owner cannot write even with another tenant ID');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.writer_id(103)::text,true);
set local role authenticated;
select results_eq($$select status,plan_code from public.get_tenant_commercial_state()$$,$$select 'unassigned'::text,null::text$$,'owner 103 observes only own unassigned state');
select throws_ok($$select private.set_tenant_subscription('eeee0038-0000-4000-8000-000000000002','writer_a','active',null,null,null,null)$$,'42501',null,'owner cannot write even with another tenant ID');
reset role;
select is((select count(*) from public.tenant_subscriptions where barbershop_id=pg_temp.writer_id(3)),0::bigint,'unassigned tenant remains without subscription');
insert into public.barbers(id,name,barbershop_id) values(pg_temp.writer_id(10),'Writer barber',pg_temp.writer_id(3));
update public.profiles set role='barber',barber_id=pg_temp.writer_id(10) where id=pg_temp.writer_id(103);
set local role authenticated;
select throws_ok($$select private.set_tenant_subscription('eeee0038-0000-4000-8000-000000000003','writer_a','active',null,null,null,null)$$,'42501',null,'barber cannot assign own commercial state');
reset role;
select * from finish();
rollback;
