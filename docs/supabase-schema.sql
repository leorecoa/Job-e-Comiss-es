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

-- RLS notes:
-- This MVP can run with RLS disabled for local/demo projects.
-- For production, enable RLS and create policies carefully.
-- Recommended next step:
-- 1. Allow public reads only from public_appointment_slots.
-- 2. Allow public appointment inserts with limited fields.
-- 3. Protect full appointment rows behind Supabase Auth and owner/barber roles.
