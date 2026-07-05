-- Job e Comissoes - Public appointment availability RPC
-- Review-only SQL. Apply manually in Supabase after reviewing the rollout plan.
--
-- Purpose:
-- - expose occupied public booking slots for one barbershop at a time
-- - avoid granting public SELECT on public.appointments
-- - keep client data hidden from anonymous/public booking flows
--
-- Rollout:
-- 1. Apply this SQL manually in Supabase.
-- 2. Verify public.get_public_appointment_slots(uuid) exists.
-- 3. Test the RPC as anon for an active barbershop.
-- 4. Deploy the frontend that calls this RPC.
-- 5. Confirm public booking works for /book/:slug.
-- 6. In a later PR, evaluate revoking public access to public.public_appointment_slots.

begin;

create or replace function public.get_public_appointment_slots(
  p_barbershop_id uuid
)
returns table (
  barber_id uuid,
  barber_name text,
  start_at timestamptz,
  end_at timestamptz,
  status text,
  barbershop_id uuid
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    a.barber_id,
    a.barber_name,
    a.start_at,
    a.end_at,
    a.status,
    a.barbershop_id
  from public.appointments a
  inner join public.barbers b
    on b.id = a.barber_id
   and b.barbershop_id = a.barbershop_id
  inner join public.barbershops bs
    on bs.id = a.barbershop_id
  where a.barbershop_id = p_barbershop_id
    and a.status in ('scheduled', 'confirmed')
    and a.start_at >= now()
    and b.active = true
    and bs.active = true
  order by a.start_at asc;
$$;

revoke all
on function public.get_public_appointment_slots(uuid)
from public;

revoke all
on function public.get_public_appointment_slots(uuid)
from anon;

revoke all
on function public.get_public_appointment_slots(uuid)
from authenticated;

grant execute
on function public.get_public_appointment_slots(uuid)
to anon, authenticated;

notify pgrst, 'reload schema';

commit;
