-- Schema expansion only. Remote application is manual after review.
-- Validate locally: supabase migration up --local; supabase test db --local.
-- No current booking/appointment consumer is changed.
alter table public.barbers
  add column availability_mode text not null default 'inherit',
  add constraint barbers_availability_mode_valid check (availability_mode in ('inherit', 'custom'));

comment on column public.barbers.availability_mode is
  'Future availability source: inherit global hours or custom individual intervals. Not consumed yet.';

create table public.barber_working_hours (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete restrict,
  barber_id uuid not null,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  constraint barber_working_hours_time_valid check (start_time < end_time),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint barber_working_hours_barber_tenant_fkey
    foreign key (barber_id, barbershop_id)
    references public.barbers(id, barbershop_id) on delete restrict
);

create trigger barber_working_hours_set_updated_at before update on public.barber_working_hours
for each row execute function public.set_updated_at();

alter table public.barber_working_hours enable row level security;

-- Neutralize default privileges; role-specific authority is enforced by RLS.
revoke all on public.barber_working_hours from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.barber_working_hours to authenticated;
grant all on public.barber_working_hours to service_role;

create policy barber_working_hours_owner_all on public.barber_working_hours
for all to authenticated
using (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id())
with check (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id());

create policy barber_working_hours_barber_read_own on public.barber_working_hours
for select to authenticated
using (
  private.current_user_role() = 'barber'
  and barbershop_id = private.current_user_barbershop_id()
  and barber_id = private.current_user_barber_id()
);

create table public.barber_time_off (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete restrict,
  barber_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  constraint barber_time_off_time_valid check (starts_at < ends_at),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint barber_time_off_barber_tenant_fkey
    foreign key (barber_id, barbershop_id)
    references public.barbers(id, barbershop_id) on delete restrict
);

create trigger barber_time_off_set_updated_at before update on public.barber_time_off
for each row execute function public.set_updated_at();

alter table public.barber_time_off enable row level security;

-- Neutralize default privileges; role-specific authority is enforced by RLS.
revoke all on public.barber_time_off from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.barber_time_off to authenticated;
grant all on public.barber_time_off to service_role;

create policy barber_time_off_owner_all on public.barber_time_off
for all to authenticated
using (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id())
with check (private.current_user_role() = 'owner' and barbershop_id = private.current_user_barbershop_id());

create policy barber_time_off_barber_read_own on public.barber_time_off
for select to authenticated
using (
  private.current_user_role() = 'barber'
  and barbershop_id = private.current_user_barbershop_id()
  and barber_id = private.current_user_barber_id()
);

comment on column public.barber_working_hours.weekday is
  '0=Sunday through 6=Saturday, matching scheduling.ts. Multiple intervals per day; no overnight intervals.';
comment on table public.barber_time_off is
  'Absolute [starts_at, ends_at) intervals. Overlaps allowed. Future operational-timezone layer converts whole days; never assume 24 hours.';

-- Tenant-first indexes support scoped lists; barber-first indexes also support
-- composite FK maintenance and future weekday/interval queries. No exclusion/GiST.
create index barber_working_hours_tenant_idx on public.barber_working_hours (barbershop_id);
create index barber_working_hours_barber_weekday_idx on public.barber_working_hours (barber_id, weekday);
create index barber_time_off_tenant_idx on public.barber_time_off (barbershop_id);
create index barber_time_off_barber_starts_idx on public.barber_time_off (barber_id, starts_at);
-- ends_at remains a residual filter until a real interval query plan justifies another index.

-- Rollout is additive: existing barbers inherit, new tables start empty.
-- Rollback should retain schema/data until consumers are reviewed; no automatic destructive rollback.
