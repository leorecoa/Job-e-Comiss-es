-- Synthetic local fixtures only; every change rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(35);
create function pg_temp.fixture_id(n integer) returns uuid language sql immutable as $$
  select ('eeee0029-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.slots(p_service uuid default pg_temp.fixture_id(5), p_day date default date '2030-01-07')
returns table(start_at timestamptz,end_at timestamptz) language sql stable security invoker as $$
  select * from public.get_barber_availability(p_service,p_day)
$$;
insert into public.barbershops(id,name,slug,operational_timezone,slot_step_minutes,business_hours)
select pg_temp.fixture_id(n),'Barber reader fixture','barber-reader-'||n,'UTC',30,
 (select jsonb_object_agg(d,jsonb_build_object('active',true,'open','09:00','close','12:00'))
 from unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday']) d)
from generate_series(1,2) n;
insert into public.barbers(id,name,barbershop_id) values
(pg_temp.fixture_id(3),'Same name',pg_temp.fixture_id(1)),
(pg_temp.fixture_id(4),'Same name',pg_temp.fixture_id(2)),
(pg_temp.fixture_id(7),'Same name',pg_temp.fixture_id(1)),
(pg_temp.fixture_id(8),'Inactive profile professional',pg_temp.fixture_id(1));
insert into public.services(id,name,barbershop_id,price,duration_minutes,commission_rate) values
(pg_temp.fixture_id(5),'Service',pg_temp.fixture_id(1),50,30,40),
(pg_temp.fixture_id(6),'Service',pg_temp.fixture_id(2),50,30,40);
insert into auth.users(id,aud,role,email)
select pg_temp.fixture_id(n),'authenticated','authenticated','barber-reader-'||n||'@example.test'
from generate_series(101,106) n;
insert into public.profiles(id,role,active,barbershop_id,barber_id) values
(pg_temp.fixture_id(101),'barber',true,pg_temp.fixture_id(1),pg_temp.fixture_id(3)),
(pg_temp.fixture_id(102),'owner',true,pg_temp.fixture_id(1),null),
(pg_temp.fixture_id(104),'barber',false,pg_temp.fixture_id(1),pg_temp.fixture_id(8)),
(pg_temp.fixture_id(105),'barber',true,null,null),
(pg_temp.fixture_id(106),'barber',true,pg_temp.fixture_id(2),pg_temp.fixture_id(4))
on conflict(id) do update set role=excluded.role,active=excluded.active,
barbershop_id=excluded.barbershop_id,barber_id=excluded.barber_id;
delete from public.profiles where id=pg_temp.fixture_id(103);

select ok(has_function_privilege('authenticated','public.get_barber_availability(uuid,date)','EXECUTE'),'authenticated execute');
select ok(not has_function_privilege('anon','public.get_barber_availability(uuid,date)','EXECUTE'),'anon denied');
select ok(not has_function_privilege('service_role','public.get_barber_availability(uuid,date)','EXECUTE'),'service_role denied');
select ok(not exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 where p.oid='public.get_barber_availability(uuid,date)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC denied');
select ok(not has_function_privilege('authenticated','private.get_availability_slots(uuid,uuid,uuid,date,uuid)','EXECUTE')
 and not has_function_privilege('anon','private.get_availability_slots(uuid,uuid,uuid,date,uuid)','EXECUTE')
 and not has_function_privilege('service_role','private.get_availability_slots(uuid,uuid,uuid,date,uuid)','EXECUTE'),'helper remains private');
select is(pg_get_function_arguments('public.get_barber_availability(uuid,date)'::regprocedure),'p_service_id uuid, p_local_date date','no tenant barber exclusion timezone or duration parameters');
select is(pg_get_function_result('public.get_barber_availability(uuid,date)'::regprocedure),'TABLE(start_at timestamp with time zone, end_at timestamp with time zone)','timestamps only');
select ok((select prosecdef and provolatile='s' and proconfig=array['search_path=pg_catalog'] from pg_proc where oid='public.get_barber_availability(uuid,date)'::regprocedure),'safe stable definer');
set local role anon;
select throws_ok($$select * from pg_temp.slots()$$,'42501',null,'anon invocation denied');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select throws_ok($$select * from pg_temp.slots()$$,'P0001','BARBER_APPOINTMENT_UNAUTHENTICATED','no identity denied');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(102)::text,true);
set local role authenticated;
select throws_ok($$select * from pg_temp.slots()$$,'P0001','BARBER_APPOINTMENT_FORBIDDEN','owner denied');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(103)::text,true);
set local role authenticated;
select throws_ok($$select * from pg_temp.slots()$$,'P0001','BARBER_APPOINTMENT_FORBIDDEN','missing profile denied');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(104)::text,true);
set local role authenticated;
select throws_ok($$select * from pg_temp.slots()$$,'P0001','BARBER_APPOINTMENT_FORBIDDEN','inactive profile denied');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(105)::text,true);
set local role authenticated;
select throws_ok($$select * from pg_temp.slots()$$,'P0001','BARBER_APPOINTMENT_FORBIDDEN','unlinked barber denied');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(101)::text,true);
set local role authenticated;
select is((select count(*) from pg_temp.slots()),6::bigint,'valid barber inherit');
select throws_ok($$select * from pg_temp.slots(pg_temp.fixture_id(6))$$,'22023','PUBLIC_AVAILABILITY_INVALID_SERVICE','foreign service denied');
select throws_ok($$select * from pg_temp.slots(pg_temp.fixture_id(999))$$,'22023','PUBLIC_AVAILABILITY_INVALID_SERVICE','missing service denied');
reset role;
update public.services set active=false where id=pg_temp.fixture_id(5);
set local role authenticated;
select throws_ok($$select * from pg_temp.slots()$$,'22023','PUBLIC_AVAILABILITY_INVALID_SERVICE','inactive service denied');
reset role;
update public.services set active=true where id=pg_temp.fixture_id(5);
update public.barbers set active=false where id=pg_temp.fixture_id(3);
set local role authenticated;
select throws_ok($$select * from pg_temp.slots()$$,'P0001','BARBER_APPOINTMENT_INVALID_BARBER','inactive barber denied');
reset role;
update public.barbers set active=true where id=pg_temp.fixture_id(3);

insert into public.appointments(id,barbershop_id,barber_id,barber_name,service_id,service_type,service_value,client_name,client_phone,start_at,end_at,status)
select pg_temp.fixture_id(n),pg_temp.fixture_id(1),pg_temp.fixture_id(b),'Same name',pg_temp.fixture_id(5),'Service',50,'Fixture','11999999999',t,t+interval '30 minutes',s
from (values(20,3,timestamptz '2030-01-07T09:00Z','scheduled'),(21,3,timestamptz '2030-01-07T10:00Z','confirmed'),
 (22,3,timestamptz '2030-01-07T11:00Z','completed'),(23,7,timestamptz '2030-01-07T09:30Z','scheduled')) v(n,b,t,s);
set local role authenticated;
select results_eq($$select start_at from pg_temp.slots()$$,
 $$select unnest(array[timestamptz '2030-01-07T09:30Z',timestamptz '2030-01-07T10:30Z',timestamptz '2030-01-07T11:00Z',timestamptz '2030-01-07T11:30Z'])$$,
 'own scheduled and confirmed block; completed and homonymous other barber do not');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(106)::text,true);
set local role authenticated;
select is((select count(*) from pg_temp.slots(pg_temp.fixture_id(6))),6::bigint,'other tenant reads its own barber only');
select throws_ok($$select * from pg_temp.slots()$$,'22023','PUBLIC_AVAILABILITY_INVALID_SERVICE','other tenant cannot read first tenant service');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(101)::text,true);
delete from public.appointments where barbershop_id=pg_temp.fixture_id(1);
insert into public.barber_time_off(barbershop_id,barber_id,starts_at,ends_at)
values(pg_temp.fixture_id(1),pg_temp.fixture_id(3),'2030-01-07T09:30Z','2030-01-07T10:00Z');
set local role authenticated;
select results_eq($$select start_at from pg_temp.slots() limit 2$$,$$values(timestamptz '2030-01-07T09:00Z'),(timestamptz '2030-01-07T10:00Z')$$,'time off blocks with adjacency allowed');
reset role;
delete from public.barber_time_off where barber_id=pg_temp.fixture_id(3);
update public.barbers set availability_mode='custom' where id=pg_temp.fixture_id(3);
update public.barbershops set business_hours=null where id=pg_temp.fixture_id(1);
insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time) values
(pg_temp.fixture_id(1),pg_temp.fixture_id(3),1,'09:10','10:10'),(pg_temp.fixture_id(1),pg_temp.fixture_id(3),1,'13:15','14:15');
set local role authenticated;
select results_eq($$select start_at from pg_temp.slots()$$,$$select unnest(array[timestamptz '2030-01-07T09:10Z',timestamptz '2030-01-07T09:40Z',timestamptz '2030-01-07T13:15Z',timestamptz '2030-01-07T13:45Z'])$$,'custom periods anchor step without global hours');
reset role;
update public.services set duration_minutes=45 where id=pg_temp.fixture_id(5);
set local role authenticated;
select results_eq($$select * from pg_temp.slots()$$,$$values(timestamptz '2030-01-07T09:10Z',timestamptz '2030-01-07T09:55Z'),(timestamptz '2030-01-07T13:15Z',timestamptz '2030-01-07T14:00Z')$$,'catalogue 45 minutes full fit without step rounding');
reset role;
select results_eq($$select * from pg_temp.slots()$$,$$select * from public.get_public_availability_by_slug('barber-reader-1',pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2030-01-07')$$,'public reader parity');
select ok((select bool_and(private.validate_appointment_availability(pg_temp.fixture_id(1),pg_temp.fixture_id(3),pg_temp.fixture_id(5),s.start_at)=s.end_at) from pg_temp.slots() s),'027 validates returned slots');
update public.barbershops set operational_timezone=null,financial_timezone='America/Recife' where id=pg_temp.fixture_id(1);
set local role authenticated;
select throws_ok($$select * from pg_temp.slots()$$,'22023','PUBLIC_AVAILABILITY_TIMEZONE_REQUIRED','no financial timezone fallback');
reset role;
update public.barbershops set operational_timezone='America/New_York',business_hours=(select jsonb_object_agg(d,jsonb_build_object('active',true,'open','01:00','close','04:00')) from unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday']) d) where id=pg_temp.fixture_id(1);
update public.barbers set availability_mode='inherit' where id=pg_temp.fixture_id(3);
update public.services set duration_minutes=30 where id=pg_temp.fixture_id(5);
set local role authenticated;
select results_eq($$select start_at from pg_temp.slots(pg_temp.fixture_id(5),'2030-03-10')$$,$$select unnest(array[timestamptz '2030-03-10T06:00Z',timestamptz '2030-03-10T06:30Z',timestamptz '2030-03-10T07:00Z',timestamptz '2030-03-10T07:30Z'])$$,'shared engine DST gap');
select results_eq($$select start_at from pg_temp.slots(pg_temp.fixture_id(5),'2030-11-03') limit 2$$,$$values(timestamptz '2030-11-03T06:00Z'),(timestamptz '2030-11-03T06:30Z')$$,'shared engine DST fold standard occurrence');
select is((select count(*) from pg_temp.slots(pg_temp.fixture_id(5),'2000-01-03')),0::bigint,'past slots omitted');
select throws_ok($$select * from pg_temp.slots(pg_temp.fixture_id(5),null)$$,'22023','PUBLIC_AVAILABILITY_INVALID_DATE','null date rejected');
reset role;
select ok(not has_table_privilege('authenticated','public.appointments','SELECT') and not has_table_privilege('authenticated','public.appointments','UPDATE'),'no direct privilege expansion');
select ok(has_function_privilege('authenticated','public.create_barber_appointment(uuid,text,text,timestamptz,text)','EXECUTE'),'writer ACL preserved');
select ok(has_function_privilege('service_role','public.get_public_availability_by_slug(text,uuid,uuid,date)','EXECUTE') and not has_function_privilege('authenticated','public.get_public_availability_by_slug(text,uuid,uuid,date)','EXECUTE'),'proxy ACL preserved');
select * from finish();
rollback;
