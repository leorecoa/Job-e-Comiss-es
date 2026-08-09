-- Job e Comissoes - Supabase base schema reference
-- Review-only SQL. Apply manually in Supabase after reviewing the current docs.
--
-- Source-of-truth note:
-- - This file defines the base tables, helper functions, triggers and public
--   availability view expected by the app.
-- - It intentionally does not create broad MVP RLS policies.
-- - Tenant-aware RLS must be applied from docs/supabase-tenant-rls-plan.sql.
-- - The current public booking flow must read occupied slots through
--   public.get_public_appointment_slots(uuid), not the full public.appointments
--   table.
-- - Public appointment inserts must not request returned rows because
--   appointments contain client data.
--
-- Recommended manual order for a new Supabase project:
-- 1. docs/supabase-schema.sql
-- 2. docs/supabase-tenant-rls-plan.sql
-- 3. docs/public-appointment-availability-rpc.sql
-- 4. docs/appointments-active-slot-unique-index.sql
-- 5. docs/barber-profile-linking-rpc.sql

-- Create internal schema for RLS helpers.
create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

grant usage on schema private to authenticated;

-- Multi-tenant foundation: Barbershops (Tenants).
create table if not exists public.barbershops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
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
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.barbers (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete restrict,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete restrict,
  name text not null,
  price numeric(10,2) not null default 0,
  duration_minutes integer not null default 30,
  commission_rate numeric(5,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  barbershop_id uuid not null references public.barbershops(id) on delete restrict,
  client_phone text not null,
  barber_id uuid references public.barbers(id) on delete restrict,
  barber_name text not null,
  service_id uuid references public.services(id) on delete restrict,
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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'barber' check (role in ('owner', 'barber')),
  barbershop_id uuid not null references public.barbershops(id) on delete restrict,
  barber_id uuid references public.barbers(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- Helper to get barber_id of current authenticated active user.
create or replace function private.current_user_barber_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select barber_id
  from public.profiles
  where id = auth.uid()
    and active = true
  limit 1;
$$;

revoke all on function private.current_user_barber_id() from public;
revoke all on function private.current_user_barber_id() from anon;
revoke all on function private.current_user_barber_id() from authenticated;

grant execute on function private.current_user_barber_id() to authenticated;

-- Helper to get barbershop_id of current authenticated user.
create or replace function private.current_user_barbershop_id()
returns uuid
language sql
stable
security definer
set search_path = public, private
as $$
  select p.barbershop_id
  from public.profiles p
  where p.id = auth.uid()
    and p.active = true
  limit 1;
$$;

revoke all on function private.current_user_barbershop_id() from public;
revoke all on function private.current_user_barbershop_id() from anon;
revoke all on function private.current_user_barbershop_id() from authenticated;

grant execute on function private.current_user_barbershop_id() to authenticated;

create index if not exists appointments_barber_start_idx on public.appointments (barber_id, start_at);
create index if not exists appointments_status_idx on public.appointments (status);
create index if not exists appointments_start_at_idx on public.appointments (start_at);
create index if not exists appointments_barbershop_start_idx on public.appointments (barbershop_id, start_at);
create index if not exists barbers_barbershop_active_idx on public.barbers (barbershop_id, active);
create index if not exists services_barbershop_active_idx on public.services (barbershop_id, active);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists barbershops_set_updated_at on public.barbershops;
create trigger barbershops_set_updated_at
before update on public.barbershops
for each row execute function set_updated_at();

drop trigger if exists barbers_set_updated_at on public.barbers;
create trigger barbers_set_updated_at
before update on public.barbers
for each row execute function set_updated_at();

drop trigger if exists services_set_updated_at on public.services;
create trigger services_set_updated_at
before update on public.services
for each row execute function set_updated_at();

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function set_updated_at();

-- RLS is enabled here, but policies are intentionally not created in this
-- base schema file. Apply docs/supabase-tenant-rls-plan.sql next.
alter table public.barbershops enable row level security;
alter table public.profiles enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

notify pgrst, 'reload schema';
