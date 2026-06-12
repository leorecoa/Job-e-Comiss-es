-- Job e Comissoes - Planned tenant-aware RLS policies
-- Review-only script. Do not apply automatically.
--
-- Purpose:
-- - prepare multi-tenant RLS policies based on barbershop_id
-- - preserve current public booking behavior
-- - keep the temporary public appointment fallback trigger in place
--
-- Do not add NOT NULL changes here.
-- Do not drop public.set_default_appointment_barbershop_id().
-- Do not drop trigger set_default_appointment_barbershop_id.
--
-- Required helpers before applying this plan:
-- - private.current_user_role()
-- - private.current_user_barber_id()
-- - private.current_user_barbershop_id()
--
-- These helpers are documented in docs/supabase-schema.sql and must exist before
-- applying this policy plan.

begin;

alter table public.barbershops enable row level security;
alter table public.profiles enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

-- ---------------------------------------------------------------------------
-- Legacy policy cleanup
-- ---------------------------------------------------------------------------
-- Remove older broad policies that did not include barbershop_id checks.
-- Public booking policies that are still required are recreated below with
-- tenant-aware checks.

drop policy if exists "barbers_owner_all" on public.barbers;
drop policy if exists "barbers_owner_manage" on public.barbers;
drop policy if exists "barbers_public_read_active" on public.barbers;

drop policy if exists "services_owner_all" on public.services;
drop policy if exists "services_owner_manage" on public.services;
drop policy if exists "services_public_read_active" on public.services;

drop policy if exists "appointments_authenticated_read" on public.appointments;
drop policy if exists "appointments_authenticated_update" on public.appointments;
drop policy if exists "appointments_authenticated_insert" on public.appointments;
drop policy if exists "appointments_authenticated_delete" on public.appointments;
drop policy if exists "appointments_public_insert_scheduled" on public.appointments;

drop policy if exists "profiles_insert_own_as_barber" on public.profiles;
drop policy if exists "profiles_owner_manage" on public.profiles;
drop policy if exists "profiles_owner_read_all" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;

drop policy if exists "barbershops_authenticated_read_own" on public.barbershops;
drop policy if exists "barbershops_public_read_active" on public.barbershops;

-- ---------------------------------------------------------------------------
-- Barbershops
-- ---------------------------------------------------------------------------
-- Public booking can resolve active barbershops by slug.
-- Authenticated users can read only their own barbershop.

drop policy if exists "barbershops_public_read_active" on public.barbershops;
create policy "barbershops_public_read_active"
on public.barbershops
for select
to anon
using (active = true);

drop policy if exists "barbershops_authenticated_read_own" on public.barbershops;
create policy "barbershops_authenticated_read_own"
on public.barbershops
for select
to authenticated
using (
  id = private.current_user_barbershop_id()
);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
-- Users can read their own profile.
-- Owners can read and manage profiles within their own barbershop.
-- Barbers must not see profiles from other barbershops.

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_owner_select_own_barbershop" on public.profiles;
create policy "profiles_owner_select_own_barbershop"
on public.profiles
for select
to authenticated
using (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and role = 'barber'
  and barbershop_id is not null
  and exists (
    select 1
    from public.barbershops b
    where b.id = profiles.barbershop_id
      and b.active = true
  )
  and (
    barber_id is null
    or exists (
      select 1
      from public.barbers br
      where br.id = profiles.barber_id
        and br.barbershop_id = profiles.barbershop_id
        and br.active = true
    )
  )
);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = 'barber'
  and barbershop_id = private.current_user_barbershop_id()
  and exists (
    select 1
    from public.barbershops b
    where b.id = profiles.barbershop_id
      and b.active = true
  )
  and (
    barber_id is null
    or exists (
      select 1
      from public.barbers br
      where br.id = profiles.barber_id
        and br.barbershop_id = profiles.barbershop_id
        and br.active = true
    )
  )
);

drop policy if exists "profiles_owner_insert_own_barbershop" on public.profiles;
create policy "profiles_owner_insert_own_barbershop"
on public.profiles
for insert
to authenticated
with check (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
  and (
    barber_id is null
    or exists (
      select 1
      from public.barbers br
      where br.id = profiles.barber_id
        and br.barbershop_id = profiles.barbershop_id
        and br.active = true
    )
  )
);

drop policy if exists "profiles_owner_update_own_barbershop" on public.profiles;
create policy "profiles_owner_update_own_barbershop"
on public.profiles
for update
to authenticated
using (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
)
with check (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
  and (
    barber_id is null
    or exists (
      select 1
      from public.barbers br
      where br.id = profiles.barber_id
        and br.barbershop_id = profiles.barbershop_id
        and br.active = true
    )
  )
);

drop policy if exists "profiles_owner_delete_own_barbershop" on public.profiles;
create policy "profiles_owner_delete_own_barbershop"
on public.profiles
for delete
to authenticated
using (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
);

-- ---------------------------------------------------------------------------
-- Barbers
-- ---------------------------------------------------------------------------
-- Public booking may read active barbers so the booking page can list options.
-- The frontend/repository must select only non-sensitive columns.
-- Authenticated users read barbers from their own barbershop.
-- Only owners manage barbers.

drop policy if exists "barbers_public_read_active" on public.barbers;
create policy "barbers_public_read_active"
on public.barbers
for select
to anon
using (
  active = true
  and exists (
    select 1
    from public.barbershops b
    where b.id = barbers.barbershop_id
      and b.active = true
  )
);

drop policy if exists "barbers_authenticated_read_own_barbershop" on public.barbers;
create policy "barbers_authenticated_read_own_barbershop"
on public.barbers
for select
to authenticated
using (
  barbershop_id = private.current_user_barbershop_id()
);

drop policy if exists "barbers_owner_insert_own_barbershop" on public.barbers;
create policy "barbers_owner_insert_own_barbershop"
on public.barbers
for insert
to authenticated
with check (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
);

drop policy if exists "barbers_owner_update_own_barbershop" on public.barbers;
create policy "barbers_owner_update_own_barbershop"
on public.barbers
for update
to authenticated
using (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
)
with check (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
);

drop policy if exists "barbers_owner_delete_own_barbershop" on public.barbers;
create policy "barbers_owner_delete_own_barbershop"
on public.barbers
for delete
to authenticated
using (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
);

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------
-- Public booking may read active services for active barbershops.
-- Authenticated users read services from their own barbershop.
-- Only owners manage services.

drop policy if exists "services_public_read_active" on public.services;
create policy "services_public_read_active"
on public.services
for select
to anon
using (
  active = true
  and exists (
    select 1
    from public.barbershops b
    where b.id = services.barbershop_id
      and b.active = true
  )
);

drop policy if exists "services_authenticated_read_own_barbershop" on public.services;
create policy "services_authenticated_read_own_barbershop"
on public.services
for select
to authenticated
using (
  barbershop_id = private.current_user_barbershop_id()
);

drop policy if exists "services_owner_insert_own_barbershop" on public.services;
create policy "services_owner_insert_own_barbershop"
on public.services
for insert
to authenticated
with check (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
);

drop policy if exists "services_owner_update_own_barbershop" on public.services;
create policy "services_owner_update_own_barbershop"
on public.services
for update
to authenticated
using (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
)
with check (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
);

drop policy if exists "services_owner_delete_own_barbershop" on public.services;
create policy "services_owner_delete_own_barbershop"
on public.services
for delete
to authenticated
using (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
);

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------
-- Public booking can insert scheduled appointments only.
-- Public clients cannot read full appointment rows.
-- Owners can manage appointments in their own barbershop.
-- Barbers can read/insert/update appointments for their own barber_id and
-- barbershop only.
-- Deletes are owner-only.

drop policy if exists "appointments_public_insert_scheduled" on public.appointments;
create policy "appointments_public_insert_scheduled"
on public.appointments
for insert
to anon
with check (
  status = 'scheduled'
  and barbershop_id is not null
  and nullif(trim(client_name), '') is not null
  and nullif(trim(client_phone), '') is not null
  and nullif(trim(barber_name), '') is not null
  and nullif(trim(service_type), '') is not null
  and start_at is not null
  and end_at is not null
  and end_at > start_at
  and exists (
    select 1
    from public.barbershops b
    where b.id = appointments.barbershop_id
      and b.active = true
  )
  and (
    barber_id is null
    or exists (
      select 1
      from public.barbers br
      where br.id = appointments.barber_id
        and br.barbershop_id = appointments.barbershop_id
        and br.active = true
    )
  )
  and (
    service_id is null
    or exists (
      select 1
      from public.services s
      where s.id = appointments.service_id
        and s.barbershop_id = appointments.barbershop_id
        and s.active = true
    )
  )
);

drop policy if exists "appointments_owner_read_own_barbershop" on public.appointments;
create policy "appointments_owner_read_own_barbershop"
on public.appointments
for select
to authenticated
using (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
);

drop policy if exists "appointments_barber_read_own" on public.appointments;
create policy "appointments_barber_read_own"
on public.appointments
for select
to authenticated
using (
  private.current_user_role() = 'barber'
  and barbershop_id = private.current_user_barbershop_id()
  and barber_id = private.current_user_barber_id()
);

drop policy if exists "appointments_owner_insert_own_barbershop" on public.appointments;
create policy "appointments_owner_insert_own_barbershop"
on public.appointments
for insert
to authenticated
with check (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
  and (
    barber_id is null
    or exists (
      select 1
      from public.barbers br
      where br.id = appointments.barber_id
        and br.barbershop_id = appointments.barbershop_id
        and br.active = true
    )
  )
  and (
    service_id is null
    or exists (
      select 1
      from public.services s
      where s.id = appointments.service_id
        and s.barbershop_id = appointments.barbershop_id
        and s.active = true
    )
  )
);

drop policy if exists "appointments_barber_insert_own" on public.appointments;
create policy "appointments_barber_insert_own"
on public.appointments
for insert
to authenticated
with check (
  private.current_user_role() = 'barber'
  and barbershop_id = private.current_user_barbershop_id()
  and barber_id = private.current_user_barber_id()
  and (
    service_id is null
    or exists (
      select 1
      from public.services s
      where s.id = appointments.service_id
        and s.barbershop_id = appointments.barbershop_id
        and s.active = true
    )
  )
);

drop policy if exists "appointments_owner_update_own_barbershop" on public.appointments;
create policy "appointments_owner_update_own_barbershop"
on public.appointments
for update
to authenticated
using (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
)
with check (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
  and (
    barber_id is null
    or exists (
      select 1
      from public.barbers br
      where br.id = appointments.barber_id
        and br.barbershop_id = appointments.barbershop_id
        and br.active = true
    )
  )
  and (
    service_id is null
    or exists (
      select 1
      from public.services s
      where s.id = appointments.service_id
        and s.barbershop_id = appointments.barbershop_id
        and s.active = true
    )
  )
);

drop policy if exists "appointments_barber_update_own" on public.appointments;
create policy "appointments_barber_update_own"
on public.appointments
for update
to authenticated
using (
  private.current_user_role() = 'barber'
  and barbershop_id = private.current_user_barbershop_id()
  and barber_id = private.current_user_barber_id()
)
with check (
  private.current_user_role() = 'barber'
  and barbershop_id = private.current_user_barbershop_id()
  and barber_id = private.current_user_barber_id()
  and (
    service_id is null
    or exists (
      select 1
      from public.services s
      where s.id = appointments.service_id
        and s.barbershop_id = appointments.barbershop_id
        and s.active = true
    )
  )
);

drop policy if exists "appointments_owner_delete_own_barbershop" on public.appointments;
create policy "appointments_owner_delete_own_barbershop"
on public.appointments
for delete
to authenticated
using (
  private.current_user_role() = 'owner'
  and barbershop_id = private.current_user_barbershop_id()
);

commit;
