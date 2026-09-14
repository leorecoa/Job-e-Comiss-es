-- Review-only for remote rollout: apply manually before deploying the new client.
-- No default/backfill. Booking, agenda and financial timestamps are unchanged.
alter table public.barbershops add column operational_timezone text;

create function private.validate_barbershop_operational_timezone()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.operational_timezone is not null and (
    new.operational_timezone ~ '^(posix|right)/'
    or not exists (
      select 1 from pg_catalog.pg_timezone_names as tz
      where tz.name = new.operational_timezone
    )
  ) then
    raise exception using errcode = '22023', message = 'INVALID_OPERATIONAL_TIMEZONE';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_barbershop_operational_timezone()
  from public, anon, authenticated, service_role;

create trigger validate_barbershop_operational_timezone
before insert or update of operational_timezone on public.barbershops
for each row execute function private.validate_barbershop_operational_timezone();

-- Required arguments preserve unambiguous resolution of existing 8/9-argument overloads.
create function public.create_owner_barbershop(
  p_name text, p_slug text, p_phone text, p_address text, p_whatsapp text,
  p_description text, p_business_hours jsonb, p_slot_step_minutes integer,
  p_financial_timezone text, p_operational_timezone text
)
returns setof public.barbershops
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_barbershop_id uuid;
begin
  if p_financial_timezone is null then
    select created.id into v_barbershop_id
    from public.create_owner_barbershop(
      p_name, p_slug, p_phone, p_address, p_whatsapp, p_description,
      p_business_hours, p_slot_step_minutes
    ) as created;
  else
    select created.id into v_barbershop_id
    from public.create_owner_barbershop(
      p_name, p_slug, p_phone, p_address, p_whatsapp, p_description,
      p_business_hours, p_slot_step_minutes, p_financial_timezone
    ) as created;
  end if;

  return query
  update public.barbershops as b
    set operational_timezone = p_operational_timezone
    where b.id = v_barbershop_id
    returning b.*;
end;
$$;

revoke all on function public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text,text)
  to authenticated;

comment on column public.barbershops.operational_timezone is
  'Owner-confirmed operational IANA timezone; NULL is unconfigured. Stored only, not consumed by booking or agenda yet.';

-- Existing column-level anon grants intentionally exclude this new setting.
-- Validate with operational_timezone_test.sql and the full local pgTAP suite.
-- Rollback: revert the client first; preserve the nullable column and saved values.
select
  not has_column_privilege('anon', 'public.barbershops', 'operational_timezone', 'select') as anon_read_denied,
  not has_column_privilege('anon', 'public.barbershops', 'operational_timezone', 'update') as anon_update_denied,
  has_function_privilege('authenticated', 'public.create_owner_barbershop(text,text,text,text,text,text,jsonb,integer,text,text)', 'execute') as onboarding_allowed;
