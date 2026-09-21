-- Review-only for remote rollout; remote application is manual.
-- Read only: no reservation, self-exclusion, or change to the 027 writer.
create function public.get_barber_availability(
  p_service_id uuid,
  p_local_date date
)
returns table (start_at timestamptz, end_at timestamptz)
language plpgsql stable security definer set search_path = pg_catalog
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'BARBER_APPOINTMENT_UNAUTHENTICATED';
  end if;
  select p.* into v_profile from public.profiles p where p.id = auth.uid();
  if not found or v_profile.active is distinct from true
    or v_profile.role is distinct from 'barber'
    or v_profile.barbershop_id is null or v_profile.barber_id is null then
    raise exception using errcode = 'P0001', message = 'BARBER_APPOINTMENT_FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.barbers b where b.id = v_profile.barber_id
      and b.barbershop_id = v_profile.barbershop_id and b.active is true
  ) then
    raise exception using errcode = 'P0001', message = 'BARBER_APPOINTMENT_INVALID_BARBER';
  end if;
  return query select s.start_at, s.end_at
  from private.get_availability_slots(
    v_profile.barbershop_id, p_service_id, v_profile.barber_id, p_local_date, null
  ) s;
end;
$$;

revoke all on function public.get_barber_availability(uuid,date)
  from public, anon, authenticated, service_role;
grant execute on function public.get_barber_availability(uuid,date) to authenticated;
comment on function public.get_barber_availability(uuid,date) is
  'Active barber self-scoped creation availability. Identity from auth.uid(); no exclusion or reservation. 027 remains write authority.';

-- Final read-only validation: all booleans must be true.
select
  has_function_privilege('authenticated','public.get_barber_availability(uuid,date)','EXECUTE') as authenticated_execute,
  not has_function_privilege('anon','public.get_barber_availability(uuid,date)','EXECUTE') as anon_denied,
  not has_function_privilege('service_role','public.get_barber_availability(uuid,date)','EXECUTE') as service_role_denied,
  not exists (
    select 1 from information_schema.routine_privileges
    where routine_schema='public' and routine_name='get_barber_availability'
      and grantee='PUBLIC' and privilege_type='EXECUTE'
  ) as public_denied;
