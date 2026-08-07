-- Job e Comissoes - Controlled public appointment creation RPC
-- Review-only SQL. Apply manually in phases; never run automatically from the app.
-- This function does not grant SELECT on public.appointments or disable RLS.

-- =============================================================================
-- 1. Preflight (read-only)
-- =============================================================================

select c.relrowsecurity
from pg_catalog.pg_class as c
where c.oid = 'public.appointments'::regclass;

select policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename = 'appointments'
order by policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'appointments'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- Confirm the tenant entities and active-slot guard exist before rollout.
select c.conname, c.convalidated, pg_catalog.pg_get_constraintdef(c.oid) as definition
from pg_catalog.pg_constraint as c
where c.conrelid in ('public.barbers'::regclass, 'public.services'::regclass, 'public.appointments'::regclass)
order by c.conrelid::regclass::text, c.conname;

select schemaname, tablename, indexname, indexdef
from pg_catalog.pg_indexes
where schemaname = 'public'
  and indexname = 'appointments_unique_active_barbershop_barber_start';

-- =============================================================================
-- 2. Create RPC and grant EXECUTE before deploying the frontend
-- =============================================================================

begin;

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
set search_path = pg_catalog
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
  v_notes text := pg_catalog.nullif(pg_catalog.btrim(p_notes), '');
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
    )
    returning id into v_appointment_id;
  exception
    when unique_violation or exclusion_violation then
      raise exception using errcode = 'P0001', message = 'PUBLIC_APPOINTMENT_SLOT_CONFLICT';
  end;

  return v_appointment_id;
end
$function$;

revoke all on function public.create_public_appointment(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) from public;
revoke all on function public.create_public_appointment(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) from anon;
revoke all on function public.create_public_appointment(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) from authenticated;
grant execute on function public.create_public_appointment(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;

-- =============================================================================
-- 3. Finalize only after the RPC frontend is deployed and validated
-- =============================================================================

begin;
drop policy if exists "appointments_public_insert_scheduled" on public.appointments;
revoke insert on public.appointments from anon;
notify pgrst, 'reload schema';
commit;

-- =============================================================================
-- 4. Final validation
-- =============================================================================

select p.proname, p.prosecdef, p.proconfig, pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments
from pg_catalog.pg_proc as p
where p.oid = 'public.create_public_appointment(uuid,uuid,uuid,text,text,timestamptz,timestamptz,text)'::regprocedure;

select policyname, roles, cmd
from pg_catalog.pg_policies
where schemaname = 'public' and tablename = 'appointments'
order by policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'appointments'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- =============================================================================
-- 5. Rollback (manual; use only after explicit review)
-- =============================================================================
/*
-- Restore the reviewed public INSERT policy from docs/supabase-tenant-rls-plan.sql
-- before removing the RPC if rolling the frontend back to direct INSERT.
grant insert on public.appointments to anon;

revoke all on function public.create_public_appointment(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text) from anon, authenticated;
drop function if exists public.create_public_appointment(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text);
notify pgrst, 'reload schema';
*/
