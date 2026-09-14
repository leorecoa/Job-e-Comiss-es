-- Fictional local fixtures; no data survives this test.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into public.barbers(id,barbershop_id,name) values
('eeee0025-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Overlap fixture one'),
('eeee0025-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Overlap fixture two');
select ok(exists(select 1 from pg_constraint where conrelid='public.barber_working_hours'::regclass and conname='barber_working_hours_no_overlap' and contype='x'), 'GiST exclusion constraint exists');
select lives_ok($$insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeee0025-0000-4000-8000-000000000001',1,'09:00','12:00')$$,'baseline interval accepted');
select throws_ok($$insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeee0025-0000-4000-8000-000000000001',1,'11:00','14:00')$$,'23P01',null,'rejects partial overlap');
select throws_ok($$insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeee0025-0000-4000-8000-000000000001',1,'10:00','11:00')$$,'23P01',null,'rejects contained interval');
select throws_ok($$insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeee0025-0000-4000-8000-000000000001',1,'08:00','14:00')$$,'23P01',null,'rejects enclosing interval');
select throws_ok($$insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeee0025-0000-4000-8000-000000000001',1,'09:00','12:00')$$,'23P01',null,'rejects duplicate interval');
select lives_ok($$insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeee0025-0000-4000-8000-000000000001',1,'12:00','18:00')$$,'permits adjacency');
select lives_ok($$insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeee0025-0000-4000-8000-000000000001',1,'19:00','20:00')$$,'permits separated interval');
select lives_ok($$insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeee0025-0000-4000-8000-000000000001',2,'09:00','12:00')$$,'permits different weekday');
select lives_ok($$insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeee0025-0000-4000-8000-000000000002',1,'09:00','12:00')$$,'permits different barber');
select throws_ok($$update public.barber_working_hours set start_time='11:00' where barber_id='eeee0025-0000-4000-8000-000000000001' and weekday=1 and start_time='12:00'$$,'23P01',null,'UPDATE cannot introduce overlap');
select is((select start_time from public.barber_working_hours where barber_id='eeee0025-0000-4000-8000-000000000001' and weekday=1 and end_time='18:00'),time '12:00','failed UPDATE preserves original interval');
select lives_ok($$insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeee0025-0000-4000-8000-000000000001',3,'23:59:59.999998','23:59:59.999999'); insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeee0025-0000-4000-8000-000000000001',3,'23:59:59.999999','24:00')$$,'microsecond adjacency and 24:00 preserved');
select throws_ok($$insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeee0025-0000-4000-8000-000000000001',3,'23:59:59.999998','24:00')$$,'23P01',null,'microsecond overlap rejected');
select ok(not exists(select 1 from pg_constraint where conrelid='public.barber_time_off'::regclass and contype='x'),'time off has no exclusion constraint');
select lives_ok($$insert into public.barber_time_off(barbershop_id,barber_id,starts_at,ends_at) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeee0025-0000-4000-8000-000000000001','2030-01-01T09:00Z','2030-01-01T12:00Z'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','eeee0025-0000-4000-8000-000000000001','2030-01-01T11:00Z','2030-01-01T14:00Z')$$,'time off still permits overlaps');
select is((select count(*) from public.barber_time_off where barber_id='eeee0025-0000-4000-8000-000000000001'),2::bigint,'both overlapping time off fixtures exist');

select * from finish();
rollback;
