-- Migration Plan: Multi-Tenant Foundation
-- LEGACY NOTE:
-- This plan was created to backfill an existing single-tenant dataset into the
-- multi-tenant model. Do not use the seeded tenant below as a default tenant for
-- new SaaS environments. New barbershops should be created through owner
-- onboarding and configured with their own slug, catalog, and business hours.
-- Order of execution:
-- 1. Infrastructure: Create barbershops table.
-- 2. Seed: Create the initial default tenant.
-- 3. Schema Update: Add barbershop_id columns as nullable.
-- 4. Backfill: Map all existing data to the default tenant.
-- 5. Verification: Ensure no data is left behind.
-- 6. Enforcement: Turn on NOT NULL constraints for business tables.
-- 7. Helpers: Deploy multi-tenant database helpers.

-- SECTION 1: Infrastructure
-- Create the tenant table to store barbershop details
create table if not exists public.barbershops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  phone text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Audit trigger for updated_at
drop trigger if exists barbershops_set_updated_at on public.barbershops;
create trigger barbershops_set_updated_at
before update on public.barbershops
for each row execute function set_updated_at();


-- SECTION 2: Initial Tenant Seed
-- Create the default barbershop for existing data association
insert into public.barbershops (name, slug)
values ('Gestão Máxima', 'gestao-maxima')
on conflict (slug) do update 
set name = excluded.name;


-- SECTION 3: Structural Changes (Safe phase)
-- Add barbershop_id as nullable first to avoid breaking existing app code
alter table public.profiles add column if not exists barbershop_id uuid references public.barbershops(id) on delete restrict;
alter table public.barbers add column if not exists barbershop_id uuid references public.barbershops(id) on delete restrict;
alter table public.services add column if not exists barbershop_id uuid references public.barbershops(id) on delete restrict;
alter table public.appointments add column if not exists barbershop_id uuid references public.barbershops(id) on delete restrict;


-- SECTION 4: Data Backfill
-- Link all existing records to the 'gestao-maxima' tenant
do $$
declare
  v_barbershop_id uuid;
begin
  select id into v_barbershop_id from public.barbershops where slug = 'gestao-maxima';

  if v_barbershop_id is not null then
    update public.profiles set barbershop_id = v_barbershop_id where barbershop_id is null;
    update public.barbers set barbershop_id = v_barbershop_id where barbershop_id is null;
    update public.services set barbershop_id = v_barbershop_id where barbershop_id is null;
    update public.appointments set barbershop_id = v_barbershop_id where barbershop_id is null;
  end if;
end $$;


-- SECTION 5: Pre-enforcement Validation
-- Run this block and ensure all counts are 0 before proceeding to Section 6.
-- If any count is > 0, do not proceed.
/*
select 'profiles' as table_name, count(*) as missing_barbershop_id from public.profiles where barbershop_id is null
union all
select 'barbers', count(*) from public.barbers where barbershop_id is null
union all
select 'services', count(*) from public.services where barbershop_id is null
union all
select 'appointments', count(*) from public.appointments where barbershop_id is null;
*/


-- SECTION 6: Constraint Enforcement (Cleanup phase)
-- Only run these once Section 5 validation returns 0 for business tables.
-- alter table public.barbers alter column barbershop_id set not null;
-- alter table public.services alter column barbershop_id set not null;
-- alter table public.appointments alter column barbershop_id set not null;

-- Note: public.profiles.barbershop_id remains nullable for now until the 
-- sign-up flow is updated to handle tenant assignment.


-- SECTION 7: Helper Functions
-- Update or create helper to resolve the tenant ID for the current user
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
  limit 1;
$$;


-- SECTION 8: Future RLS Planning (Documentation)
-- After the frontend and repositories are updated to support barbershop filters, 
-- the following RLS hardening can be applied:

-- EXAMPLE (Do not run yet):
-- drop policy if exists "barbers_tenant_isolation" on public.barbers;
-- create policy "barbers_tenant_isolation" on public.barbers
--   for all to authenticated
--   using (barbershop_id = private.current_user_barbershop_id());

-- This will ensure that owners only see data from their own barbershop.
