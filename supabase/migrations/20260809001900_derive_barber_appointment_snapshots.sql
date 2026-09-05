drop policy if exists appointments_barber_insert_own
  on public.appointments;

create or replace function public.create_barber_appointment(
  p_service_id uuid,
  p_client_name text,
  p_client_phone text,
  p_start_at timestamptz,
  p_notes text default null
)
returns table (
  id uuid,
  barbershop_id uuid,
  client_name text,
  barber_id uuid,
  barber_name text,
  service_id uuid,
  service_type text,
  start_at timestamptz,
  end_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_profile public.profiles%rowtype;
  v_barber public.barbers%rowtype;
  v_service public.services%rowtype;
  v_client_name text := pg_catalog.btrim(p_client_name);
  v_client_phone text := pg_catalog.regexp_replace(coalesce(p_client_phone, ''), '[^0-9]', '', 'g');
  v_notes text := nullif(pg_catalog.btrim(p_notes), '');
  v_end_at timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'BARBER_APPOINTMENT_UNAUTHENTICATED';
  end if;

  select p.*
    into v_profile
  from public.profiles as p
  where p.id = auth.uid();

  if not found
    or v_profile.active is distinct from true
    or v_profile.role is distinct from 'barber'
    or v_profile.barbershop_id is null
    or v_profile.barber_id is null
  then
    raise exception using errcode = 'P0001', message = 'BARBER_APPOINTMENT_FORBIDDEN';
  end if;

  select b.*
    into v_barber
  from public.barbers as b
  where b.id = v_profile.barber_id
    and b.barbershop_id = v_profile.barbershop_id
    and b.active is true;

  if not found then
    raise exception using errcode = 'P0001', message = 'BARBER_APPOINTMENT_INVALID_BARBER';
  end if;

  select s.*
    into v_service
  from public.services as s
  where s.id = p_service_id
    and s.barbershop_id = v_profile.barbershop_id
    and s.active is true;

  if not found then
    raise exception using errcode = 'P0001', message = 'BARBER_APPOINTMENT_INVALID_SERVICE';
  end if;

  if v_client_name is null
    or pg_catalog.length(v_client_name) not between 2 and 80
    or pg_catalog.length(v_client_phone) not between 10 and 11
    or (v_notes is not null and pg_catalog.length(v_notes) > 500)
  then
    raise exception using errcode = 'P0001', message = 'BARBER_APPOINTMENT_INVALID_INPUT';
  end if;

  if p_start_at is null or p_start_at <= pg_catalog.now() then
    raise exception using errcode = 'P0001', message = 'BARBER_APPOINTMENT_INVALID_TIME';
  end if;

  v_end_at := p_start_at + pg_catalog.make_interval(mins => v_service.duration_minutes);

  begin
    return query
    insert into public.appointments as a (
      barbershop_id,
      client_name,
      client_phone,
      barber_id,
      barber_name,
      service_id,
      service_type,
      service_value,
      commission_rate,
      start_at,
      end_at,
      status,
      notes,
      financial_record_id
    ) values (
      v_profile.barbershop_id,
      v_client_name,
      v_client_phone,
      v_barber.id,
      v_barber.name,
      v_service.id,
      v_service.name,
      v_service.price,
      v_service.commission_rate,
      p_start_at,
      v_end_at,
      'scheduled',
      v_notes,
      null
    )
    returning
      a.id,
      a.barbershop_id,
      a.client_name,
      a.barber_id,
      a.barber_name,
      a.service_id,
      a.service_type,
      a.start_at,
      a.end_at,
      a.status;
  exception
    when unique_violation or exclusion_violation then
      raise exception using errcode = 'P0001', message = 'APPOINTMENT_ACTIVE_SLOT_CONFLICT';
  end;
end
$function$;

revoke all on function public.create_barber_appointment(uuid, text, text, timestamptz, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_barber_appointment(uuid, text, text, timestamptz, text)
  to authenticated;

comment on function public.create_barber_appointment(uuid, text, text, timestamptz, text) is
  'Creates a scheduled appointment for the active authenticated barber using server-derived tenant, identity, service, price, commission, names, and duration snapshots.';
