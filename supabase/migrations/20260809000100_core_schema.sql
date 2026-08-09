create schema if not exists private;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create table public.barbershops (
  id uuid default gen_random_uuid() not null,
  name text not null,
  slug text not null,
  phone text,
  address text,
  active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  logo_url text,
  cover_image_url text,
  description text,
  instagram_url text,
  whatsapp text,
  primary_color text,
  secondary_color text,
  business_hours jsonb,
  slot_step_minutes integer,
  constraint barbershops_pkey primary key (id)
);

comment on column public.barbershops.business_hours is
  'Agenda operacional publica por dia da semana no formato JSON.';
comment on column public.barbershops.slot_step_minutes is
  'Intervalo em minutos entre horarios do booking publico.';

create table public.barbers (
  id uuid default gen_random_uuid() not null,
  name text not null,
  active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  barbershop_id uuid not null,
  constraint barbers_pkey primary key (id)
);

create table public.services (
  id uuid default gen_random_uuid() not null,
  name text not null,
  price numeric(10,2) default 0 not null,
  duration_minutes integer default 30 not null,
  commission_rate numeric(5,2),
  active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  barbershop_id uuid not null,
  constraint services_pkey primary key (id)
);

create table public.appointments (
  id uuid default gen_random_uuid() not null,
  client_name text not null,
  client_phone text not null,
  barber_id uuid not null,
  barber_name text not null,
  service_id uuid not null,
  service_type text not null,
  service_value numeric(10,2) default 0 not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text default 'scheduled' not null,
  notes text,
  financial_record_id text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  commission_rate numeric(5,2),
  barbershop_id uuid not null,
  constraint appointments_pkey primary key (id)
);

create table public.profiles (
  id uuid not null,
  display_name text,
  role text default 'barber' not null,
  active boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  barber_id uuid,
  barbershop_id uuid not null,
  constraint profiles_pkey primary key (id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger appointments_set_updated_at before update on public.appointments
for each row execute function public.set_updated_at();
create trigger barbers_set_updated_at before update on public.barbers
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger services_set_updated_at before update on public.services
for each row execute function public.set_updated_at();

grant all on function public.set_updated_at() to anon;
grant all on function public.set_updated_at() to authenticated;
grant all on function public.set_updated_at() to service_role;
