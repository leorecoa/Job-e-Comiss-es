-- Job e Comissoes - Owner -> barber profile linking RPC
-- Review-only SQL. Do not apply automatically.
--
-- Purpose:
-- - allow an authenticated owner to link an existing barber row
--   to an existing auth user identified by email
-- - keep tenant isolation by barbershop_id
-- - avoid exposing auth.users directly to the frontend
-- - avoid relaxing existing RLS policies on public.profiles
--
-- Important:
-- - apply manually in Supabase SQL editor after review
-- - apply after docs/supabase-schema.sql and docs/supabase-tenant-rls-plan.sql
-- - validate in a staging/secondary tenant scenario before production
-- - this RPC is intended to replace ad hoc SQL updates for barber linking
-- - it does not expose auth.users or target e-mail addresses to the frontend

begin;

create or replace function public.link_barber_profile_by_email(
  p_target_email text,
  p_target_barber_id uuid
)
returns table (
  profile_id uuid,
  display_name text,
  role text,
  active boolean,
  barbershop_id uuid,
  barber_id uuid
)
language plpgsql
security definer
set search_path = public
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
    raise exception 'AUTH_REQUIRED'
      using errcode = 'P0001',
            hint = 'Authenticate as an owner before calling this RPC.';
  end if;

  v_normalized_email := lower(trim(coalesce(p_target_email, '')));

  if v_normalized_email = '' then
    raise exception 'TARGET_EMAIL_REQUIRED'
      using errcode = 'P0001',
            hint = 'Provide the barber user email.';
  end if;

  if p_target_barber_id is null then
    raise exception 'TARGET_BARBER_REQUIRED'
      using errcode = 'P0001',
            hint = 'Provide a barber id from the current tenant.';
  end if;

  select pr.*
  into v_owner_profile
  from public.profiles pr
  where pr.id = auth.uid()
    and pr.active = true
  limit 1;

  if not found then
    raise exception 'OWNER_PROFILE_REQUIRED'
      using errcode = 'P0001',
            hint = 'The authenticated user must have an active owner profile.';
  end if;

  if v_owner_profile.role <> 'owner' then
    raise exception 'OWNER_ROLE_REQUIRED'
      using errcode = 'P0001',
            hint = 'Only owners can link barber profiles.';
  end if;

  if v_owner_profile.barbershop_id is null then
    raise exception 'OWNER_BARBERSHOP_REQUIRED'
      using errcode = 'P0001',
            hint = 'The owner profile must have a valid barbershop_id.';
  end if;

  select br.*
  into v_target_barber
  from public.barbers br
  where br.id = p_target_barber_id
    and br.barbershop_id = v_owner_profile.barbershop_id
  limit 1;

  if not found then
    raise exception 'BARBER_NOT_IN_TENANT'
      using errcode = 'P0001',
            hint = 'The selected barber does not belong to the current owner tenant.';
  end if;

  select au.*
  into v_target_user
  from auth.users au
  where lower(au.email) = v_normalized_email
  limit 1;

  if not found then
    raise exception 'TARGET_USER_NOT_FOUND'
      using errcode = 'P0001',
            hint = 'Ask the barber to create an account first.';
  end if;

  if v_target_user.id = auth.uid() then
    raise exception 'TARGET_USER_CANNOT_BE_OWNER'
      using errcode = 'P0001',
            hint = 'Use a separate barber account instead of the current owner user.';
  end if;

  select pr.*
  into v_existing_profile
  from public.profiles pr
  where pr.id = v_target_user.id
  limit 1;

  if found then
    if v_existing_profile.role = 'owner' then
      raise exception 'TARGET_PROFILE_IS_OWNER'
        using errcode = 'P0001',
              hint = 'Do not downgrade or repurpose an owner profile through this RPC.';
    end if;

    if v_existing_profile.barbershop_id is not null
       and v_existing_profile.barbershop_id <> v_owner_profile.barbershop_id then
      raise exception 'TARGET_PROFILE_BELONGS_TO_ANOTHER_TENANT'
        using errcode = 'P0001',
              hint = 'The target user is already linked to another barbershop.';
    end if;
  end if;

  v_display_name := coalesce(
    nullif(trim(v_existing_profile.display_name), ''),
    nullif(trim(coalesce(v_target_user.raw_user_meta_data ->> 'display_name', '')), ''),
    split_part(v_target_user.email, '@', 1)
  );

  insert into public.profiles as p (
    id,
    display_name,
    role,
    active,
    barbershop_id,
    barber_id
  )
  values (
    v_target_user.id,
    v_display_name,
    'barber',
    true,
    v_owner_profile.barbershop_id,
    v_target_barber.id
  )
  on conflict (id) do update
  set
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

comment on function public.link_barber_profile_by_email(text, uuid)
is 'Links an existing auth user to a barber profile inside the authenticated owner tenant.';

revoke all on function public.link_barber_profile_by_email(text, uuid) from public;
revoke all on function public.link_barber_profile_by_email(text, uuid) from anon;
grant execute on function public.link_barber_profile_by_email(text, uuid) to authenticated;

commit;
