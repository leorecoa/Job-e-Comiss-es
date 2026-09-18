-- Local fixtures only. No persistent users or data: entire file rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(69);

create function pg_temp.fixture_id(n integer) returns uuid
language sql immutable as $$
  select ('eeee0028-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.owner_slots(
  p_id uuid default null, p_service uuid default pg_temp.fixture_id(5),
  p_barber uuid default pg_temp.fixture_id(3), p_day date default date '2030-01-07'
) returns table(start_at timestamptz,end_at timestamptz)
language sql stable security invoker as $$
  select * from public.get_owner_availability(p_service,p_barber,p_day,p_id)
$$;

insert into public.barbershops(id,name,slug,operational_timezone,slot_step_minutes,business_hours)
select pg_temp.fixture_id(n),'Owner availability fixture','owner-availability-'||n,'UTC',30,
  (select jsonb_object_agg(day,jsonb_build_object('active',true,'open','09:00','close','12:00'))
   from unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday']) day)
from generate_series(1,2) n;
insert into public.barbers(id,name,barbershop_id) values
(pg_temp.fixture_id(3),'Own',pg_temp.fixture_id(1)),
(pg_temp.fixture_id(4),'Foreign',pg_temp.fixture_id(2)),
(pg_temp.fixture_id(9),'Second own',pg_temp.fixture_id(1));
insert into public.services(id,name,barbershop_id,price,duration_minutes,commission_rate) values
(pg_temp.fixture_id(5),'Own 30',pg_temp.fixture_id(1),50,30,40),
(pg_temp.fixture_id(6),'Foreign',pg_temp.fixture_id(2),50,30,40),
(pg_temp.fixture_id(7),'Own 45',pg_temp.fixture_id(1),50,45,40),
(pg_temp.fixture_id(8),'Own 60',pg_temp.fixture_id(1),50,60,40);
insert into auth.users(id,aud,role,email)
select pg_temp.fixture_id(n),'authenticated','authenticated','availability-'||n||'@example.test'
from generate_series(101,106) n;
insert into public.profiles(id,role,active,barbershop_id,barber_id) values
(pg_temp.fixture_id(101),'owner',true,pg_temp.fixture_id(1),null),
(pg_temp.fixture_id(102),'barber',true,pg_temp.fixture_id(1),pg_temp.fixture_id(3)),
(pg_temp.fixture_id(104),'owner',true,pg_temp.fixture_id(2),null),
(pg_temp.fixture_id(105),'owner',false,pg_temp.fixture_id(1),null),
(pg_temp.fixture_id(106),'owner',true,null,null)
on conflict(id) do update set role=excluded.role,active=excluded.active,
barbershop_id=excluded.barbershop_id,barber_id=excluded.barber_id;
delete from public.profiles where id=pg_temp.fixture_id(103);

select ok(has_function_privilege('authenticated','public.get_owner_availability(uuid,uuid,date,uuid)','EXECUTE'),'authenticated can execute owner reader');
select ok(not has_function_privilege('anon','public.get_owner_availability(uuid,uuid,date,uuid)','EXECUTE'),'anon cannot execute owner reader');
select ok(not has_function_privilege('service_role','public.get_owner_availability(uuid,uuid,date,uuid)','EXECUTE'),'service_role not granted owner reader');
select ok(not exists(
  select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid in ('public.get_owner_availability(uuid,uuid,date,uuid)'::regprocedure,
    'private.get_availability_slots(uuid,uuid,uuid,date,uuid)'::regprocedure,
    'public.get_public_availability_by_slug(text,uuid,uuid,date)'::regprocedure)
  and a.grantee=0 and a.privilege_type='EXECUTE'
),'PUBLIC has no execute on wrappers or helper');
select ok(not has_function_privilege('authenticated','private.get_availability_slots(uuid,uuid,uuid,date,uuid)','EXECUTE')
 and not has_function_privilege('anon','private.get_availability_slots(uuid,uuid,uuid,date,uuid)','EXECUTE')
 and not has_function_privilege('service_role','private.get_availability_slots(uuid,uuid,uuid,date,uuid)','EXECUTE'),'helper unavailable to client roles');
select ok((select prosecdef and provolatile='s' and proconfig=array['search_path=pg_catalog']
 from pg_proc where oid='public.get_owner_availability(uuid,uuid,date,uuid)'::regprocedure),'owner reader safe definer and stable snapshot');
select ok((select not prosecdef and provolatile='s' and proconfig=array['search_path=pg_catalog']
 from pg_proc where oid='private.get_availability_slots(uuid,uuid,uuid,date,uuid)'::regprocedure),'helper is restricted invoker');
select is(pg_get_function_result('public.get_owner_availability(uuid,uuid,date,uuid)'::regprocedure),
 'TABLE(start_at timestamp with time zone, end_at timestamp with time zone)','timestamps only');
select is((select pronargdefaults from pg_proc where oid='public.get_owner_availability(uuid,uuid,date,uuid)'::regprocedure),1::smallint,'optional appointment argument');
select ok(has_function_privilege('service_role','public.get_public_availability_by_slug(text,uuid,uuid,date)','EXECUTE')
 and not has_function_privilege('authenticated','public.get_public_availability_by_slug(text,uuid,uuid,date)','EXECUTE')
 and not has_function_privilege('anon','public.get_public_availability_by_slug(text,uuid,uuid,date)','EXECUTE'),'public proxy ACL preserved');
select ok(not has_table_privilege('authenticated','public.appointments','SELECT')
 and not has_table_privilege('anon','public.appointments','SELECT'),'no direct appointment read expansion');

set local role anon;
select throws_ok($$select * from pg_temp.owner_slots()$$,'42501',null,'anon call rejected');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select throws_ok($$select * from pg_temp.owner_slots()$$,'P0001','OWNER_AVAILABILITY_FORBIDDEN','missing identity rejected');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(103)::text,true);
set local role authenticated;
select throws_ok($$select * from pg_temp.owner_slots()$$,'P0001','OWNER_AVAILABILITY_FORBIDDEN','missing profile rejected');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(102)::text,true);
set local role authenticated;
select throws_ok($$select * from pg_temp.owner_slots()$$,'P0001','OWNER_AVAILABILITY_FORBIDDEN','barber rejected');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(105)::text,true);
set local role authenticated;
select throws_ok($$select * from pg_temp.owner_slots()$$,'P0001','OWNER_AVAILABILITY_FORBIDDEN','inactive owner rejected');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(106)::text,true);
set local role authenticated;
select throws_ok($$select * from pg_temp.owner_slots()$$,'P0001','OWNER_AVAILABILITY_FORBIDDEN','tenantless owner rejected');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(104)::text,true);
set local role authenticated;
select throws_ok($$select * from pg_temp.owner_slots()$$,'22023','PUBLIC_AVAILABILITY_INVALID_BARBER','other owner cannot read first tenant');
select is((select count(*) from pg_temp.owner_slots(null,pg_temp.fixture_id(6),pg_temp.fixture_id(4))),6::bigint,'other owner reads only own tenant');
reset role;
select set_config('request.jwt.claim.sub',pg_temp.fixture_id(101)::text,true);
set local role authenticated;
select is((select count(*) from pg_temp.owner_slots()),6::bigint,'active owner create mode inherit');
select results_eq(
 $$select * from public.get_owner_availability(pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2030-01-07') order by start_at$$,
 $$select * from public.get_owner_availability(pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2030-01-07',null) order by start_at$$,
 'three argument call equals explicit NULL appointment');
select results_eq($$select * from pg_temp.owner_slots() limit 1$$,
 $$select timestamptz '2030-01-07T09:00Z',timestamptz '2030-01-07T09:30Z'$$,'exact catalogue duration and step');
select throws_ok($$select * from pg_temp.owner_slots(null,pg_temp.fixture_id(6))$$,'22023','PUBLIC_AVAILABILITY_INVALID_SERVICE','foreign service rejected');
select throws_ok($$select * from pg_temp.owner_slots(null,pg_temp.fixture_id(5),pg_temp.fixture_id(4))$$,'22023','PUBLIC_AVAILABILITY_INVALID_BARBER','foreign barber rejected');
select throws_ok($$select * from pg_temp.owner_slots(pg_temp.fixture_id(999))$$,'P0001','OWNER_AVAILABILITY_APPOINTMENT_NOT_FOUND','nonexistent appointment rejected');
select throws_ok($$select * from pg_temp.owner_slots(null,pg_temp.fixture_id(5),pg_temp.fixture_id(3),null)$$,'22023','PUBLIC_AVAILABILITY_INVALID_DATE','null date rejected');
select is((select count(*) from pg_temp.owner_slots(null,pg_temp.fixture_id(7))),5::bigint,'45 minute service not rounded to step');
select ok((select bool_and(end_at-start_at=interval '45 minutes' and end_at<=timestamptz '2030-01-07T12:00Z')
 from pg_temp.owner_slots(null,pg_temp.fixture_id(7))),'45 minutes full interval fit');
select is((select count(*) from pg_temp.owner_slots(null,pg_temp.fixture_id(8))),5::bigint,'60 minute service step 30');
reset role;
select results_eq($$select * from pg_temp.owner_slots()$$,
 $$select * from public.get_public_availability_by_slug('owner-availability-1',pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2030-01-07')$$,'public and owner create parity');
select ok((select bool_and(private.validate_appointment_availability(pg_temp.fixture_id(1),pg_temp.fixture_id(3),pg_temp.fixture_id(5),s.start_at)=s.end_at)
 from pg_temp.owner_slots() s),'inherit reader slots satisfy unchanged 027 validator');

insert into public.appointments(id,barbershop_id,barber_id,barber_name,service_id,service_type,service_value,commission_rate,client_name,client_phone,start_at,end_at,status)
select pg_temp.fixture_id(n),pg_temp.fixture_id(case when n=27 then 2 else 1 end),
 pg_temp.fixture_id(case when n=27 then 4 else 3 end),'Fixture',
 pg_temp.fixture_id(case when n=27 then 6 else 5 end),'Fixture',50,40,'Fixture','11999999999',
 stamp,stamp+interval '30 minutes',status
from (values
 (20,timestamptz '2030-01-07T09:00Z','scheduled'),
 (21,timestamptz '2030-01-07T10:00Z','confirmed'),
 (22,timestamptz '2030-01-07T11:00Z','completed'),
 (23,timestamptz '2030-01-07T11:30Z','cancelled'),
 (24,timestamptz '2030-01-07T11:30Z','no_show'),
 (25,timestamptz '2030-01-07T11:30Z','cancelled'),
 (26,timestamptz '2030-01-07T11:30Z','cancelled'),
 (27,timestamptz '2030-01-07T09:00Z','scheduled')
) v(n,stamp,status);
update public.appointments set financial_record_id='fixture-pointer' where id=pg_temp.fixture_id(25);
insert into public.financial_records(appointment_id,barbershop_id,barber_id,service_id,service_type,service_value,commission_rate,commission_value,completed_at)
values(pg_temp.fixture_id(26),pg_temp.fixture_id(1),pg_temp.fixture_id(3),pg_temp.fixture_id(5),'Fixture',50,40,20,'2030-01-07T11:30Z');

set local role authenticated;
select throws_ok($$select * from pg_temp.owner_slots(pg_temp.fixture_id(27))$$,'P0001','OWNER_AVAILABILITY_APPOINTMENT_NOT_FOUND','foreign appointment not usable as exclusion');
select is((select count(*) from pg_temp.owner_slots()),4::bigint,'only scheduled and confirmed block create');
select is((select count(*) from pg_temp.owner_slots(pg_temp.fixture_id(20))),5::bigint,'scheduled self exclusion only');
select results_eq(
 $$select * from pg_temp.owner_slots(pg_temp.fixture_id(20),pg_temp.fixture_id(8)) order by start_at$$,
 $$values
   (timestamptz '2030-01-07T09:00Z',timestamptz '2030-01-07T10:00Z'),
   (timestamptz '2030-01-07T10:30Z',timestamptz '2030-01-07T11:30Z'),
   (timestamptz '2030-01-07T11:00Z',timestamptz '2030-01-07T12:00Z')$$,
 'service change derives 60 minutes, excludes self only, and rejects expanded overlap with confirmed appointment');
select ok(exists(select 1 from pg_temp.owner_slots(pg_temp.fixture_id(20)) where start_at='2030-01-07T09:00Z')
 and not exists(select 1 from pg_temp.owner_slots(pg_temp.fixture_id(20)) where start_at='2030-01-07T10:00Z'),'own slot restored other confirmed stays blocked');
select ok(exists(select 1 from pg_temp.owner_slots(pg_temp.fixture_id(21)) where start_at='2030-01-07T10:00Z')
 and not exists(select 1 from pg_temp.owner_slots(pg_temp.fixture_id(21)) where start_at='2030-01-07T09:00Z'),'confirmed self exclusion preserves other scheduled');
select is((select count(*) from pg_temp.owner_slots(pg_temp.fixture_id(20),pg_temp.fixture_id(5),pg_temp.fixture_id(9))),6::bigint,'reschedule may target another own barber');
select throws_ok($$select * from pg_temp.owner_slots(pg_temp.fixture_id(22))$$,'P0001','APPOINTMENT_HISTORY_PROTECTED','completed rejected even without financial link');
select throws_ok($$select * from pg_temp.owner_slots(pg_temp.fixture_id(25))$$,'P0001','APPOINTMENT_HISTORY_PROTECTED','financial pointer protects noncompleted record');
select throws_ok($$select * from pg_temp.owner_slots(pg_temp.fixture_id(26))$$,'P0001','APPOINTMENT_HISTORY_PROTECTED','reverse financial link protects without pointer');
select is((select count(*) from pg_temp.owner_slots(pg_temp.fixture_id(23))),4::bigint,'cancelled nonhistorical may reschedule');
select is((select count(*) from pg_temp.owner_slots(pg_temp.fixture_id(24))),4::bigint,'no show nonhistorical may reschedule');
reset role;
select is((select count(*) from public.appointments where barbershop_id=pg_temp.fixture_id(1) and status in ('scheduled','confirmed')),2::bigint,'reader exclusion never changes appointments');
select results_eq($$select * from pg_temp.owner_slots()$$,
 $$select * from public.get_public_availability_by_slug('owner-availability-1',pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2030-01-07')$$,'public occupancy unchanged by owner exclusion');
select ok((select bool_and(private.validate_appointment_availability(pg_temp.fixture_id(1),pg_temp.fixture_id(3),pg_temp.fixture_id(5),s.start_at,pg_temp.fixture_id(20))=s.end_at)
 from pg_temp.owner_slots(pg_temp.fixture_id(20)) s),'reschedule reader matches 027 self exclusion');

-- Remove only rollback-scoped fixtures before testing configuration variants.
delete from public.financial_records where barbershop_id=pg_temp.fixture_id(1);
delete from public.appointments where barbershop_id in (pg_temp.fixture_id(1),pg_temp.fixture_id(2));
insert into public.barber_time_off(barbershop_id,barber_id,starts_at,ends_at)
values(pg_temp.fixture_id(1),pg_temp.fixture_id(3),'2030-01-07T09:30Z','2030-01-07T10:00Z');
set local role authenticated;
select results_eq($$select start_at from pg_temp.owner_slots() limit 2$$,
 $$select unnest(array[timestamptz '2030-01-07T09:00Z',timestamptz '2030-01-07T10:00Z'])$$,'time off blocks overlap but allows adjacency');
reset role;
delete from public.barber_time_off where barber_id=pg_temp.fixture_id(3);
update public.barbers set availability_mode='custom' where id=pg_temp.fixture_id(3);
update public.barbershops set business_hours=null where id=pg_temp.fixture_id(1);
insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time) values
(pg_temp.fixture_id(1),pg_temp.fixture_id(3),1,'09:10','10:10'),
(pg_temp.fixture_id(1),pg_temp.fixture_id(3),1,'13:15','14:15');
set local role authenticated;
select results_eq($$select start_at from pg_temp.owner_slots()$$,
 $$select unnest(array[timestamptz '2030-01-07T09:10Z',timestamptz '2030-01-07T09:40Z',timestamptz '2030-01-07T13:15Z',timestamptz '2030-01-07T13:45Z'])$$,'custom multiple intervals each anchor step independently without global hours');
select is((select count(*) from pg_temp.owner_slots(null,pg_temp.fixture_id(7))),2::bigint,'custom full fit with catalogue duration 45');
reset role;
select results_eq($$select * from pg_temp.owner_slots()$$,
 $$select * from public.get_public_availability_by_slug('owner-availability-1',pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2030-01-07')$$,'custom public parity');
select ok((select bool_and(private.validate_appointment_availability(pg_temp.fixture_id(1),pg_temp.fixture_id(3),pg_temp.fixture_id(5),s.start_at)=s.end_at)
 from pg_temp.owner_slots() s),'custom reader matches 027');
update public.barbershops set operational_timezone=null,financial_timezone='America/Recife' where id=pg_temp.fixture_id(1);
set local role authenticated;
select throws_ok($$select * from pg_temp.owner_slots()$$,'22023','PUBLIC_AVAILABILITY_TIMEZONE_REQUIRED','null timezone fails closed no financial fallback');
reset role;
update public.barbershops set operational_timezone='UTC',slot_step_minutes=null where id=pg_temp.fixture_id(1);
set local role authenticated;
select throws_ok($$select * from pg_temp.owner_slots()$$,'22023','PUBLIC_AVAILABILITY_SLOT_STEP_REQUIRED','null step fails closed');
reset role;
update public.barbershops set slot_step_minutes=30 where id=pg_temp.fixture_id(1);
update public.barbers set active=false where id=pg_temp.fixture_id(3);
set local role authenticated;
select throws_ok($$select * from pg_temp.owner_slots()$$,'22023','PUBLIC_AVAILABILITY_INVALID_BARBER','inactive barber rejected');
reset role;
update public.barbers set active=true,availability_mode='inherit' where id=pg_temp.fixture_id(3);
update public.services set active=false where id=pg_temp.fixture_id(5);
set local role authenticated;
select throws_ok($$select * from pg_temp.owner_slots()$$,'22023','PUBLIC_AVAILABILITY_INVALID_SERVICE','inactive service rejected');
reset role;
update public.services set active=true where id=pg_temp.fixture_id(5);
set local role authenticated;
select throws_ok($$select * from pg_temp.owner_slots()$$,'22023','PUBLIC_AVAILABILITY_INVALID_BUSINESS_HOURS','malformed inherit hours fail closed');
reset role;
update public.barbershops set active=false where id=pg_temp.fixture_id(1);
set local role authenticated;
select throws_ok($$select * from pg_temp.owner_slots()$$,'22023','PUBLIC_AVAILABILITY_INVALID_TENANT','inactive tenant rejected');
reset role;

update public.barbershops set active=true,operational_timezone='America/New_York',
 business_hours=(select jsonb_object_agg(day,jsonb_build_object('active',true,'open','01:00','close','04:00'))
 from unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday']) day)
where id=pg_temp.fixture_id(1);
set local role authenticated;
select results_eq($$select start_at from pg_temp.owner_slots(null,pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2030-03-10')$$,
 $$select unnest(array[timestamptz '2030-03-10T06:00Z',timestamptz '2030-03-10T06:30Z',timestamptz '2030-03-10T07:00Z',timestamptz '2030-03-10T07:30Z'])$$,'DST gap skips nonexistent times');
reset role;
select results_eq($$select * from pg_temp.owner_slots(null,pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2030-03-10')$$,
 $$select * from public.get_public_availability_by_slug('owner-availability-1',pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2030-03-10')$$,'DST gap public parity');
select ok((select bool_and(private.validate_appointment_availability(pg_temp.fixture_id(1),pg_temp.fixture_id(3),pg_temp.fixture_id(5),s.start_at)=s.end_at)
 from pg_temp.owner_slots(null,pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2030-03-10') s),'DST gap reader matches 027');
update public.barbershops set business_hours=(select jsonb_object_agg(day,jsonb_build_object('active',true,'open','00:00','close','03:00'))
 from unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday']) day)
where id=pg_temp.fixture_id(1);
set local role authenticated;
select results_eq($$select start_at from pg_temp.owner_slots(null,pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2030-11-03')
 where start_at at time zone 'America/New_York' >= timestamp '2030-11-03 01:00'
 and start_at at time zone 'America/New_York' < timestamp '2030-11-03 02:00'$$,
 $$select unnest(array[timestamptz '2030-11-03T06:00Z',timestamptz '2030-11-03T06:30Z'])$$,'DST fold uses standard later occurrence');
reset role;
select results_eq($$select * from pg_temp.owner_slots(null,pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2030-11-03')$$,
 $$select * from public.get_public_availability_by_slug('owner-availability-1',pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2030-11-03')$$,'DST fold public parity');
select ok((select bool_and(private.validate_appointment_availability(pg_temp.fixture_id(1),pg_temp.fixture_id(3),pg_temp.fixture_id(5),s.start_at)=s.end_at)
 from pg_temp.owner_slots(null,pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2030-11-03') s),'DST fold reader matches 027');
update public.barbershops set business_hours=(select jsonb_object_agg(day,jsonb_build_object('active',true,'open','02:00','close','04:00'))
 from unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday']) day)
where id=pg_temp.fixture_id(1);
set local role authenticated;
select is((select count(*) from pg_temp.owner_slots(null,pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2030-03-10')),0::bigint,'nonexistent DST boundary yields no slots');
reset role;
update public.barbershops set business_hours=(select jsonb_object_agg(day,jsonb_build_object('active',true,'open','09:00','close','10:00'))
 from unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday']) day)
where id=pg_temp.fixture_id(1);
set local timezone='Asia/Tokyo';
set local role authenticated;
select results_eq($$select * from pg_temp.owner_slots() limit 1$$,
 $$select timestamptz '2030-01-07T14:00Z',timestamptz '2030-01-07T14:30Z'$$,'session timezone cannot change operational instants');
select is((select count(*) from pg_temp.owner_slots(null,pg_temp.fixture_id(5),pg_temp.fixture_id(3),'2000-01-03')),0::bigint,'past date empty');
reset role;
select ok(not has_table_privilege('authenticated','public.appointments','UPDATE')
 and has_table_privilege('authenticated','public.appointments','INSERT'),'027 owner write bridge unchanged');
select ok((select provolatile='v' from pg_proc where oid='private.validate_appointment_availability(uuid,uuid,uuid,timestamptz,uuid)'::regprocedure),'027 validator remains volatile');
select ok((select prosecdef and proconfig=array['search_path=pg_catalog']
 from pg_proc where oid='public.get_public_availability_by_slug(text,uuid,uuid,date)'::regprocedure),'public wrapper security attributes preserved');

select * from finish();
rollback;
