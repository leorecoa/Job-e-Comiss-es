create or replace function public.get_public_services_by_slug(p_slug text)
returns table (
  id uuid,
  name text,
  price numeric,
  duration_minutes integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_slug text := pg_catalog.lower(pg_catalog.btrim(p_slug));
begin
  if v_slug is null or not exists (
    select 1
    from public.barbershops as shop
    where shop.slug = v_slug
      and shop.active is true
  ) then
    raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_INVALID_TENANT';
  end if;

  return query
  select
    service.id,
    service.name,
    service.price,
    service.duration_minutes
  from public.barbershops as shop
  inner join public.services as service
    on service.barbershop_id = shop.id
  where shop.slug = v_slug
    and shop.active is true
    and service.active is true
  order by service.name;
end;
$function$;

revoke all on function public.get_public_services_by_slug(text)
from public, anon, authenticated, service_role;
grant execute on function public.get_public_services_by_slug(text)
to service_role;

drop policy if exists services_public_read_active
on public.services;

revoke select on table public.services from anon;

notify pgrst, 'reload schema';
