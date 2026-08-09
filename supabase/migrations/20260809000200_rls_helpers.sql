create or replace function private.current_user_barber_id()
returns uuid
language sql stable security definer
set search_path to 'public', 'private'
as $$
  select p.barber_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function private.current_user_barbershop_id()
returns uuid
language sql stable security definer
set search_path to 'public', 'private'
as $$
  select p.barbershop_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function private.current_user_role()
returns text
language sql stable security definer
set search_path to 'public'
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and active = true
  limit 1;
$$;

grant usage on schema private to authenticated;

-- Production currently relies on default PUBLIC EXECUTE for the first two helpers.
revoke all on function private.current_user_role() from public;
grant all on function private.current_user_role() to authenticated;
