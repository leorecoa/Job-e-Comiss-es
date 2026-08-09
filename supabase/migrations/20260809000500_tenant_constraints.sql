alter table public.appointments
  add constraint appointments_client_name_length check (char_length(client_name) >= 2 and char_length(client_name) <= 80),
  add constraint appointments_client_phone_length check (char_length(client_phone) >= 8 and char_length(client_phone) <= 20),
  add constraint appointments_commission_rate_valid check (commission_rate is null or commission_rate >= 0 and commission_rate <= 100),
  add constraint appointments_notes_length check (notes is null or char_length(notes) <= 500),
  add constraint appointments_service_value_non_negative check (service_value >= 0),
  add constraint appointments_status_check check (status = any (array['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'])),
  add constraint appointments_time_valid check (end_at > start_at);

alter table public.barbershops
  add constraint barbershops_cover_image_url_https check (cover_image_url is null or cover_image_url ~ '^https://'),
  add constraint barbershops_instagram_url_safe check (instagram_url is null or instagram_url ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._]+/?$'),
  add constraint barbershops_logo_url_https check (logo_url is null or logo_url ~ '^https://'),
  add constraint barbershops_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint valid_primary_color check (primary_color is null or primary_color ~ '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'),
  add constraint valid_secondary_color check (secondary_color is null or secondary_color ~ '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'),
  add constraint valid_whatsapp check (whatsapp is null or whatsapp = '' or whatsapp ~ '^\+?[0-9\s().-]{10,20}$'),
  add constraint barbershops_slug_key unique (slug);

alter table public.profiles
  add constraint profiles_role_check check (role = any (array['owner', 'barber']));

alter table public.services
  add constraint services_commission_rate_valid check (commission_rate is null or commission_rate >= 0 and commission_rate <= 100),
  add constraint services_duration_valid check (duration_minutes > 0 and duration_minutes <= 480),
  add constraint services_price_non_negative check (price >= 0);

-- These UNIQUE constraints must precede the tenant-scoped foreign keys.
alter table public.barbers add constraint barbers_id_barbershop_id_key unique (id, barbershop_id);
alter table public.services add constraint services_id_barbershop_id_key unique (id, barbershop_id);

alter table public.appointments
  add constraint appointments_no_overlap exclude using gist (
    barber_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status = any (array['scheduled', 'confirmed'])),
  add constraint appointments_barber_id_fkey foreign key (barber_id) references public.barbers(id) on delete restrict,
  add constraint appointments_barber_tenant_fkey foreign key (barber_id, barbershop_id) references public.barbers(id, barbershop_id) on delete restrict,
  add constraint appointments_barbershop_id_fkey foreign key (barbershop_id) references public.barbershops(id) on delete restrict,
  add constraint appointments_service_id_fkey foreign key (service_id) references public.services(id) on delete restrict,
  add constraint appointments_service_tenant_fkey foreign key (service_id, barbershop_id) references public.services(id, barbershop_id) on delete restrict;

alter table public.barbers
  add constraint barbers_barbershop_id_fkey foreign key (barbershop_id) references public.barbershops(id) on delete restrict;

alter table public.profiles
  add constraint profiles_barber_id_fkey foreign key (barber_id) references public.barbers(id),
  add constraint profiles_barber_tenant_fkey foreign key (barber_id, barbershop_id) references public.barbers(id, barbershop_id),
  add constraint profiles_barbershop_id_fkey foreign key (barbershop_id) references public.barbershops(id) on delete restrict,
  add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;

alter table public.services
  add constraint services_barbershop_id_fkey foreign key (barbershop_id) references public.barbershops(id) on delete restrict;

create index appointments_barber_start_idx on public.appointments using btree (barber_id, start_at);
create index appointments_start_at_idx on public.appointments using btree (start_at);
create index appointments_status_idx on public.appointments using btree (status);
create unique index appointments_unique_active_barbershop_barber_start
  on public.appointments using btree (barbershop_id, barber_id, start_at)
  where status = any (array['scheduled', 'confirmed', 'completed']);
create index idx_appointments_barber_start on public.appointments using btree (barber_id, start_at);
create index idx_appointments_barbershop_start on public.appointments using btree (barbershop_id, start_at);
create index idx_appointments_barbershop_status_start on public.appointments using btree (barbershop_id, status, start_at);
create index idx_barbers_barbershop_active on public.barbers using btree (barbershop_id, active);
create index idx_profiles_barber_id on public.profiles using btree (barber_id);
create index idx_profiles_barbershop_role_active on public.profiles using btree (barbershop_id, role, active);
create index idx_services_barbershop_active on public.services using btree (barbershop_id, active);
create index profiles_active_idx on public.profiles using btree (active);
create index profiles_role_idx on public.profiles using btree (role);
create unique index services_unique_barbershop_name_ci
  on public.services using btree (barbershop_id, lower(trim(both from name)));
