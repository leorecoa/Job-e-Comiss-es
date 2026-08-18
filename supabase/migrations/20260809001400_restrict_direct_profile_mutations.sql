-- Profiles are read-only to authenticated clients. Trusted definer functions own mutations.
revoke insert, update, delete, truncate, references, trigger
  on table public.profiles from authenticated;
revoke insert (id, display_name, role, active, created_at, updated_at, barber_id, barbershop_id),
  update (id, display_name, role, active, created_at, updated_at, barber_id, barbershop_id),
  references (id, display_name, role, active, created_at, updated_at, barber_id, barbershop_id)
  on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_owner_insert_own_barbershop on public.profiles;
drop policy if exists profiles_owner_update_own_barbershop on public.profiles;
drop policy if exists profiles_owner_delete_own_barbershop on public.profiles;

create or replace function public.link_barber_profile_by_email(p_target_email text, p_target_barber_id uuid)
returns table(profile_id uuid, display_name text, role text, active boolean, barbershop_id uuid, barber_id uuid)
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
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

  v_normalized_email := pg_catalog.lower(pg_catalog.btrim(coalesce(p_target_email, '')));
  if v_normalized_email = '' then
    raise exception 'TARGET_EMAIL_REQUIRED' using errcode = 'P0001', hint = 'Provide the barber user email.';
  end if;
  if p_target_barber_id is null then
    raise exception 'TARGET_BARBER_REQUIRED' using errcode = 'P0001', hint = 'Provide a barber id from the current tenant.';
  end if;

  select pr.*
  into v_owner_profile
  from public.profiles as pr
  where pr.id = auth.uid() and pr.active = true
  for update;

  if not found then
    raise exception 'OWNER_PROFILE_REQUIRED' using errcode = 'P0001', hint = 'The authenticated user must have an active owner profile.';
  end if;
  if v_owner_profile.role <> 'owner' then
    raise exception 'OWNER_ROLE_REQUIRED' using errcode = 'P0001', hint = 'Only owners can link barber profiles.';
  end if;
  if v_owner_profile.barbershop_id is null then
    raise exception 'OWNER_BARBERSHOP_REQUIRED' using errcode = 'P0001', hint = 'The owner profile must have a valid barbershop_id.';
  end if;

  select br.*
  into v_target_barber
  from public.barbers as br
  where br.id = p_target_barber_id
    and br.barbershop_id = v_owner_profile.barbershop_id
    and br.active = true
  for update;

  if not found then
    raise exception 'BARBER_NOT_IN_TENANT' using errcode = 'P0001', hint = 'The selected barber does not belong to the current owner tenant.';
  end if;

  select au.*
  into v_target_user
  from auth.users as au
  where pg_catalog.lower(au.email) = v_normalized_email
  limit 1
  for update;

  if not found then
    raise exception 'TARGET_USER_NOT_FOUND' using errcode = 'P0001', hint = 'Ask the barber to create an account first.';
  end if;
  if v_target_user.id = auth.uid() then
    raise exception 'TARGET_USER_CANNOT_BE_OWNER' using errcode = 'P0001', hint = 'Use a separate barber account instead of the current owner user.';
  end if;

  select pr.*
  into v_existing_profile
  from public.profiles as pr
  where pr.id = v_target_user.id
  for update;

  if found then
    if v_existing_profile.role = 'owner' then
      raise exception 'TARGET_PROFILE_IS_OWNER' using errcode = 'P0001', hint = 'Do not downgrade or repurpose an owner profile through this RPC.';
    end if;
    if v_existing_profile.barbershop_id is not null
       and v_existing_profile.barbershop_id <> v_owner_profile.barbershop_id then
      raise exception 'TARGET_PROFILE_BELONGS_TO_ANOTHER_TENANT' using errcode = 'P0001', hint = 'The target user is already linked to another barbershop.';
    end if;
  end if;

  v_display_name := coalesce(
    nullif(pg_catalog.btrim(v_existing_profile.display_name), ''),
    nullif(pg_catalog.btrim(coalesce(v_target_user.raw_user_meta_data ->> 'display_name', '')), ''),
    pg_catalog.split_part(v_target_user.email, '@', 1)
  );

  insert into public.profiles as p (id, display_name, role, active, barbershop_id, barber_id)
  values (v_target_user.id, v_display_name, 'barber', true, v_owner_profile.barbershop_id, v_target_barber.id)
  on conflict (id) do update set
    display_name = excluded.display_name,
    role = 'barber',
    active = true,
    barbershop_id = excluded.barbershop_id,
    barber_id = excluded.barber_id,
    updated_at = pg_catalog.now();

  return query
  select pr.id, pr.display_name, pr.role, pr.active, pr.barbershop_id, pr.barber_id
  from public.profiles as pr
  where pr.id = v_target_user.id;
end
$function$;

revoke all on function public.link_barber_profile_by_email(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.link_barber_profile_by_email(text, uuid)
  to authenticated;

comment on function public.link_barber_profile_by_email(text, uuid) is
  'Links an Auth barber profile inside the authenticated owner tenant with serialized row locks.';
