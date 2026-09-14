-- Local validation first; remote rollout requires manual review.
-- Existing data is not repaired. Configuration edits fail on incompatible future reservations.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_index i
    where i.indexrelid = pg_catalog.to_regclass('public.appointments_unique_active_barbershop_barber_start')
      and i.indrelid = 'public.appointments'::regclass and i.indisunique and i.indisvalid
  ) or not exists (
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid = 'public.appointments'::regclass
      and c.conname = 'appointments_no_overlap' and c.contype = 'x' and c.convalidated
  ) then
    raise exception 'AVAILABILITY_PREFLIGHT_CONSTRAINT_MISMATCH';
  end if;
end;
$$;
drop index public.appointments_unique_active_barbershop_barber_start;

-- Tenant gate prevents phantom barbers during global configuration changes.
-- There is no cross-tenant global gate. Namespace prefixes isolate the phone lock.
-- Lock order: sorted tenants, sorted barber pairs, phone (public), appointment row.
create function private.lock_availability_tenants(p_tenants uuid[])
returns void language plpgsql volatile security definer set search_path = pg_catalog
as $$
declare v_id uuid;
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '25000', message = 'AVAILABILITY_REQUIRES_READ_COMMITTED';
  end if;
  for v_id in select distinct x from pg_catalog.unnest(p_tenants) x where x is not null order by x loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('availability:tenant:' || v_id::text, 0));
  end loop;
end;
$$;

create function private.lock_barber_availability(p_tenant uuid, p_barbers uuid[])
returns void language plpgsql volatile security definer set search_path = pg_catalog
as $$
declare v_id uuid;
begin
  perform private.lock_availability_tenants(array[p_tenant]);
  for v_id in select distinct x from pg_catalog.unnest(p_barbers) x where x is not null order by x loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('availability:barber:' || p_tenant::text || ':' || v_id::text, 0));
  end loop;
end;
$$;

-- Single-candidate validator, not the public read RPC. VOLATILE queries run after
-- the lock wait and see committed state under READ COMMITTED.
create function private.validate_appointment_availability(
  p_tenant uuid, p_barber uuid, p_service uuid, p_start timestamptz,
  p_ignore uuid default null
)
returns timestamptz language plpgsql volatile security definer set search_path = pg_catalog
as $$
declare
  v_shop public.barbershops%rowtype;
  v_mode text;
  v_duration integer;
  v_end timestamptz;
  v_wall timestamp;
  v_day timestamp;
  v_weekday integer;
  v_step integer;
  v_config jsonb;
  v_open time;
  v_close time;
  v_fit boolean;
begin
  perform private.lock_barber_availability(p_tenant, array[p_barber]);
  select b.* into v_shop from public.barbershops b where b.id=p_tenant and b.active is true;
  if not found then raise exception 'APPOINTMENT_INVALID_TENANT'; end if;
  select b.availability_mode into v_mode from public.barbers b
  where b.id=p_barber and b.barbershop_id=p_tenant and b.active is true;
  if not found then raise exception 'APPOINTMENT_INVALID_BARBER'; end if;
  select s.duration_minutes into v_duration from public.services s
  where s.id=p_service and s.barbershop_id=p_tenant and s.active is true;
  if not found then raise exception 'APPOINTMENT_INVALID_SERVICE'; end if;
  if v_shop.operational_timezone is null then raise exception 'APPOINTMENT_TIMEZONE_REQUIRED'; end if;
  if v_shop.slot_step_minutes is null then raise exception 'APPOINTMENT_SLOT_STEP_REQUIRED'; end if;
  if p_start is null or not pg_catalog.isfinite(p_start) or p_start <= pg_catalog.now() then
    raise exception 'APPOINTMENT_INVALID_TIME';
  end if;
  v_end := p_start + pg_catalog.make_interval(mins=>v_duration);
  v_wall := p_start at time zone v_shop.operational_timezone;
  -- Reject the other occurrence of a DST fold; nonexistent wall times cannot
  -- round-trip. Same standard-time choice as 026, with no financial fallback.
  if (v_wall at time zone v_shop.operational_timezone) <> p_start then
    raise exception 'APPOINTMENT_INVALID_TIME';
  end if;
  v_day := v_wall::date::timestamp;
  v_weekday := extract(dow from v_wall)::integer;
  v_step := greatest(5,least(120,v_shop.slot_step_minutes));
  if v_mode='inherit' then
    v_config := v_shop.business_hours -> (array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[v_weekday+1];
    if pg_catalog.jsonb_typeof(v_shop.business_hours) is distinct from 'object'
      or pg_catalog.jsonb_typeof(v_config) is distinct from 'object'
      or pg_catalog.jsonb_typeof(v_config->'active') is distinct from 'boolean'
      or coalesce(v_config->>'open','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(v_config->>'close','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'APPOINTMENT_INVALID_BUSINESS_HOURS';
    end if;
    if not (v_config->>'active')::boolean then raise exception 'APPOINTMENT_OUTSIDE_WORKING_HOURS'; end if;
    v_open := (v_config->>'open')::time;
    v_close := (v_config->>'close')::time;
    if v_open >= v_close then raise exception 'APPOINTMENT_INVALID_BUSINESS_HOURS'; end if;
  end if;
  with walls as (
    select v_day+(v_open-time '00:00') as opens,v_day+(v_close-time '00:00') as closes where v_mode='inherit'
    union all
    select v_day+(w.start_time-time '00:00'),v_day+(w.end_time-time '00:00')
    from public.barber_working_hours w
    where v_mode='custom' and w.barbershop_id=p_tenant and w.barber_id=p_barber and w.weekday=v_weekday
  ), bounds as (
    select w.*,w.opens at time zone v_shop.operational_timezone as opens_at,
      w.closes at time zone v_shop.operational_timezone as closes_at from walls w
  )
  select exists(select 1 from bounds b
    where b.opens_at at time zone v_shop.operational_timezone=b.opens
      and b.closes_at at time zone v_shop.operational_timezone=b.closes
      and v_wall>=b.opens and v_wall<b.closes
      and mod(extract(epoch from (v_wall-b.opens)),v_step*60)=0
      and p_start>=b.opens_at and v_end<=b.closes_at
      and v_end at time zone v_shop.operational_timezone between b.opens and b.closes
  ) into v_fit;
  if not v_fit then raise exception 'APPOINTMENT_OUTSIDE_WORKING_HOURS'; end if;
  if exists(select 1 from public.barber_time_off t where t.barbershop_id=p_tenant and t.barber_id=p_barber
    and t.starts_at<v_end and t.ends_at>p_start) then raise exception 'APPOINTMENT_TIME_OFF_CONFLICT'; end if;
  if exists(select 1 from public.appointments a where a.barbershop_id=p_tenant and a.barber_id=p_barber
    and a.id is distinct from p_ignore and a.status in ('scheduled','confirmed')
    and a.start_at<v_end and a.end_at>p_start) then raise exception 'APPOINTMENT_ACTIVE_SLOT_CONFLICT'; end if;
  return v_end;
end;
$$;

create function private.enforce_appointment_availability()
returns trigger language plpgsql volatile security definer set search_path = pg_catalog
as $$
declare v_expected timestamptz; v_temporal boolean;
begin
  if tg_op='DELETE' then
    perform private.lock_barber_availability(old.barbershop_id,array[old.barber_id]);
    return old;
  end if;
  if tg_op='UPDATE' then
    perform private.lock_availability_tenants(array[old.barbershop_id,new.barbershop_id]);
    perform private.lock_barber_availability(old.barbershop_id,array[old.barber_id,new.barber_id]);
  end if;
  perform private.lock_barber_availability(new.barbershop_id,array[new.barber_id]);
  if tg_op='UPDATE' then
    if old.status='completed' or old.financial_record_id is not null
      or exists(select 1 from public.financial_records f where f.appointment_id=old.id) then
      if row(new.barbershop_id,new.barber_id,new.barber_name,new.service_id,new.service_type,
        new.service_value,new.commission_rate,new.start_at,new.end_at)
        is distinct from row(old.barbershop_id,old.barber_id,old.barber_name,old.service_id,old.service_type,
        old.service_value,old.commission_rate,old.start_at,old.end_at)
        or (old.status='completed' and new.status is distinct from 'completed')
        or (new.status in ('scheduled','confirmed') and new.status is distinct from old.status) then
        raise exception 'APPOINTMENT_HISTORY_PROTECTED';
      end if;
    end if;
    v_temporal := row(new.barbershop_id,new.barber_id,new.service_id,new.start_at,new.end_at)
      is distinct from row(old.barbershop_id,old.barber_id,old.service_id,old.start_at,old.end_at);
  else
    v_temporal := true;
  end if;
  if v_temporal then
    select new.start_at+pg_catalog.make_interval(mins=>s.duration_minutes) into v_expected
    from public.services s where s.id=new.service_id and s.barbershop_id=new.barbershop_id and s.active is true;
    if not found then raise exception 'APPOINTMENT_INVALID_SERVICE'; end if;
    if new.end_at is distinct from v_expected then raise exception 'APPOINTMENT_DURATION_MISMATCH'; end if;
  end if;
  if new.status in ('scheduled','confirmed') and
    (v_temporal or (tg_op='UPDATE' and old.status not in ('scheduled','confirmed'))) then
    v_expected := private.validate_appointment_availability(
      new.barbershop_id,new.barber_id,new.service_id,new.start_at,new.id);
    if new.end_at is distinct from v_expected then raise exception 'APPOINTMENT_DURATION_MISMATCH'; end if;
  end if;
  return new;
end;
$$;

create trigger appointments_availability_before
before insert or update or delete on public.appointments
for each row execute function private.enforce_appointment_availability();

-- Direct configuration writes already hold their tuple lock in row triggers.
-- All participate in tenant/pair coordination. PostgreSQL may abort a deadlock
-- involving such writes; no failed transaction is silently accepted or retried.
create function private.guard_availability_configuration()
returns trigger language plpgsql volatile security definer set search_path = pg_catalog
as $$
declare
  v_old jsonb := case when tg_op<>'INSERT' then pg_catalog.to_jsonb(old) end;
  v_new jsonb := case when tg_op<>'DELETE' then pg_catalog.to_jsonb(new) end;
  v_tenants uuid[];
  v_tenant uuid;
  v_barbers uuid[];
  v_a public.appointments%rowtype;
  v_expected timestamptz;
begin
  if tg_table_name='barbershops' then
    if tg_op='UPDATE' and row(new.operational_timezone,new.business_hours,new.slot_step_minutes,new.active)
      is not distinct from row(old.operational_timezone,old.business_hours,old.slot_step_minutes,old.active) then return new; end if;
    v_tenants := array[(v_old->>'id')::uuid,(v_new->>'id')::uuid];
  else
    if tg_table_name='barbers' and tg_op='UPDATE' and row(v_new->'availability_mode',v_new->'active',v_new->'barbershop_id')
      is not distinct from row(v_old->'availability_mode',v_old->'active',v_old->'barbershop_id') then return new; end if;
    if tg_table_name='services' and tg_op='UPDATE' and row(v_new->'duration_minutes',v_new->'active',v_new->'barbershop_id')
      is not distinct from row(v_old->'duration_minutes',v_old->'active',v_old->'barbershop_id') then return new; end if;
    v_tenants := array[(v_old->>'barbershop_id')::uuid,(v_new->>'barbershop_id')::uuid];
  end if;
  perform private.lock_availability_tenants(v_tenants);
  for v_tenant in select distinct x from pg_catalog.unnest(v_tenants) x where x is not null order by x loop
    select pg_catalog.array_agg(b.id order by b.id) into v_barbers from public.barbers b where b.barbershop_id=v_tenant;
    perform private.lock_barber_availability(v_tenant,v_barbers);
  end loop;
  if tg_when='AFTER' then
    -- Conservative post-mutation check: no automatic movement/cancellation.
    for v_a in select a.* from public.appointments a
      where a.barbershop_id=any(v_tenants) and a.status in ('scheduled','confirmed') and a.start_at>pg_catalog.now()
      order by a.barbershop_id,a.barber_id,a.id loop
      v_expected := private.validate_appointment_availability(v_a.barbershop_id,v_a.barber_id,v_a.service_id,v_a.start_at,v_a.id);
      if v_a.end_at is distinct from v_expected then raise exception 'APPOINTMENT_DURATION_MISMATCH'; end if;
    end loop;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

create trigger barber_working_hours_availability_before
before insert or update or delete on public.barber_working_hours
for each row execute function private.guard_availability_configuration();

create trigger barber_working_hours_availability_after
after insert or update or delete on public.barber_working_hours
for each row execute function private.guard_availability_configuration();

create trigger barber_time_off_availability_before
before insert or update or delete on public.barber_time_off
for each row execute function private.guard_availability_configuration();

create trigger barber_time_off_availability_after
after insert or update or delete on public.barber_time_off
for each row execute function private.guard_availability_configuration();

create trigger barbers_availability_before
before insert or update or delete on public.barbers
for each row execute function private.guard_availability_configuration();

create trigger barbers_availability_after
after insert or update or delete on public.barbers
for each row execute function private.guard_availability_configuration();

create trigger barbershops_availability_before
before insert or update or delete on public.barbershops
for each row execute function private.guard_availability_configuration();

create trigger barbershops_availability_after
after insert or update or delete on public.barbershops
for each row execute function private.guard_availability_configuration();

create trigger services_availability_before
before insert or update or delete on public.services
for each row execute function private.guard_availability_configuration();

create trigger services_availability_after
after insert or update or delete on public.services
for each row execute function private.guard_availability_configuration();

-- Compatible replacements retain their existing ACLs; financial arithmetic unchanged.
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

  perform private.lock_barber_availability(v_profile.barbershop_id, array[v_profile.barber_id]);

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

  v_end_at := private.validate_appointment_availability(v_profile.barbershop_id,v_profile.barber_id,p_service_id,p_start_at);

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
  v_current public.appointments%rowtype;
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

  perform private.lock_availability_tenants(array[v_profile.barbershop_id]);
  select a.* into v_current from public.appointments a
    where a.id=p_appointment_id and a.barbershop_id=v_profile.barbershop_id;
  if not found then raise exception 'OWNER_APPOINTMENT_NOT_FOUND'; end if;
  perform private.lock_barber_availability(v_profile.barbershop_id,array[v_current.barber_id,p_barber_id]);
  -- The tenant gate was acquired before reading OLD and before any row lock.
  perform 1 from public.appointments a where a.id=p_appointment_id for update;

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

create or replace function public.complete_appointment_with_financial_record(p_appointment_id uuid)
returns table (appointment_id uuid, financial_record_id uuid)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_profile public.profiles%rowtype;
  v_appointment public.appointments%rowtype;
  v_financial_record_id uuid;
  v_commission_rate numeric(5,2);
  v_commission_value numeric(10,2);
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'FINANCIAL_COMPLETION_UNAUTHENTICATED';
  end if;

  select p.*
    into v_profile
  from public.profiles as p
  where p.id = auth.uid();

  if not found
    or v_profile.role is distinct from 'owner'
    or v_profile.active is distinct from true
    or v_profile.barbershop_id is null
  then
    raise exception using errcode = 'P0001', message = 'FINANCIAL_COMPLETION_FORBIDDEN';
  end if;

  perform private.lock_availability_tenants(array[v_profile.barbershop_id]);
  select a.* into v_appointment from public.appointments a
  where a.id=p_appointment_id and a.barbershop_id=v_profile.barbershop_id;
  if not found then raise exception 'FINANCIAL_COMPLETION_APPOINTMENT_NOT_FOUND'; end if;
  perform private.lock_barber_availability(v_profile.barbershop_id,array[v_appointment.barber_id]);

  select a.*
    into v_appointment
  from public.appointments as a
  where a.id = p_appointment_id
  for update;

  if not found
    or v_appointment.barbershop_id is distinct from v_profile.barbershop_id
  then
    raise exception using errcode = 'P0001', message = 'FINANCIAL_COMPLETION_APPOINTMENT_NOT_FOUND';
  end if;

  if v_appointment.status in ('cancelled', 'no_show') then
    raise exception using errcode = 'P0001', message = 'FINANCIAL_COMPLETION_INVALID_STATUS';
  end if;

  select fr.id
    into v_financial_record_id
  from public.financial_records as fr
  where fr.appointment_id = v_appointment.id;

  if v_financial_record_id is not null then
    if v_appointment.status <> 'completed'
      or v_appointment.financial_record_id is distinct from v_financial_record_id::text
    then
      update public.appointments as a
      set status = 'completed', financial_record_id = v_financial_record_id::text
      where a.id = v_appointment.id;
    end if;

    return query select v_appointment.id, v_financial_record_id;
    return;
  end if;

  if v_appointment.status not in ('scheduled', 'confirmed', 'completed') then
    raise exception using errcode = 'P0001', message = 'FINANCIAL_COMPLETION_INVALID_STATUS';
  end if;

  v_commission_rate := coalesce(
    v_appointment.commission_rate,
    (select s.commission_rate from public.services as s where s.id = v_appointment.service_id),
    0
  );
  v_commission_value := case
    when lower(v_appointment.service_type) = 'produto' then 0
    else round(v_appointment.service_value * v_commission_rate / 100, 2)
  end;

  insert into public.financial_records (
    appointment_id, barbershop_id, barber_id, service_id, service_type,
    service_value, commission_rate, commission_value, completed_at
  ) values (
    v_appointment.id, v_appointment.barbershop_id, v_appointment.barber_id,
    v_appointment.service_id, v_appointment.service_type, v_appointment.service_value,
    v_commission_rate, v_commission_value, now()
  )
  returning id into v_financial_record_id;

  update public.appointments as a
  set status = 'completed', financial_record_id = v_financial_record_id::text
  where a.id = v_appointment.id;

  return query select v_appointment.id, v_financial_record_id;
end;
$$;

revoke all on function private.lock_availability_tenants(uuid[]) from public, anon, authenticated, service_role;
revoke all on function private.lock_barber_availability(uuid,uuid[]) from public, anon, authenticated, service_role;
revoke all on function private.validate_appointment_availability(uuid,uuid,uuid,timestamptz,uuid) from public, anon, authenticated, service_role;
revoke all on function private.enforce_appointment_availability() from public, anon, authenticated, service_role;
revoke all on function private.guard_availability_configuration() from public, anon, authenticated, service_role;

-- Rollback requires a separate reviewed migration: never disable triggers or restore
-- legacy grants to bypass a failed validation. Existing writers and signatures remain.
