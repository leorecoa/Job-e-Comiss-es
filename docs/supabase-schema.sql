-- Job e Comissoes - Supabase Scheduling MVP schema
-- Run this SQL in the Supabase SQL editor.

create extension if not exists pgcrypto;

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
  role text not null default 'owner' check (role in ('owner', 'barber')),
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
$$ language plpgsql;

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

create or replace view public_appointment_slots as
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

drop policy if exists "services_public_read_active" on services;
create policy "services_public_read_active"
on services for select
using (active = true);

drop policy if exists "appointments_authenticated_read" on appointments;
create policy "appointments_authenticated_read"
on appointments for select
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
      and profiles.role in ('owner', 'barber')
  )
);

drop policy if exists "appointments_authenticated_update" on appointments;
create policy "appointments_authenticated_update"
on appointments for update
using (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
      and profiles.role in ('owner', 'barber')
  )
)
with check (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
      and profiles.role in ('owner', 'barber')
  )
);

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
