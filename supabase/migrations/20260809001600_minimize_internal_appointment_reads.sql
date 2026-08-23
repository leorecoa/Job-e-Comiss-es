revoke select, update, delete on table public.appointments from authenticated;

drop policy if exists appointments_owner_delete_own_barbershop
  on public.appointments;

create or replace function public.get_internal_appointments()
returns table (
  viewer_role text,
  id uuid,
  barbershop_id uuid,
  client_name text,
  client_phone text,
  barber_id uuid,
  barber_name text,
  service_id uuid,
  service_type text,
  service_value numeric,
  commission_rate numeric,
  start_at timestamptz,
  end_at timestamptz,
  status text,
  notes text,
  financial_record_id text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'INTERNAL_APPOINTMENTS_UNAUTHENTICATED';
  end if;

  select p.*
    into v_profile
  from public.profiles as p
  where p.id = auth.uid();

  if not found
    or v_profile.active is distinct from true
    or v_profile.barbershop_id is null
  then
    raise exception using errcode = 'P0001', message = 'INTERNAL_APPOINTMENTS_FORBIDDEN';
  end if;

  if v_profile.role = 'owner' then
    return query
    select
      'owner'::text,
      a.id,
      a.barbershop_id,
      a.client_name,
      a.client_phone,
      a.barber_id,
      a.barber_name,
      a.service_id,
      a.service_type,
      a.service_value,
      a.commission_rate,
      a.start_at,
      a.end_at,
      a.status,
      a.notes,
      a.financial_record_id,
      a.created_at,
      a.updated_at
    from public.appointments as a
    where a.barbershop_id = v_profile.barbershop_id
    order by a.start_at;
    return;
  end if;

  if v_profile.role = 'barber' and v_profile.barber_id is not null then
    return query
    select
      'barber'::text,
      a.id,
      a.barbershop_id,
      a.client_name,
      null::text,
      a.barber_id,
      a.barber_name,
      a.service_id,
      a.service_type,
      null::numeric,
      null::numeric,
      a.start_at,
      a.end_at,
      a.status,
      null::text,
      null::text,
      null::timestamptz,
      null::timestamptz
    from public.appointments as a
    where a.barbershop_id = v_profile.barbershop_id
      and a.barber_id = v_profile.barber_id
    order by a.start_at;
    return;
  end if;

  raise exception using errcode = 'P0001', message = 'INTERNAL_APPOINTMENTS_FORBIDDEN';
end
$function$;

create or replace function public.update_owner_appointment(
  p_appointment_id uuid,
  p_client_name text,
  p_client_phone text,
  p_barber_id uuid,
  p_barber_name text,
  p_service_id uuid,
  p_service_type text,
  p_service_value numeric,
  p_commission_rate numeric,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_status text,
  p_notes text
)
returns table (
  id uuid,
  barbershop_id uuid,
  client_name text,
  client_phone text,
  barber_id uuid,
  barber_name text,
  service_id uuid,
  service_type text,
  service_value numeric,
  commission_rate numeric,
  start_at timestamptz,
  end_at timestamptz,
  status text,
  notes text,
  financial_record_id text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'OWNER_APPOINTMENT_UPDATE_UNAUTHENTICATED';
  end if;

  select p.*
    into v_profile
  from public.profiles as p
  where p.id = auth.uid();

  if not found
    or v_profile.active is distinct from true
    or v_profile.role is distinct from 'owner'
    or v_profile.barbershop_id is null
  then
    raise exception using errcode = 'P0001', message = 'OWNER_APPOINTMENT_UPDATE_FORBIDDEN';
  end if;

  if not exists (
    select 1 from public.barbers as b
    where b.id = p_barber_id
      and b.barbershop_id = v_profile.barbershop_id
      and b.active is true
  ) then
    raise exception using errcode = 'P0001', message = 'OWNER_APPOINTMENT_INVALID_BARBER';
  end if;

  if not exists (
    select 1 from public.services as s
    where s.id = p_service_id
      and s.barbershop_id = v_profile.barbershop_id
      and s.active is true
  ) then
    raise exception using errcode = 'P0001', message = 'OWNER_APPOINTMENT_INVALID_SERVICE';
  end if;

  return query
  update public.appointments as a
  set client_name = p_client_name,
      client_phone = p_client_phone,
      barber_id = p_barber_id,
      barber_name = p_barber_name,
      service_id = p_service_id,
      service_type = p_service_type,
      service_value = p_service_value,
      commission_rate = p_commission_rate,
      start_at = p_start_at,
      end_at = p_end_at,
      status = p_status,
      notes = p_notes
  where a.id = p_appointment_id
    and a.barbershop_id = v_profile.barbershop_id
  returning
    a.id, a.barbershop_id, a.client_name, a.client_phone, a.barber_id,
    a.barber_name, a.service_id, a.service_type, a.service_value,
    a.commission_rate, a.start_at, a.end_at, a.status, a.notes,
    a.financial_record_id, a.created_at, a.updated_at;

  if not found then
    raise exception using errcode = 'P0001', message = 'OWNER_APPOINTMENT_NOT_FOUND';
  end if;
end
$function$;

revoke all on function public.get_internal_appointments()
  from public, anon, authenticated, service_role;
grant execute on function public.get_internal_appointments()
  to authenticated;

revoke all on function public.update_owner_appointment(
  uuid, text, text, uuid, text, uuid, text, numeric, numeric,
  timestamptz, timestamptz, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.update_owner_appointment(
  uuid, text, text, uuid, text, uuid, text, numeric, numeric,
  timestamptz, timestamptz, text, text
) to authenticated;

comment on function public.get_internal_appointments() is
  'Returns full tenant appointments to active owners and a nullable privacy-minimized schedule projection to active barbers.';
comment on function public.update_owner_appointment(
  uuid, text, text, uuid, text, uuid, text, numeric, numeric,
  timestamptz, timestamptz, text, text
) is 'Updates one appointment inside the active authenticated owner tenant without direct table UPDATE.';
