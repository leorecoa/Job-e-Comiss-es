create or replace function public.create_public_appointment(
  p_barbershop_id uuid,
  p_barber_id uuid,
  p_service_id uuid,
  p_client_name text,
  p_client_phone text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_appointment_id uuid;
  v_can_accept_public_booking boolean;
  v_barber_name text;
  v_barber_tenant_id uuid;
  v_barber_active boolean;
  v_service_name text;
  v_service_price numeric(10,2);
  v_service_commission_rate numeric(5,2);
  v_service_duration_minutes integer;
  v_service_tenant_id uuid;
  v_service_active boolean;
  v_client_name text := pg_catalog.btrim(p_client_name);
  v_client_phone text := pg_catalog.regexp_replace(coalesce(p_client_phone, ''), '[^0-9]', '', 'g');
  v_notes text := nullif(pg_catalog.btrim(p_notes), '');
begin
  if p_barbershop_id is null or not exists (
    select 1 from public.barbershops as bs
    where bs.id = p_barbershop_id and bs.active = true
  ) then
    raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_INVALID_TENANT';
  end if;

  perform private.lock_barber_availability(p_barbershop_id, array[p_barber_id]);

  select b.name, b.barbershop_id, b.active
  into v_barber_name, v_barber_tenant_id, v_barber_active
  from public.barbers as b
  where b.id = p_barber_id;

  if not found or v_barber_tenant_id is distinct from p_barbershop_id then
    raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_INVALID_BARBER';
  end if;
  if v_barber_active is distinct from true then
    raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_INACTIVE_BARBER';
  end if;

  select s.name, s.price, s.commission_rate, s.duration_minutes, s.barbershop_id, s.active
  into v_service_name, v_service_price, v_service_commission_rate, v_service_duration_minutes, v_service_tenant_id, v_service_active
  from public.services as s
  where s.id = p_service_id;

  if not found or v_service_tenant_id is distinct from p_barbershop_id then
    raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_INVALID_SERVICE';
  end if;
  if v_service_active is distinct from true then
    raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_INACTIVE_SERVICE';
  end if;

  if v_client_name is null or pg_catalog.length(v_client_name) not between 2 and 80
     or pg_catalog.length(v_client_phone) not between 10 and 11
     or (v_notes is not null and pg_catalog.length(v_notes) > 500) then
    raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_INVALID_INPUT';
  end if;

  if p_start_at is null or p_end_at is null
     or p_start_at <= pg_catalog.now()
     or p_end_at <= p_start_at
     or p_end_at <> p_start_at + pg_catalog.make_interval(mins => v_service_duration_minutes) then
    raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_INVALID_TIME';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_barbershop_id::text || ':' || v_client_phone, 0)
  );

  if exists (
    select 1
    from public.appointments as a
    where a.barbershop_id = p_barbershop_id
      and a.client_phone = v_client_phone
      and a.created_at > pg_catalog.now() - interval '60 seconds'
  ) then
    raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_RATE_LIMITED';
  end if;

  if (
    select pg_catalog.count(*)
    from public.appointments as a
    where a.barbershop_id = p_barbershop_id
      and a.client_phone = v_client_phone
      and a.status in ('scheduled', 'confirmed')
      and a.start_at > pg_catalog.now()
  ) >= 3 then
    raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_ACTIVE_LIMIT';
  end if;

  begin
    perform private.validate_appointment_availability(p_barbershop_id,p_barber_id,p_service_id,p_start_at);
  exception when raise_exception then
    if sqlerrm = 'APPOINTMENT_ACTIVE_SLOT_CONFLICT' then
      raise exception 'PUBLIC_APPOINTMENT_SLOT_CONFLICT';
    end if;
    raise;
  end;

  -- Evaluate after coordination and operational checks, never before a lock wait.
  select e.can_accept_public_booking
    into v_can_accept_public_booking
  from private.resolve_tenant_entitlements(p_barbershop_id) as e;

  if v_can_accept_public_booking is not true then
    raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_COMMERCIAL_UNAVAILABLE';
  end if;

  begin
    insert into public.appointments (
      barbershop_id, client_name, client_phone, barber_id, barber_name,
      service_id, service_type, service_value, commission_rate,
      start_at, end_at, status, notes, financial_record_id
    ) values (
      p_barbershop_id, v_client_name, v_client_phone, p_barber_id, v_barber_name,
      p_service_id, v_service_name, v_service_price, v_service_commission_rate,
      p_start_at, p_end_at, 'scheduled', v_notes, null
    ) returning id into v_appointment_id;
  exception
    when unique_violation or exclusion_violation then
      raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_SLOT_CONFLICT';
  end;

  return v_appointment_id;
end
$function$;
