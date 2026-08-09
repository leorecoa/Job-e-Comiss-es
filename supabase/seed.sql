-- Local development only. All records are fictional and deterministic.
-- Never apply this seed to production.

insert into public.barbershops (id, name, slug, active)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Tenant Alpha', 'tenant-alpha', true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Tenant Beta', 'tenant-beta', true)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  active = excluded.active;

insert into public.barbers (id, name, active, barbershop_id)
values
  ('11111111-1111-4111-8111-111111111111', 'Barber Alpha', true, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('22222222-2222-4222-8222-222222222222', 'Barber Beta', true, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2')
on conflict (id) do update set
  name = excluded.name,
  active = excluded.active,
  barbershop_id = excluded.barbershop_id;

insert into public.services (
  id,
  name,
  price,
  duration_minutes,
  commission_rate,
  active,
  barbershop_id
)
values
  ('33333333-3333-4333-8333-333333333333', 'Service Alpha', 40.00, 30, 50.00, true, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('44444444-4444-4444-8444-444444444444', 'Service Beta', 55.00, 30, 45.00, true, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2')
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  duration_minutes = excluded.duration_minutes,
  commission_rate = excluded.commission_rate,
  active = excluded.active,
  barbershop_id = excluded.barbershop_id;
