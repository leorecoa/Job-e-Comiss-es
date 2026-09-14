-- Review-only: remote rollout is manual. Existing ACLs are preserved by replacement.
-- Validate with supabase/tests/public_slots_in_progress_test.sql and the full pgTAP suite.
-- Rollback requires a reviewed replacement restoring start_at >= now(); it reintroduces the bug.
create or replace function public.get_public_appointment_slots(p_barbershop_id uuid)
returns table(barber_id uuid, barber_name text, start_at timestamptz, end_at timestamptz, status text, barbershop_id uuid)
language sql stable security definer
set search_path to 'pg_catalog'
as $$
  select a.barber_id, a.barber_name, a.start_at, a.end_at, a.status, a.barbershop_id
  from public.appointments a
  inner join public.barbers b on b.id = a.barber_id and b.barbershop_id = a.barbershop_id
  inner join public.barbershops bs on bs.id = a.barbershop_id
  where a.barbershop_id = p_barbershop_id
    and a.status in ('scheduled', 'confirmed')
    and a.end_at > now()
    and b.active = true
    and bs.active = true
  order by a.start_at asc;
$$;
