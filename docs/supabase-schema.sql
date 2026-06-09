-- Job e Comissoes - Supabase Scheduling MVP schema
-- Run this SQL in the Supabase SQL editor.

-- Create internal schema for RLS helpers
create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

grant usage on schema private to authenticated;

-- Helper to get role of current authenticated active user.
create or replace function private.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and active = true
  limit 1;
$$;

revoke all on function private.current_user_role() from public;
revoke all on function private.current_user_role() from anon;
revoke all on function private.current_user_role() from authenticated;

grant execute on function private.current_user_role() to authenticated;

create table if not exists barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null default 0,
  duration_minutes integer not null default 30,
  commission_rate numeric(5,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_phone text not null,
  barber_id uuid references barbers(id) on delete restrict,
  barber_name text not null,
  service_id uuid references services(id) on delete restrict,
  service_type text not null,
  service_value numeric(10,2) not null default 0,
  commission_rate numeric(5,2),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null check (status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes text,
  financial_record_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'barber' check (role in ('owner', 'barber')),
  barber_id uuid references barbers(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_barber_start_idx on appointments (barber_id, start_at);
create index if not exists appointments_status_idx on appointments (status);
create index if not exists appointments_start_at_idx on appointments (start_at);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists barbers_set_updated_at on barbers;
create trigger barbers_set_updated_at
before update on barbers
for each row execute function set_updated_at();

drop trigger if exists services_set_updated_at on services;
create trigger services_set_updated_at
before update on services
for each row execute function set_updated_at();

drop trigger if exists appointments_set_updated_at on appointments;
create trigger appointments_set_updated_at
before update on appointments
for each row execute function set_updated_at();

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
before update on profiles
for each row execute function set_updated_at();

-- MVP conflict protection remains in the app repository for now.
-- Next step: add a database-level exclusion constraint using tstzrange + gist
-- after confirming the desired cancelled/no-show behavior and required extensions.

create or replace view public_appointment_slots 
with (security_invoker = true)
as
select
  barber_id,
  barber_name,
  start_at,
  end_at,
  status
from appointments
where status <> 'cancelled';

-- Initial RLS policies for the MVP.
-- These policies are intentionally simple and should be hardened further
-- before production multi-tenant usage.

alter table profiles enable row level security;
alter table barbers enable row level security;
alter table services enable row level security;
alter table appointments enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own"
on profiles for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own"
on profiles for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own"
on profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "barbers_public_read_active" on barbers;
create policy "barbers_public_read_active"
on barbers for select
using (active = true);

drop policy if exists "barbers_owner_all" on barbers;
create policy "barbers_owner_all"
on barbers for all
using (private.current_user_role() = 'owner');

drop policy if exists "services_public_read_active" on services;
create policy "services_public_read_active"
on services for select
using (active = true);

drop policy if exists "services_owner_all" on services;
create policy "services_owner_all"
on services for all
using (private.current_user_role() = 'owner');

drop policy if exists "appointments_authenticated_read" on appointments;
create policy "appointments_authenticated_read"
on appointments for select
using (private.current_user_role() in ('owner', 'barber'));

drop policy if exists "appointments_authenticated_update" on appointments;
create policy "appointments_authenticated_update"
on appointments for update
using (private.current_user_role() in ('owner', 'barber'))
with check (private.current_user_role() in ('owner', 'barber'));

drop policy if exists "appointments_authenticated_insert" on appointments;
create policy "appointments_authenticated_insert"
on appointments for insert
with check (private.current_user_role() in ('owner', 'barber'));

drop policy if exists "appointments_public_insert_scheduled" on appointments;
create policy "appointments_public_insert_scheduled"
on appointments for insert
with check (status = 'scheduled');

-- Privacy note:
-- Public booking needs slot availability without exposing client names/phones.
-- Prefer querying public_appointment_slots for public availability once Supabase
-- policies are fully hardened. The current frontend repository still uses the
-- full appointments table, so production should add an RPC/view-specific
-- repository before exposing a real public link.

-- Future production hardening (roadmap):
-- - financial_records
-- - commission snapshots stored in appointments.commission_rate
-- - barbershop_id / multi-tenant
-- - database-level appointment conflict protection
-- - schedule blocks / unavailable slots
-- - RPC or Edge Function for public booking
