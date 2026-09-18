-- Review-only for remote rollout. Local validation before manual remote application.
-- 026 reader semantics are shared; 027 writers/locks/validator remain unchanged.
create function private.get_availability_slots(
  p_tenant_id uuid,
  p_service_id uuid,
  p_barber_id uuid,
  p_local_date date,
  p_ignore_appointment_id uuid default null
)
returns table (start_at timestamptz, end_at timestamptz)
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  v_shop public.barbershops%rowtype;
  v_mode text;
  v_duration integer;
  v_step interval;
  v_day timestamp;
  v_weekday integer;
  v_config jsonb;
  v_open time;
  v_close time;
begin
  if p_local_date is null or not pg_catalog.isfinite(p_local_date) then
    raise exception using errcode = '22023', message = 'PUBLIC_AVAILABILITY_INVALID_DATE';
  end if;
  begin
    v_day := p_local_date::timestamp;
  exception when datetime_field_overflow then
    raise exception using errcode = '22023', message = 'PUBLIC_AVAILABILITY_INVALID_DATE';
  end;

  select b.* into v_shop from public.barbershops b
  where b.id = p_tenant_id and b.active is true;
  if not found then
    raise exception using errcode = '22023', message = 'PUBLIC_AVAILABILITY_INVALID_TENANT';
  end if;

  select b.availability_mode into v_mode from public.barbers b
  where b.id = p_barber_id and b.barbershop_id = v_shop.id and b.active is true;
  if not found then
    raise exception using errcode = '22023', message = 'PUBLIC_AVAILABILITY_INVALID_BARBER';
  end if;

  select s.duration_minutes into v_duration from public.services s
  where s.id = p_service_id and s.barbershop_id = v_shop.id and s.active is true;
  if not found then
    raise exception using errcode = '22023', message = 'PUBLIC_AVAILABILITY_INVALID_SERVICE';
  end if;
  if v_shop.operational_timezone is null then
    raise exception using errcode = '22023', message = 'PUBLIC_AVAILABILITY_TIMEZONE_REQUIRED';
  end if;
  if v_shop.slot_step_minutes is null then
    raise exception using errcode = '22023', message = 'PUBLIC_AVAILABILITY_SLOT_STEP_REQUIRED';
  end if;
  -- Integer column: same clamp as scheduling.ts, but NULL remains unconfigured.
  v_step := pg_catalog.make_interval(mins => greatest(5, least(120, v_shop.slot_step_minutes)));
  v_weekday := extract(dow from p_local_date)::integer;

  if v_mode = 'inherit' then
    v_config := v_shop.business_hours -> (array[
      'sunday','monday','tuesday','wednesday','thursday','friday','saturday'
    ])[v_weekday + 1];
    -- Validate the requested day, not an invented multi-interval JSON format.
    -- No defaults for malformed/missing configuration.
    if pg_catalog.jsonb_typeof(v_shop.business_hours) is distinct from 'object'
       or pg_catalog.jsonb_typeof(v_config) is distinct from 'object'
       or pg_catalog.jsonb_typeof(v_config -> 'active') is distinct from 'boolean'
       or pg_catalog.jsonb_typeof(v_config -> 'open') is distinct from 'string'
       or pg_catalog.jsonb_typeof(v_config -> 'close') is distinct from 'string'
       or coalesce(v_config ->> 'open', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or coalesce(v_config ->> 'close', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception using errcode = '22023', message = 'PUBLIC_AVAILABILITY_INVALID_BUSINESS_HOURS';
    end if;
    if not (v_config ->> 'active')::boolean then
      return;
    end if;
    v_open := (v_config ->> 'open')::time;
    v_close := (v_config ->> 'close')::time;
    if v_open >= v_close then
      raise exception using errcode = '22023', message = 'PUBLIC_AVAILABILITY_INVALID_BUSINESS_HOURS';
    end if;
  end if;

  return query
  with wall_intervals as (
    select v_day + (v_open - time '00:00') as opens,
           v_day + (v_close - time '00:00') as closes
    where v_mode = 'inherit'
    union all
    select v_day + (w.start_time - time '00:00'),
           v_day + (w.end_time - time '00:00')
    from public.barber_working_hours w
    where v_mode = 'custom' and w.barbershop_id = v_shop.id
      and w.barber_id = p_barber_id and w.weekday = v_weekday
  ), bounds as (
    select w.*, w.opens at time zone v_shop.operational_timezone as opens_at,
                w.closes at time zone v_shop.operational_timezone as closes_at
    from wall_intervals w
  ), candidates as (
    select b.*, g.wall_start,
           g.wall_start at time zone v_shop.operational_timezone as slot_start
    from bounds b
    cross join lateral pg_catalog.generate_series(b.opens, b.closes, v_step) as g(wall_start)
    where g.wall_start < b.closes
      -- A nonexistent boundary invalidates this interval rather than shifting it.
      and b.opens_at at time zone v_shop.operational_timezone = b.opens
      and b.closes_at at time zone v_shop.operational_timezone = b.closes
  ), slots as (
    select c.*, c.slot_start + pg_catalog.make_interval(mins => v_duration) as slot_end
    from candidates c
    -- DST gap: omit nonexistent local starts via round-trip.
    -- DST fold: AT TIME ZONE deliberately selects PostgreSQL's standard-time
    -- occurrence (the later occurrence in the tested New York fall-back).
    where c.slot_start at time zone v_shop.operational_timezone = c.wall_start
  )
  select s.slot_start, s.slot_end
  from slots s
  where s.slot_start > pg_catalog.now()
    and s.slot_start >= s.opens_at and s.slot_end <= s.closes_at
    -- Elapsed duration must also fit the wall-clock interval, including DST days.
    and s.slot_end at time zone v_shop.operational_timezone >= s.opens
    and s.slot_end at time zone v_shop.operational_timezone <= s.closes
    and not exists (
      select 1 from public.barber_time_off t
      where t.barbershop_id = v_shop.id and t.barber_id = p_barber_id
        and t.starts_at < s.slot_end and t.ends_at > s.slot_start
    )
    and not exists (
      select 1 from public.appointments a
      where a.barbershop_id = v_shop.id and a.barber_id = p_barber_id
        and a.id is distinct from p_ignore_appointment_id
        and a.status in ('scheduled', 'confirmed')
        and a.start_at < s.slot_end and a.end_at > s.slot_start
    )
  order by s.slot_start;
end;
$$;

-- Keep date validation before slug resolution, including the 026 error order.
-- CREATE OR REPLACE preserves the existing proxy-only ACL.
create or replace function public.get_public_availability_by_slug(
  p_slug text, p_service_id uuid, p_barber_id uuid, p_local_date date
)
returns table (start_at timestamptz, end_at timestamptz)
language plpgsql stable security definer set search_path = pg_catalog
as $$
declare
  v_tenant uuid;
begin
  if p_local_date is null or not pg_catalog.isfinite(p_local_date) then
    raise exception using errcode = '22023', message = 'PUBLIC_AVAILABILITY_INVALID_DATE';
  end if;
  begin
    perform p_local_date::timestamp;
  exception when datetime_field_overflow then
    raise exception using errcode = '22023', message = 'PUBLIC_AVAILABILITY_INVALID_DATE';
  end;
  select b.id into v_tenant from public.barbershops b
  where b.slug = pg_catalog.lower(pg_catalog.btrim(p_slug)) and b.active is true;
  if not found then
    raise exception using errcode = '22023', message = 'PUBLIC_AVAILABILITY_INVALID_TENANT';
  end if;
  return query select s.start_at, s.end_at
  from private.get_availability_slots(v_tenant, p_service_id, p_barber_id, p_local_date, null) s;
end;
$$;

create function public.get_owner_availability(
  p_service_id uuid,
  p_barber_id uuid,
  p_local_date date,
  p_appointment_id uuid default null
)
returns table (start_at timestamptz, end_at timestamptz)
language plpgsql stable security definer set search_path = pg_catalog
as $$
declare
  v_profile public.profiles%rowtype;
  v_appointment public.appointments%rowtype;
begin
  select p.* into v_profile from public.profiles p where p.id = auth.uid();
  if not found or v_profile.active is distinct from true
    or v_profile.role is distinct from 'owner' or v_profile.barbershop_id is null then
    raise exception using errcode = 'P0001', message = 'OWNER_AVAILABILITY_FORBIDDEN';
  end if;

  if p_appointment_id is not null then
    select a.* into v_appointment from public.appointments a
    where a.id = p_appointment_id and a.barbershop_id = v_profile.barbershop_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'OWNER_AVAILABILITY_APPOINTMENT_NOT_FOUND';
    end if;
    -- Exactly the historical predicate in 027, including a reverse financial link.
    if v_appointment.status = 'completed' or v_appointment.financial_record_id is not null
      or exists (select 1 from public.financial_records f where f.appointment_id = v_appointment.id) then
      raise exception using errcode = 'P0001', message = 'APPOINTMENT_HISTORY_PROTECTED';
    end if;
  end if;

  return query select s.start_at, s.end_at
  from private.get_availability_slots(
    v_profile.barbershop_id, p_service_id, p_barber_id, p_local_date, p_appointment_id
  ) s;
end;
$$;

revoke all on function private.get_availability_slots(uuid,uuid,uuid,date,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_owner_availability(uuid,uuid,date,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_owner_availability(uuid,uuid,date,uuid) to authenticated;

comment on function private.get_availability_slots(uuid,uuid,uuid,date,uuid) is
  'Internal read generator extracted from 026. Only authorized wrappers may supply tenant/exclusion. No reservation; 027 still enforces writes.';
comment on function public.get_owner_availability(uuid,uuid,date,uuid) is
  'Active owner only; tenant from auth.uid(). Optional own nonhistorical appointment exclusion. Slots only. Shared configuration errors retain PUBLIC_AVAILABILITY_* codes.';

-- Validation (read-only): both results must be true.
select
  has_function_privilege('authenticated', 'public.get_owner_availability(uuid,uuid,date,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_owner_availability(uuid,uuid,date,uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.get_owner_availability(uuid,uuid,date,uuid)', 'EXECUTE')
  as owner_acl_valid,
  has_function_privilege('service_role', 'public.get_public_availability_by_slug(text,uuid,uuid,date)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.get_public_availability_by_slug(text,uuid,uuid,date)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_public_availability_by_slug(text,uuid,uuid,date)', 'EXECUTE')
  as public_acl_preserved;

-- Rollout: review SQL, apply locally, run owner_availability_test.sql and all pgTAP.
-- Remote application is manual. No data repair/backfill, table grants or RLS changes.
-- Rollback needs a reviewed append-only migration restoring the 026 body before
-- removing the shared helper; disable owner callers first. Never change 027.
