-- Review-only SQL. Apply manually in the Supabase SQL Editor after review.
-- This script does not replace or weaken RLS and does not grant public access.

-- =============================================================================
-- 1. Preflight: violation queries must return zero rows.
-- =============================================================================

-- Cross-tenant and orphan references.
select a.id, a.barbershop_id, a.barber_id, b.barbershop_id as barber_barbershop_id
from public.appointments as a
left join public.barbers as b on b.id = a.barber_id
where a.barber_id is not null
  and (
    b.id is null
    or b.barbershop_id is distinct from a.barbershop_id
  );

select a.id, a.barbershop_id, a.service_id, s.barbershop_id as service_barbershop_id
from public.appointments as a
left join public.services as s on s.id = a.service_id
where a.service_id is not null
  and (
    s.id is null
    or s.barbershop_id is distinct from a.barbershop_id
  );

select p.id, p.barbershop_id, p.barber_id, b.barbershop_id as barber_barbershop_id
from public.profiles as p
left join public.barbers as b on b.id = p.barber_id
where p.barber_id is not null
  and (
    b.id is null
    or b.barbershop_id is distinct from p.barbershop_id
  );

select 'barbers' as source, b.id, b.barbershop_id
from public.barbers as b
left join public.barbershops as bs on bs.id = b.barbershop_id
where bs.id is null
union all
select 'services', s.id, s.barbershop_id
from public.services as s
left join public.barbershops as bs on bs.id = s.barbershop_id
where bs.id is null
union all
select 'appointments', a.id, a.barbershop_id
from public.appointments as a
left join public.barbershops as bs on bs.id = a.barbershop_id
where bs.id is null
union all
select 'profiles', p.id, p.barbershop_id
from public.profiles as p
left join public.barbershops as bs on bs.id = p.barbershop_id
where bs.id is null;

-- Invalid values supported by the current schema and application domain.
select id, price, duration_minutes, commission_rate
from public.services
where price < 0
   or duration_minutes <= 0
   or (commission_rate is not null and commission_rate not between 0 and 100);

select id, service_value, commission_rate, start_at, end_at, status
from public.appointments
where service_value < 0
   or (commission_rate is not null and commission_rate not between 0 and 100)
   or end_at <= start_at
   or status not in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');

-- A primary key on id should make these empty; keep them as rollout evidence.
select id, barbershop_id, count(*)
from public.barbers
group by id, barbershop_id
having count(*) > 1;

select id, barbershop_id, count(*)
from public.services
group by id, barbershop_id
having count(*) > 1;

-- This inventory is informational and is expected to return existing definitions.
select c.conrelid::regclass as table_name, c.conname, c.contype, c.convalidated,
       pg_get_constraintdef(c.oid) as definition
from pg_constraint as c
where c.connamespace = 'public'::regnamespace
  and c.conrelid in (
    'public.barbers'::regclass,
    'public.services'::regclass,
    'public.appointments'::regclass,
    'public.profiles'::regclass
  )
order by c.conrelid::regclass::text, c.conname;

-- =============================================================================
-- 2. Unique indexes required as composite foreign-key targets.
-- Run outside an explicit transaction. Stop if any preflight query returned rows.
-- =============================================================================

select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'barbers_id_barbershop_id_key',
    'services_id_barbershop_id_key'
  )
order by tablename, indexname;

-- If an index with either name has an incompatible definition, stop the rollout
-- and review it before running CREATE INDEX IF NOT EXISTS.
create unique index concurrently if not exists barbers_id_barbershop_id_key
  on public.barbers (id, barbershop_id);

create unique index concurrently if not exists services_id_barbershop_id_key
  on public.services (id, barbershop_id);

do $block$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.barbers'::regclass
      and conname = 'barbers_id_barbershop_id_key'
  ) then
    alter table public.barbers
      add constraint barbers_id_barbershop_id_key
      unique using index barbers_id_barbershop_id_key;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.services'::regclass
      and conname = 'services_id_barbershop_id_key'
  ) then
    alter table public.services
      add constraint services_id_barbershop_id_key
      unique using index services_id_barbershop_id_key;
  end if;
end
$block$;

-- =============================================================================
-- 3. Composite foreign keys for tenant consistency.
-- =============================================================================

do $block$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.appointments'::regclass and conname = 'appointments_barber_tenant_fkey') then
    alter table public.appointments add constraint appointments_barber_tenant_fkey
      foreign key (barber_id, barbershop_id)
      references public.barbers (id, barbershop_id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.appointments'::regclass and conname = 'appointments_service_tenant_fkey') then
    alter table public.appointments add constraint appointments_service_tenant_fkey
      foreign key (service_id, barbershop_id)
      references public.services (id, barbershop_id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_barber_tenant_fkey') then
    alter table public.profiles add constraint profiles_barber_tenant_fkey
      foreign key (barber_id, barbershop_id)
      references public.barbers (id, barbershop_id) not valid;
  end if;
end
$block$;

alter table public.appointments validate constraint appointments_barber_tenant_fkey;
alter table public.appointments validate constraint appointments_service_tenant_fkey;
alter table public.profiles validate constraint profiles_barber_tenant_fkey;

-- =============================================================================
-- 4. Final validation. All listed constraints should be validated.
-- =============================================================================

select c.conrelid::regclass as table_name, c.conname, c.convalidated,
       pg_get_constraintdef(c.oid) as definition
from pg_constraint as c
where c.connamespace = 'public'::regnamespace
  and c.conname in (
    'barbers_id_barbershop_id_key',
    'services_id_barbershop_id_key',
    'appointments_barber_tenant_fkey',
    'appointments_service_tenant_fkey',
    'profiles_barber_tenant_fkey'
  )
order by c.conrelid::regclass::text, c.conname;

-- Re-run every query in section 1 after validation.

-- =============================================================================
-- 5. Rollback (manual, run only when explicitly approved; no CASCADE).
-- =============================================================================
/*
alter table public.profiles drop constraint if exists profiles_barber_tenant_fkey;
alter table public.appointments drop constraint if exists appointments_service_tenant_fkey;
alter table public.appointments drop constraint if exists appointments_barber_tenant_fkey;

alter table public.services drop constraint if exists services_id_barbershop_id_key;
alter table public.barbers drop constraint if exists barbers_id_barbershop_id_key;
*/
