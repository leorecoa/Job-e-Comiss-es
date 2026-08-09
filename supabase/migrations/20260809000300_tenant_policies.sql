alter table public.appointments enable row level security;
alter table public.barbers enable row level security;
alter table public.barbershops enable row level security;
alter table public.profiles enable row level security;
alter table public.services enable row level security;

create policy appointments_barber_insert_own on public.appointments for insert to authenticated
with check (private.current_user_role() = 'barber' and barbershop_id = private.current_user_barbershop_id() and barber_id = private.current_user_barber_id() and (service_id is null or exists (select 1 from public.services s where s.id = appointments.service_id and s.barbershop_id = appointments.barbershop_id and s.active = true)));
create policy appointments_barber_read_own on public.appointments for select to authenticated
using (private.current_user_role() = 'barber' and barbershop_id = private.current_user_barbershop_id() and barber_id = private.current_user_barber_id());
create policy appointments_barber_update_own on public.appointments for update to authenticated
using (private.current_user_role() = 'barber' and barbershop_id = private.current_user_barbershop_id() and barber_id = private.current_user_barber_id())
with check (private.current_user_role() = 'barber' and barbershop_id = private.current_user_barbershop_id() and barber_id = private.current_user_barber_id() and (service_id is null or exists (select 1 from public.services s where s.id = appointments.service_id and s.barbershop_id = appointments.barbershop_id and s.active = true)));
create policy appointments_owner_delete_own_barbershop on public.appointments for delete to authenticated
using (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id());
create policy appointments_owner_insert_own_barbershop on public.appointments for insert to authenticated
with check (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id() and (barber_id is null or exists (select 1 from public.barbers br where br.id = appointments.barber_id and br.barbershop_id = appointments.barbershop_id and br.active = true)) and (service_id is null or exists (select 1 from public.services s where s.id = appointments.service_id and s.barbershop_id = appointments.barbershop_id and s.active = true)));
create policy appointments_owner_read_own_barbershop on public.appointments for select to authenticated
using (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id());
create policy appointments_owner_update_own_barbershop on public.appointments for update to authenticated
using (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id())
with check (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id() and (barber_id is null or exists (select 1 from public.barbers br where br.id = appointments.barber_id and br.barbershop_id = appointments.barbershop_id and br.active = true)) and (service_id is null or exists (select 1 from public.services s where s.id = appointments.service_id and s.barbershop_id = appointments.barbershop_id and s.active = true)));

create policy barbers_authenticated_read_own_barbershop on public.barbers for select to authenticated
using (barbershop_id = private.current_user_barbershop_id());
create policy barbers_owner_delete_own_barbershop on public.barbers for delete to authenticated
using (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id());
create policy barbers_owner_insert_own_barbershop on public.barbers for insert to authenticated
with check (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id());
create policy barbers_owner_update_own_barbershop on public.barbers for update to authenticated
using (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id())
with check (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id());
create policy barbers_public_read_active on public.barbers for select to anon
using (active = true and exists (select 1 from public.barbershops bs where bs.id = barbers.barbershop_id and bs.active = true));

create policy barbershops_authenticated_insert on public.barbershops for insert to authenticated with check (active = true);
create policy barbershops_authenticated_read_own on public.barbershops for select to authenticated using (id = private.current_user_barbershop_id());
create policy barbershops_owner_update_own on public.barbershops for update to authenticated
using (id = private.current_user_barbershop_id() and private.current_user_role() = 'owner')
with check (id = private.current_user_barbershop_id() and private.current_user_role() = 'owner');
create policy barbershops_public_read_active on public.barbershops for select to anon using (active = true);

create policy profiles_insert_own on public.profiles for insert to authenticated
with check (id = auth.uid() and role = 'barber' and barbershop_id is not null and exists (select 1 from public.barbershops b where b.id = profiles.barbershop_id and b.active = true) and (barber_id is null or exists (select 1 from public.barbers br where br.id = profiles.barber_id and br.barbershop_id = profiles.barbershop_id and br.active = true)));
create policy profiles_onboarding_insert_owner on public.profiles for insert to authenticated
with check (id = auth.uid() and role = 'owner' and active = true and barbershop_id is not null);
create policy profiles_onboarding_update_self_owner on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid() and role = 'owner' and active = true and barbershop_id is not null);
create policy profiles_owner_delete_own_barbershop on public.profiles for delete to authenticated
using (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id());
create policy profiles_owner_insert_own_barbershop on public.profiles for insert to authenticated
with check (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id() and (barber_id is null or exists (select 1 from public.barbers br where br.id = profiles.barber_id and br.barbershop_id = profiles.barbershop_id and br.active = true)));
create policy profiles_owner_select_own_barbershop on public.profiles for select to authenticated
using (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id());
create policy profiles_owner_update_own_barbershop on public.profiles for update to authenticated
using (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id())
with check (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id() and (barber_id is null or exists (select 1 from public.barbers br where br.id = profiles.barber_id and br.barbershop_id = profiles.barbershop_id and br.active = true)));
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = 'barber' and barbershop_id = private.current_user_barbershop_id() and exists (select 1 from public.barbershops b where b.id = profiles.barbershop_id and b.active = true) and (barber_id is null or exists (select 1 from public.barbers br where br.id = profiles.barber_id and br.barbershop_id = profiles.barbershop_id and br.active = true)));

create policy services_authenticated_read_own_barbershop on public.services for select to authenticated using (barbershop_id = private.current_user_barbershop_id());
create policy services_owner_delete_own_barbershop on public.services for delete to authenticated using (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id());
create policy services_owner_insert_own_barbershop on public.services for insert to authenticated with check (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id());
create policy services_owner_update_own_barbershop on public.services for update to authenticated
using (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id())
with check (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id());
create policy services_public_read_active on public.services for select to anon
using (active = true and exists (select 1 from public.barbershops bs where bs.id = services.barbershop_id and bs.active = true));

grant usage on schema public to postgres, anon, authenticated, service_role;

-- Neutralize local default privileges before reproducing production grants.
revoke all on table public.appointments from anon, authenticated, service_role;
revoke all on table public.barbers from anon, authenticated, service_role;
revoke all on table public.barbershops from anon, authenticated, service_role;
revoke all on table public.profiles from anon, authenticated, service_role;
revoke all on table public.services from anon, authenticated, service_role;

grant all on table public.appointments to service_role;
grant select, insert, delete, update on table public.appointments to authenticated;
grant all on table public.barbers to service_role;
grant select on table public.barbers to anon;
grant select, insert, delete, update on table public.barbers to authenticated;
grant all on table public.barbershops to service_role;
grant select on table public.barbershops to anon;
grant select, insert, update on table public.barbershops to authenticated;
grant all on table public.profiles to anon, authenticated, service_role;
grant all on table public.services to service_role;
grant select on table public.services to anon;
grant select, insert, delete, update on table public.services to authenticated;
