begin;
create extension if not exists pgtap with schema extensions;
select plan(61);

insert into public.barbershops(id,name,slug,operational_timezone,slot_step_minutes,business_hours)
select id,name,slug,'UTC',30,jsonb_object_agg(d,jsonb_build_object('active',true,'open','09:00','close','18:00'))
from (values ('eeee0030-0000-4000-8000-000000000001'::uuid,'Owner writer A','owner-writer-a'),('eeee0030-0000-4000-8000-000000000005'::uuid,'Owner writer B','owner-writer-b')) shops(id,name,slug)
cross join unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday']) d
group by id,name,slug;
insert into public.barbers(id,name,barbershop_id) values
('eeee0030-0000-4000-8000-000000000002','Barber snapshot','eeee0030-0000-4000-8000-000000000001'),('eeee0030-0000-4000-8000-000000000006','Other tenant','eeee0030-0000-4000-8000-000000000005');
insert into public.services(id,name,barbershop_id,price,duration_minutes,commission_rate) values
('eeee0030-0000-4000-8000-000000000003','Service snapshot','eeee0030-0000-4000-8000-000000000001',75.50,60,35),
('eeee0030-0000-4000-8000-000000000007','Other service','eeee0030-0000-4000-8000-000000000005',90,30,40);
insert into auth.users(id,aud,role,email) values
('eeee0030-0000-4000-8000-000000000004','authenticated','authenticated','owner-writer@example.test'),
('eeee0030-0000-4000-8000-000000000008','authenticated','authenticated','writer-barber@example.test'),
('eeee0030-0000-4000-8000-000000000009','authenticated','authenticated','writer-inactive@example.test'),
('eeee0030-0000-4000-8000-000000000010','authenticated','authenticated','writer-no-tenant@example.test');
insert into public.profiles(id,role,active,barbershop_id,barber_id) values
('eeee0030-0000-4000-8000-000000000004','owner',true,'eeee0030-0000-4000-8000-000000000001',null),
('eeee0030-0000-4000-8000-000000000008','barber',true,'eeee0030-0000-4000-8000-000000000001','eeee0030-0000-4000-8000-000000000002'),
('eeee0030-0000-4000-8000-000000000009','owner',false,'eeee0030-0000-4000-8000-000000000001',null),
('eeee0030-0000-4000-8000-000000000010','owner',true,null,null);
create temporary table created_owner_appointments(id uuid);
grant insert,select on created_owner_appointments to authenticated;

select ok(has_function_privilege('authenticated','public.create_owner_appointment(uuid,uuid,text,text,timestamptz,text)','EXECUTE'),'authenticated effective EXECUTE');
select ok(not has_function_privilege('anon','public.create_owner_appointment(uuid,uuid,text,text,timestamptz,text)','EXECUTE'),'anon no effective EXECUTE');
select ok(not has_function_privilege('service_role','public.create_owner_appointment(uuid,uuid,text,text,timestamptz,text)','EXECUTE'),'service_role no effective EXECUTE');
select ok(not exists(select 1 from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
where p.oid='public.create_owner_appointment(uuid,uuid,text,text,timestamptz,text)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'),'PUBLIC no EXECUTE');
select ok((select prosecdef and provolatile='v' and proconfig=array['search_path=pg_catalog'] from pg_proc where oid='public.create_owner_appointment(uuid,uuid,text,text,timestamptz,text)'::regprocedure),'definer volatile restricted search path');
select is((select proargnames from pg_proc where oid='public.create_owner_appointment(uuid,uuid,text,text,timestamptz,text)'::regprocedure),
array['p_service_id','p_barber_id','p_client_name','p_client_phone','p_start_at','p_notes']::text[],
'only six inputs: no tenant, snapshots, price, commission, duration, end, status, financial link or audit fields');
select is((select prorettype::regtype::text from pg_proc where oid='public.create_owner_appointment(uuid,uuid,text,text,timestamptz,text)'::regprocedure),'uuid','return only UUID');
select is((select pronargdefaults::integer from pg_proc where oid='public.create_owner_appointment(uuid,uuid,text,text,timestamptz,text)'::regprocedure),1,'notes default NULL');
select ok(has_table_privilege('authenticated','public.appointments','INSERT'),'bridge INSERT grant unchanged');
select ok(exists(select 1 from pg_policies where schemaname='public' and tablename='appointments' and policyname='appointments_owner_insert_own_barbershop'),'bridge policy retained');

set local role anon;
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T09:00Z',null)$$,'42501',null,'anon execution denied');
reset role;
set local role service_role;
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T09:00Z',null)$$,'42501',null,'service_role execution denied');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{}',true);
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T09:00Z',null)$$,'P0001','OWNER_APPOINTMENT_CREATE_UNAUTHENTICATED','missing auth denied');
select set_config('request.jwt.claims','{"sub":"eeee0030-0000-4000-8000-000000000008","role":"authenticated"}',true);
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T09:00Z',null)$$,'P0001','OWNER_APPOINTMENT_CREATE_FORBIDDEN','barber denied');
select set_config('request.jwt.claims','{"sub":"eeee0030-0000-4000-8000-000000000009","role":"authenticated"}',true);
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T09:00Z',null)$$,'P0001','OWNER_APPOINTMENT_CREATE_FORBIDDEN','inactive owner denied');
select set_config('request.jwt.claims','{"sub":"eeee0030-0000-4000-8000-000000000010","role":"authenticated"}',true);
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T09:00Z',null)$$,'P0001','OWNER_APPOINTMENT_CREATE_FORBIDDEN','owner without tenant denied');
select set_config('request.jwt.claims','{"sub":"eeee0030-0000-4000-8000-000000000011","role":"authenticated"}',true);
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T09:00Z',null)$$,'P0001','OWNER_APPOINTMENT_CREATE_FORBIDDEN','missing profile denied');
select set_config('request.jwt.claims','{"sub":"eeee0030-0000-4000-8000-000000000004","role":"authenticated"}',true);
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000007','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T09:00Z',null)$$,'P0001','OWNER_APPOINTMENT_INVALID_SERVICE','foreign service denied');
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000006','Test client','12345678','2030-01-07T09:00Z',null)$$,'P0001','OWNER_APPOINTMENT_INVALID_BARBER','foreign barber denied');
select lives_ok($$insert into created_owner_appointments select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T09:00Z')$$,'valid owner create with omitted notes and eight-character phone');
reset role;
select is((select a.barbershop_id from public.appointments a join created_owner_appointments c on c.id=a.id),'eeee0030-0000-4000-8000-000000000001'::uuid,'tenant derived');
select is((select a.barber_id from public.appointments a join created_owner_appointments c on c.id=a.id),'eeee0030-0000-4000-8000-000000000002'::uuid,'chosen authorized barber');
select is((select a.service_id from public.appointments a join created_owner_appointments c on c.id=a.id),'eeee0030-0000-4000-8000-000000000003'::uuid,'chosen authorized service');
select is((select a.barber_name from public.appointments a join created_owner_appointments c on c.id=a.id),'Barber snapshot'::text,'barber snapshot');
select is((select a.service_type from public.appointments a join created_owner_appointments c on c.id=a.id),'Service snapshot'::text,'service snapshot');
select is((select a.service_value from public.appointments a join created_owner_appointments c on c.id=a.id),'75.50'::numeric,'catalogue price');
select is((select a.commission_rate from public.appointments a join created_owner_appointments c on c.id=a.id),'35'::numeric,'catalogue commission');
select is((select a.start_at from public.appointments a join created_owner_appointments c on c.id=a.id),'2030-01-07T09:00Z'::timestamptz,'exact selected start');
select is((select a.end_at from public.appointments a join created_owner_appointments c on c.id=a.id),'2030-01-07T10:00Z'::timestamptz,'catalogue duration end');
select is((select a.status from public.appointments a join created_owner_appointments c on c.id=a.id),'scheduled'::text,'forced scheduled');
select is((select count(*) from public.appointments a join created_owner_appointments c on c.id=a.id),1::bigint,'returned UUID identifies persisted row');
select ok((select financial_record_id is null and notes is null and created_at is not null and updated_at is not null from public.appointments where id=(select id from created_owner_appointments)),'NULL financial link/notes and database audit');
set local role authenticated;
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T09:00Z',null)$$,'P0001','APPOINTMENT_ACTIVE_SLOT_CONFLICT','occupied slot rejected');
select lives_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','+55 (81) 99999-9999','2030-01-07T10:00Z','Owner note')$$,'adjacency with formatted phone and notes');
select lives_ok($$insert into public.appointments(barbershop_id,barber_id,barber_name,service_id,service_type,service_value,client_name,client_phone,start_at,end_at)
values('eeee0030-0000-4000-8000-000000000001','eeee0030-0000-4000-8000-000000000002','Bridge','eeee0030-0000-4000-8000-000000000003','Bridge',1,'Bridge client','12345678','2030-01-07T11:00Z','2030-01-07T12:00Z')$$,'direct owner INSERT still works');
reset role;
select is((select notes from public.appointments where barbershop_id='eeee0030-0000-4000-8000-000000000001' and start_at='2030-01-07T10:00Z'),'Owner note','notes persisted');
select is((select client_phone from public.appointments where barbershop_id='eeee0030-0000-4000-8000-000000000001' and start_at='2030-01-07T10:00Z'),'+55 (81) 99999-9999','formatted phone preserved');
insert into public.barber_time_off(barbershop_id,barber_id,starts_at,ends_at) values('eeee0030-0000-4000-8000-000000000001','eeee0030-0000-4000-8000-000000000002','2030-01-07T13:00Z','2030-01-07T14:00Z');
set local role authenticated;
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T13:00Z',null)$$,'P0001','APPOINTMENT_TIME_OFF_CONFLICT','time off rejected');
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T08:00Z',null)$$,'P0001','APPOINTMENT_OUTSIDE_WORKING_HOURS','outside hours rejected');
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T14:10Z',null)$$,'P0001','APPOINTMENT_OUTSIDE_WORKING_HOURS','off step rejected');
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T17:30Z',null)$$,'P0001','APPOINTMENT_OUTSIDE_WORKING_HOURS','full interval fit rejected');
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2000-01-07T09:00Z',null)$$,'P0001','APPOINTMENT_INVALID_TIME','past start rejected');
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','infinity',null)$$,'P0001','APPOINTMENT_INVALID_TIME','infinite start rejected');
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','X','12345678','2030-01-07T14:00Z',null)$$,'P0001','OWNER_APPOINTMENT_INVALID_INPUT','short name rejected');
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002',null,'12345678','2030-01-07T14:00Z',null)$$,'P0001','OWNER_APPOINTMENT_INVALID_INPUT','null name rejected');
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002',repeat('x',81),'12345678','2030-01-07T14:00Z',null)$$,'P0001','OWNER_APPOINTMENT_INVALID_INPUT','long name rejected');
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','1234567','2030-01-07T14:00Z',null)$$,'P0001','OWNER_APPOINTMENT_INVALID_INPUT','short phone rejected');
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client',null,'2030-01-07T14:00Z',null)$$,'P0001','OWNER_APPOINTMENT_INVALID_INPUT','null phone rejected');
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client',repeat('1',21),'2030-01-07T14:00Z',null)$$,'P0001','OWNER_APPOINTMENT_INVALID_INPUT','long phone rejected');
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T14:00Z',repeat('n',501))$$,'P0001','OWNER_APPOINTMENT_INVALID_INPUT','long notes rejected');
reset role;
select is((select count(*) from public.appointments where barbershop_id='eeee0030-0000-4000-8000-000000000001'),3::bigint,'failed attempts leave no rows');
delete from public.appointments where barbershop_id='eeee0030-0000-4000-8000-000000000001';
update public.services set active=false where id='eeee0030-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T09:00Z',null)$$,'P0001','OWNER_APPOINTMENT_INVALID_SERVICE','inactive service');
reset role;
update public.services set active=true where id='eeee0030-0000-4000-8000-000000000003';
update public.barbers set active=false where id='eeee0030-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T09:00Z',null)$$,'P0001','OWNER_APPOINTMENT_INVALID_BARBER','inactive barber');
reset role;
update public.barbers set active=true where id='eeee0030-0000-4000-8000-000000000002';
update public.barbershops set operational_timezone=null where id='eeee0030-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T09:00Z',null)$$,'P0001','APPOINTMENT_TIMEZONE_REQUIRED','missing timezone denied');
reset role;
update public.barbershops set operational_timezone='UTC' where id='eeee0030-0000-4000-8000-000000000001';
update public.barbers set availability_mode='custom' where id='eeee0030-0000-4000-8000-000000000002';
insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time)
values('eeee0030-0000-4000-8000-000000000001','eeee0030-0000-4000-8000-000000000002',1,'09:00','12:00'),('eeee0030-0000-4000-8000-000000000001','eeee0030-0000-4000-8000-000000000002',1,'14:00','18:00');
set local role authenticated;
select lives_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T09:00Z',null)$$,'custom first interval');
select lives_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T14:00Z',null)$$,'custom second interval');
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-01-07T12:00Z',null)$$,'P0001','APPOINTMENT_OUTSIDE_WORKING_HOURS','custom gap');
reset role;
delete from public.appointments where barbershop_id='eeee0030-0000-4000-8000-000000000001';
update public.barbers set availability_mode='inherit' where id='eeee0030-0000-4000-8000-000000000002';
update public.barbershops set operational_timezone='America/New_York',
business_hours=(select jsonb_object_agg(d,jsonb_build_object('active',true,'open','00:00','close','06:00')) from unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])d) where id='eeee0030-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-11-03T05:00Z',null)$$,'P0001','APPOINTMENT_INVALID_TIME','DST first fold occurrence rejected by 027');
select lives_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-11-03T06:00Z',null)$$,'DST standard fold occurrence accepted');
select lives_ok($$select public.create_owner_appointment('eeee0030-0000-4000-8000-000000000003','eeee0030-0000-4000-8000-000000000002','Test client','12345678','2030-03-10T01:00:00-05:00',null)$$,'DST spring valid instant uses elapsed catalogue duration');
reset role;
select is((select end_at from public.appointments where barbershop_id='eeee0030-0000-4000-8000-000000000001' and start_at='2030-03-10T06:00Z'),'2030-03-10T07:00Z'::timestamptz,'DST spring duration not wall-clock reconstruction');

select * from finish();
rollback;
