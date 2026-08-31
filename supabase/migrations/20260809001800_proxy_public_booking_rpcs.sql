create or replace function public.get_public_appointment_slots_by_slug(p_slug text)
returns table (
  barber_id uuid,
  barber_name text,
  start_at timestamptz,
  end_at timestamptz,
  status text
)
language sql
security definer
set search_path = pg_catalog
as $function$
  select
    slots.barber_id,
    slots.barber_name,
    slots.start_at,
    slots.end_at,
    slots.status
  from public.barbershops as shop
  cross join lateral public.get_public_appointment_slots(shop.id) as slots
  where shop.slug = pg_catalog.lower(pg_catalog.btrim(p_slug))
    and shop.active is true;
$function$;

revoke all on function public.get_public_appointment_slots_by_slug(text) from public, anon, authenticated, service_role;
grant execute on function public.get_public_appointment_slots_by_slug(text) to service_role;

revoke execute on function public.create_public_appointment(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) from anon, authenticated;
revoke execute on function public.get_public_appointment_slots(uuid) from anon, authenticated, service_role;
revoke execute on function public.create_public_appointment(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) from public;
revoke execute on function public.get_public_appointment_slots(uuid) from public;

grant execute on function public.create_public_appointment(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) to service_role;

notify pgrst, 'reload schema';
