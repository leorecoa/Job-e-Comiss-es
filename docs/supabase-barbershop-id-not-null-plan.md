# Supabase Barbershop ID NOT NULL Plan

## Status

This document is a plan for applying `NOT NULL` to `barbershop_id` in the main Supabase tenant tables.

It is documentation only. Do not execute this file as a migration without a separate manual review and controlled application window.

This plan has since been applied manually in Supabase and validated in production. See `docs/supabase-barbershop-id-not-null-applied.md`.

## Objective

Make tenant ownership mandatory at the database schema level for the core tenant-scoped tables.

The goal is to prevent new or updated rows from existing without a `barbershop_id` after the project has already validated tenant-aware behavior through RLS, repository logic, and production public booking flows.

## Preconditions

Confirm all of these before applying the planned SQL:

- Tenant-aware RLS is applied and validated.
- Isolation with a second fake barbershop is validated.
- Public booking by slug is validated.
- Invalid public booking slugs remain blocked.
- Public appointments now require `barbershop_id`, `barber_id`, and `service_id`.
- Diagnostic counts for `barbershop_id is null` returned `0` for:
  - `profiles`
  - `barbers`
  - `services`
  - `appointments`

Reference records:

- `docs/supabase-tenant-rls-applied.md`
- `docs/supabase-tenant-isolation-validation.md`
- `docs/public-appointment-entity-id-hardening.md`

## Pre-Application Diagnostics

Run this immediately before applying `NOT NULL`.

Expected result: every count must be `0`.

```sql
select
  'profiles' as table_name,
  count(*) as missing_barbershop_id
from public.profiles
where barbershop_id is null
union all
select
  'barbers' as table_name,
  count(*) as missing_barbershop_id
from public.barbers
where barbershop_id is null
union all
select
  'services' as table_name,
  count(*) as missing_barbershop_id
from public.services
where barbershop_id is null
union all
select
  'appointments' as table_name,
  count(*) as missing_barbershop_id
from public.appointments
where barbershop_id is null
order by table_name;
```

If any count is greater than `0`, stop and backfill the missing rows before applying `NOT NULL`.

## Planned SQL

Apply only after the diagnostics return `0` for every table.

```sql
alter table public.profiles
alter column barbershop_id set not null;

alter table public.barbers
alter column barbershop_id set not null;

alter table public.services
alter column barbershop_id set not null;

alter table public.appointments
alter column barbershop_id set not null;

notify pgrst, 'reload schema';
```

## Rollback SQL

If application causes an unexpected production issue, rollback the schema constraint only.

Do not rollback tenant-aware RLS as part of this rollback unless a separate investigation proves RLS is the issue.

```sql
alter table public.profiles
alter column barbershop_id drop not null;

alter table public.barbers
alter column barbershop_id drop not null;

alter table public.services
alter column barbershop_id drop not null;

alter table public.appointments
alter column barbershop_id drop not null;

notify pgrst, 'reload schema';
```

## Post-Application Validation

After applying `NOT NULL`, validate the database and app flows.

### Database checks

Confirm the columns are marked non-null:

```sql
select
  table_name,
  column_name,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'barbers', 'services', 'appointments')
  and column_name = 'barbershop_id'
order by table_name;
```

Expected result:

```txt
is_nullable = NO
```

Confirm there are still no null values:

```sql
select
  'profiles' as table_name,
  count(*) as missing_barbershop_id
from public.profiles
where barbershop_id is null
union all
select
  'barbers' as table_name,
  count(*) as missing_barbershop_id
from public.barbers
where barbershop_id is null
union all
select
  'services' as table_name,
  count(*) as missing_barbershop_id
from public.services
where barbershop_id is null
union all
select
  'appointments' as table_name,
  count(*) as missing_barbershop_id
from public.appointments
where barbershop_id is null
order by table_name;
```

### Application checks

Validate these production flows:

- `/book`
- `/book/gestao-maxima`
- `/book/barbearia-fake-rls`
- `/book/barbearia-inexistente`
- public appointment creation with `barbershop_id`, `barber_id`, and `service_id`
- owner login
- barber login
- owner dashboard reads tenant appointments only
- barber dashboard reads own tenant appointments only

### Local repository checks

Run:

```bash
npm run validate
npm run check
```

## Not Included In This Step

This plan does not include:

- removing the temporary trigger `set_default_appointment_barbershop_id`
- creating a real second production barbershop
- changing commission rules
- changing schedule rules
- changing dashboard behavior
- changing PDF/CSV behavior
- changing public booking business rules

## Recommended Next Steps

1. Apply `NOT NULL` only after a final zero-null diagnostic.
2. Keep the temporary trigger for one stabilization window after `NOT NULL`.
3. Repeat the second fake barbershop validation after applying `NOT NULL`.
4. Remove `set_default_appointment_barbershop_id` only in a later separate plan and PR.
