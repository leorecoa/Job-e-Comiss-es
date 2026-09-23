-- Review locally first; remote application is manual.
-- PR A adds an owner writer without removing the existing direct INSERT bridge.
create function public.create_owner_appointment(
  p_service_id uuid,
  p_barber_id uuid,
  p_client_name text,
  p_client_phone text,
  p_start_at timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql volatile security definer
set search_path = pg_catalog
as $$
declare
  v_profile public.profiles%rowtype;
  v_barber public.barbers%rowtype;
  v_service public.services%rowtype;
  v_end_at timestamptz;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'OWNER_APPOINTMENT_CREATE_UNAUTHENTICATED';
  end if;
  select p.* into v_profile from public.profiles p where p.id = auth.uid();
  if not found or v_profile.active is distinct from true
    or v_profile.role is distinct from 'owner' or v_profile.barbershop_id is null then
    raise exception 'OWNER_APPOINTMENT_CREATE_FORBIDDEN';
  end if;

  -- Same tenant -> barber protocol as 027, before reading catalogue snapshots.
  perform private.lock_barber_availability(v_profile.barbershop_id, array[p_barber_id]);
  select b.* into v_barber from public.barbers b
  where b.id = p_barber_id and b.barbershop_id = v_profile.barbershop_id and b.active is true;
  if not found then raise exception 'OWNER_APPOINTMENT_INVALID_BARBER'; end if;
  select s.* into v_service from public.services s
  where s.id = p_service_id and s.barbershop_id = v_profile.barbershop_id and s.active is true;
  if not found then raise exception 'OWNER_APPOINTMENT_INVALID_SERVICE'; end if;

  -- Preserve the owner/schema input contract, including formatted phones of 8-20 characters.
  if p_client_name is null or pg_catalog.char_length(p_client_name) not between 2 and 80
    or p_client_phone is null or pg_catalog.char_length(p_client_phone) not between 8 and 20
    or (p_notes is not null and pg_catalog.char_length(p_notes) > 500) then
    raise exception 'OWNER_APPOINTMENT_INVALID_INPUT';
  end if;

  v_end_at := private.validate_appointment_availability(
    v_profile.barbershop_id, v_barber.id, v_service.id, p_start_at);
  begin
    insert into public.appointments (
      barbershop_id, barber_id, barber_name, service_id, service_type,
      service_value, commission_rate, client_name, client_phone,
      start_at, end_at, status, notes, financial_record_id
    ) values (
      v_profile.barbershop_id, v_barber.id, v_barber.name, v_service.id, v_service.name,
      v_service.price, v_service.commission_rate, p_client_name, p_client_phone,
      p_start_at, v_end_at, 'scheduled', p_notes, null
    ) returning id into v_id;
  exception when unique_violation or exclusion_violation then
    raise exception 'APPOINTMENT_ACTIVE_SLOT_CONFLICT';
  end;
  return v_id;
end;
$$;

revoke all on function public.create_owner_appointment(uuid,uuid,text,text,timestamptz,text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_owner_appointment(uuid,uuid,text,text,timestamptz,text)
  to authenticated;

comment on function public.create_owner_appointment(uuid,uuid,text,text,timestamptz,text) is
  'Owner-only scheduled creation with session tenant and catalogue snapshots; 027 enforces availability. Direct owner INSERT remains until a later cutover.';

-- Read-only rollout validation: all values must be true.
select
  has_function_privilege('authenticated', 'public.create_owner_appointment(uuid,uuid,text,text,timestamptz,text)', 'EXECUTE') as authenticated_execute,
  not has_function_privilege('anon', 'public.create_owner_appointment(uuid,uuid,text,text,timestamptz,text)', 'EXECUTE') as anon_denied,
  not has_function_privilege('service_role', 'public.create_owner_appointment(uuid,uuid,text,text,timestamptz,text)', 'EXECUTE') as service_role_denied,
  not exists (
    select 1 from pg_catalog.pg_proc p,
      lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
    where p.oid = 'public.create_owner_appointment(uuid,uuid,text,text,timestamptz,text)'::regprocedure
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) as public_denied,
  has_table_privilege('authenticated', 'public.appointments', 'INSERT') as bridge_preserved;
