-- Review-only until manually approved for remote rollout. No backfill or default.
alter table public.barbershops add column financial_timezone text;

create function private.validate_barbershop_financial_timezone()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.financial_timezone is not null and (
    new.financial_timezone ~ '^(posix|right)/'
    or not exists (
      select 1 from pg_catalog.pg_timezone_names as tz
      where tz.name = new.financial_timezone
    )
  ) then
    raise exception using errcode = '22023', message = 'INVALID_FINANCIAL_TIMEZONE';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_barbershop_financial_timezone()
  from public, anon, authenticated, service_role;

create trigger validate_barbershop_financial_timezone
before insert or update of financial_timezone on public.barbershops
for each row execute function private.validate_barbershop_financial_timezone();

-- Preserve the old public projection, without exposing the new financial setting.
revoke select on public.barbershops from anon;
grant select (id, name, slug, phone, address, active, created_at, updated_at,
  logo_url, cover_image_url, description, instagram_url, whatsapp,
  primary_color, secondary_color, business_hours, slot_step_minutes)
  on public.barbershops to anon;

-- Required ninth argument prevents ambiguity with the unchanged eight-argument RPC.
create function public.create_owner_barbershop(
  p_name text, p_slug text, p_phone text, p_address text, p_whatsapp text,
  p_description text, p_business_hours jsonb, p_slot_step_minutes integer,
  p_financial_timezone text
)
returns setof public.barbershops
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_barbershop_id uuid;
begin
  -- Existing RPC derives the active owner from auth.uid(), locks the profile,
  -- creates the tenant and links it. Both operations share this transaction.
  select created.id into v_barbershop_id
  from public.create_owner_barbershop(
    p_name, p_slug, p_phone, p_address, p_whatsapp, p_description,
    p_business_hours, p_slot_step_minutes
  ) as created;

  return query
  update public.barbershops as b
    set financial_timezone = p_financial_timezone
    where b.id = v_barbershop_id
    returning b.*;
end;
$$;

revoke all on function public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text)
  to authenticated;

comment on column public.barbershops.financial_timezone is
  'Owner-confirmed IANA timezone for future financial calendars; NULL means unconfigured. Not used by booking or reports yet.';

-- Final read-only validation: expected true, true, true, true.
select
  not has_column_privilege('anon', 'public.barbershops', 'financial_timezone', 'select') as anon_timezone_read_denied,
  has_column_privilege('anon', 'public.barbershops', 'name', 'select') as public_name_read_preserved,
  has_function_privilege('authenticated', 'public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text)', 'execute') as authenticated_onboarding_allowed,
  not exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = 'create_owner_barbershop'
      and grantee = 'PUBLIC' and privilege_type = 'EXECUTE'
  ) as public_onboarding_denied;
