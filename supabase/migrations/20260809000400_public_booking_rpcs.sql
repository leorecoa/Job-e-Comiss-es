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
  v_client_phone text := pg_catalog.btrim(p_client_phone);
  v_notes text := nullif(pg_catalog.btrim(p_notes), '');
begin
  if p_barbershop_id is null or not exists (
    select 1 from public.barbershops as bs
    where bs.id = p_barbershop_id and bs.active = true
  ) then
    raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_INVALID_TENANT';
  end if;

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
     or v_client_phone is null or v_client_phone !~ '^[0-9]{10,11}$'
     or (v_notes is not null and pg_catalog.length(v_notes) > 500) then
    raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_INVALID_INPUT';
  end if;

  if p_start_at is null or p_end_at is null
     or p_start_at <= pg_catalog.now()
     or p_end_at <= p_start_at
     or p_end_at <> p_start_at + pg_catalog.make_interval(mins => v_service_duration_minutes) then
    raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_INVALID_TIME';
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
    and a.start_at >= now()
    and b.active = true
    and bs.active = true
  order by a.start_at asc;
$$;

create or replace function public.link_barber_profile_by_email(p_target_email text, p_target_barber_id uuid)
returns table(profile_id uuid, display_name text, role text, active boolean, barbershop_id uuid, barber_id uuid)
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_owner_profile public.profiles%rowtype;
  v_existing_profile public.profiles%rowtype;
  v_target_barber public.barbers%rowtype;
  v_target_user auth.users%rowtype;
  v_normalized_email text;
  v_display_name text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001', hint = 'Authenticate as an owner before calling this RPC.';
  end if;

  v_normalized_email := lower(trim(coalesce(p_target_email, '')));
  if v_normalized_email = '' then
    raise exception 'TARGET_EMAIL_REQUIRED' using errcode = 'P0001', hint = 'Provide the barber user email.';
  end if;
  if p_target_barber_id is null then
    raise exception 'TARGET_BARBER_REQUIRED' using errcode = 'P0001', hint = 'Provide a barber id from the current tenant.';
  end if;

  select pr.* into v_owner_profile from public.profiles pr
  where pr.id = auth.uid() and pr.active = true limit 1;
  if not found then
    raise exception 'OWNER_PROFILE_REQUIRED' using errcode = 'P0001', hint = 'The authenticated user must have an active owner profile.';
  end if;
  if v_owner_profile.role <> 'owner' then
    raise exception 'OWNER_ROLE_REQUIRED' using errcode = 'P0001', hint = 'Only owners can link barber profiles.';
  end if;
  if v_owner_profile.barbershop_id is null then
    raise exception 'OWNER_BARBERSHOP_REQUIRED' using errcode = 'P0001', hint = 'The owner profile must have a valid barbershop_id.';
  end if;

  select br.* into v_target_barber from public.barbers br
  where br.id = p_target_barber_id and br.barbershop_id = v_owner_profile.barbershop_id limit 1;
  if not found then
    raise exception 'BARBER_NOT_IN_TENANT' using errcode = 'P0001', hint = 'The selected barber does not belong to the current owner tenant.';
  end if;

  select au.* into v_target_user from auth.users au
  where lower(au.email) = v_normalized_email limit 1;
  if not found then
    raise exception 'TARGET_USER_NOT_FOUND' using errcode = 'P0001', hint = 'Ask the barber to create an account first.';
  end if;
  if v_target_user.id = auth.uid() then
    raise exception 'TARGET_USER_CANNOT_BE_OWNER' using errcode = 'P0001', hint = 'Use a separate barber account instead of the current owner user.';
  end if;

  select pr.* into v_existing_profile from public.profiles pr
  where pr.id = v_target_user.id limit 1;
  if found then
    if v_existing_profile.role = 'owner' then
      raise exception 'TARGET_PROFILE_IS_OWNER' using errcode = 'P0001', hint = 'Do not downgrade or repurpose an owner profile through this RPC.';
    end if;
    if v_existing_profile.barbershop_id is not null and v_existing_profile.barbershop_id <> v_owner_profile.barbershop_id then
      raise exception 'TARGET_PROFILE_BELONGS_TO_ANOTHER_TENANT' using errcode = 'P0001', hint = 'The target user is already linked to another barbershop.';
    end if;
  end if;

  v_display_name := coalesce(
    nullif(trim(v_existing_profile.display_name), ''),
    nullif(trim(coalesce(v_target_user.raw_user_meta_data ->> 'display_name', '')), ''),
    split_part(v_target_user.email, '@', 1)
  );

  insert into public.profiles as p (id, display_name, role, active, barbershop_id, barber_id)
  values (v_target_user.id, v_display_name, 'barber', true, v_owner_profile.barbershop_id, v_target_barber.id)
  on conflict (id) do update set
    display_name = excluded.display_name,
    role = 'barber',
    active = true,
    barbershop_id = excluded.barbershop_id,
    barber_id = excluded.barber_id,
    updated_at = now();

  return query
  select
    pr.id as profile_id,
    pr.display_name,
    pr.role,
    pr.active,
    pr.barbershop_id,
    pr.barber_id
  from public.profiles pr
  where pr.id = v_target_user.id;
end;
$$;

comment on function public.link_barber_profile_by_email(text, uuid) is
  'Links an existing auth user to a barber profile inside the authenticated owner tenant.';

create view public.public_appointment_slots with (security_invoker = true) as
select a.barber_id, a.barber_name, a.start_at, a.end_at, a.status, a.barbershop_id
from public.appointments a
join public.barbers b on b.id = a.barber_id and b.barbershop_id = a.barbershop_id
join public.barbershops bs on bs.id = a.barbershop_id
where a.status in ('scheduled', 'confirmed')
  and a.start_at >= now()
  and b.active = true
  and bs.active = true;

revoke all on function public.create_public_appointment(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) from public, anon, authenticated, service_role;
grant all on function public.create_public_appointment(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) to service_role, anon, authenticated;
revoke all on function public.get_public_appointment_slots(uuid) from public, anon, authenticated, service_role;
grant all on function public.get_public_appointment_slots(uuid) to service_role, anon, authenticated;
revoke all on function public.link_barber_profile_by_email(text, uuid) from public, anon, authenticated, service_role;
grant all on function public.link_barber_profile_by_email(text, uuid) to authenticated, service_role;
revoke all on table public.public_appointment_slots from anon, authenticated, service_role;
grant all on table public.public_appointment_slots to service_role;
grant select on table public.public_appointment_slots to anon, authenticated;
