-- Profiles may exist before tenant assignment, but partial barber links are forbidden.
do $preflight$
begin
  if exists (
    select 1
    from public.profiles as p
    where p.role = 'owner'
      and p.barber_id is not null
  ) then
    raise exception using errcode = '23514', message = 'PROFILE_OWNER_BARBER_PREFLIGHT_FAILED';
  end if;

  if exists (
    select 1
    from public.profiles as p
    where p.role = 'barber'
      and ((p.barber_id is null) <> (p.barbershop_id is null))
  ) then
    raise exception using errcode = '23514', message = 'PROFILE_BARBER_LINK_PREFLIGHT_FAILED';
  end if;
end
$preflight$;

alter table public.profiles
  alter column barbershop_id drop not null;

alter table public.profiles
  add constraint profiles_owner_without_barber_check
    check (role <> 'owner' or barber_id is null),
  add constraint profiles_barber_link_complete_check
    check (
      role <> 'barber'
      or (barber_id is null and barbershop_id is null)
      or (barber_id is not null and barbershop_id is not null)
    );

create or replace function private.provision_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_role text := new.raw_user_meta_data ->> 'role';
  v_display_name text := nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), '');
begin
  if v_role is null or v_role not in ('owner', 'barber') then
    return new;
  end if;

  insert into public.profiles (
    id,
    display_name,
    role,
    active,
    barbershop_id,
    barber_id
  ) values (
    new.id,
    v_display_name,
    v_role,
    true,
    null,
    null
  )
  on conflict (id) do nothing;

  return new;
end
$function$;

revoke all on function private.provision_profile_from_auth_user() from public, anon, authenticated, service_role;

drop trigger if exists provision_profile_after_auth_user_insert on auth.users;
create trigger provision_profile_after_auth_user_insert
after insert on auth.users
for each row execute function private.provision_profile_from_auth_user();

-- Repair only users whose metadata explicitly declares a supported role.
insert into public.profiles (
  id,
  display_name,
  role,
  active,
  barbershop_id,
  barber_id
)
select
  u.id,
  nullif(pg_catalog.btrim(u.raw_user_meta_data ->> 'display_name'), ''),
  u.raw_user_meta_data ->> 'role',
  true,
  null,
  null
from auth.users as u
where u.raw_user_meta_data ->> 'role' in ('owner', 'barber')
on conflict (id) do nothing;

-- Onboarding writes are performed only by the transactional RPC below.
drop policy if exists barbershops_authenticated_insert on public.barbershops;
drop policy if exists profiles_onboarding_insert_owner on public.profiles;
drop policy if exists profiles_onboarding_update_self_owner on public.profiles;

create or replace function public.create_owner_barbershop(
  p_name text,
  p_slug text,
  p_phone text default null,
  p_address text default null,
  p_whatsapp text default null,
  p_description text default null,
  p_business_hours jsonb default null,
  p_slot_step_minutes integer default null
)
returns table (
  id uuid,
  name text,
  slug text,
  phone text,
  address text,
  logo_url text,
  cover_image_url text,
  description text,
  instagram_url text,
  whatsapp text,
  primary_color text,
  secondary_color text,
  business_hours jsonb,
  slot_step_minutes integer,
  active boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_barbershop public.barbershops%rowtype;
  v_name text := pg_catalog.regexp_replace(pg_catalog.btrim(p_name), '[[:space:]]+', ' ', 'g');
  v_slug text := pg_catalog.lower(pg_catalog.btrim(p_slug));
  v_phone text := nullif(pg_catalog.btrim(p_phone), '');
  v_address text := nullif(pg_catalog.btrim(p_address), '');
  v_whatsapp text := nullif(pg_catalog.btrim(p_whatsapp), '');
  v_description text := nullif(pg_catalog.btrim(p_description), '');
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'OWNER_ONBOARDING_AUTH_REQUIRED';
  end if;

  select p.*
  into v_profile
  from public.profiles as p
  where p.id = v_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'OWNER_ONBOARDING_PROFILE_NOT_FOUND';
  end if;

  if v_profile.active is distinct from true or v_profile.role <> 'owner' then
    raise exception using errcode = 'P0001', message = 'OWNER_ONBOARDING_NOT_AUTHORIZED';
  end if;

  if v_profile.barbershop_id is not null then
    raise exception using errcode = 'P0001', message = 'OWNER_ONBOARDING_ALREADY_CONFIGURED';
  end if;

  if v_name is null or pg_catalog.length(v_name) = 0
     or v_slug is null
     or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or (v_whatsapp is not null and v_whatsapp !~ '^\+?[0-9\s().-]{10,20}$')
     or (p_slot_step_minutes is not null and p_slot_step_minutes <= 0) then
    raise exception using errcode = 'P0001', message = 'OWNER_ONBOARDING_INVALID_INPUT';
  end if;

  begin
    insert into public.barbershops (
      name,
      slug,
      phone,
      address,
      whatsapp,
      description,
      business_hours,
      slot_step_minutes,
      active
    ) values (
      v_name,
      v_slug,
      v_phone,
      v_address,
      v_whatsapp,
      v_description,
      p_business_hours,
      p_slot_step_minutes,
      true
    )
    returning * into v_barbershop;
  exception
    when unique_violation then
      raise exception using errcode = 'P0001', message = 'OWNER_ONBOARDING_SLUG_TAKEN';
  end;

  update public.profiles as p
  set barbershop_id = v_barbershop.id,
      updated_at = pg_catalog.now()
  where p.id = v_user_id;

  return query
  select
    v_barbershop.id,
    v_barbershop.name,
    v_barbershop.slug,
    v_barbershop.phone,
    v_barbershop.address,
    v_barbershop.logo_url,
    v_barbershop.cover_image_url,
    v_barbershop.description,
    v_barbershop.instagram_url,
    v_barbershop.whatsapp,
    v_barbershop.primary_color,
    v_barbershop.secondary_color,
    v_barbershop.business_hours,
    v_barbershop.slot_step_minutes,
    v_barbershop.active;
end
$function$;

revoke all on function public.create_owner_barbershop(text, text, text, text, text, text, jsonb, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.create_owner_barbershop(text, text, text, text, text, text, jsonb, integer)
  to authenticated;

comment on function private.provision_profile_from_auth_user() is
  'Creates an unscoped profile only when Auth metadata explicitly declares owner or barber.';
comment on function public.create_owner_barbershop(text, text, text, text, text, text, jsonb, integer) is
  'Atomically creates the first barbershop and links the authenticated owner profile.';
