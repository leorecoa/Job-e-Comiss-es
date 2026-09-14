begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Transactional fixtures: no records survive this test.
insert into public.appointments (
  client_name, client_phone, barber_id, barber_name, service_id, service_type,
  barbershop_id, start_at, end_at, status
)
select 'Availability fixture', '00000000000', b.id, b.name, s.id, s.name,
  b.barbershop_id, now() + v.starts, now() + v.ends, v.status
from public.barbers b
join public.services s on s.barbershop_id = b.barbershop_id
cross join (values
  (interval '-30 minutes', interval '30 minutes', 'scheduled'),
  (interval '30 minutes', interval '60 minutes', 'confirmed'),
  (interval '-60 minutes', interval '-30 minutes', 'scheduled'),
  (interval '-10 minutes', interval '20 minutes', 'cancelled'),
  (interval '-10 minutes', interval '20 minutes', 'no_show')
) v(starts, ends, status)
where b.id = '11111111-1111-4111-8111-111111111111'
  and s.id = '33333333-3333-4333-8333-333333333333';

select is((select count(*) from public.get_public_appointment_slots('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') where start_at < now()), 1::bigint, 'started but unfinished appointment remains occupied');
select is((select count(*) from public.get_public_appointment_slots('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') where start_at > now()), 1::bigint, 'future adjacent appointment remains occupied');
select is((select count(*) from public.get_public_appointment_slots('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') where end_at <= now()), 0::bigint, 'ended appointments are excluded');
select is((select count(*) from public.get_public_appointment_slots('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1') where status in ('cancelled', 'no_show')), 0::bigint, 'cancelled and no_show remain nonblocking');
select is((select count(*) from public.get_public_appointment_slots('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2')), 0::bigint, 'other tenant cannot see fixture occupancy');

set local role service_role;
select is((select count(*) from public.get_public_appointment_slots_by_slug('tenant-alpha')), 2::bigint, 'proxy slug RPC includes current and future occupancy');
reset role;
select is((select prosecdef from pg_proc where oid = 'public.get_public_appointment_slots(uuid)'::regprocedure), true, 'slots remains SECURITY DEFINER');
select is((select proconfig from pg_proc where oid = 'public.get_public_appointment_slots(uuid)'::regprocedure), array['search_path=pg_catalog'], 'slots keeps controlled search_path');

select * from finish();
rollback;
