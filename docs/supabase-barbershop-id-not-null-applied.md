# Supabase Barbershop ID NOT NULL Applied

## Status

`barbershop_id` was manually set to `NOT NULL` in the main Supabase tenant tables and validated in production.

This document records the applied production state. It is not an executable migration.

## What Was Applied

The following tables now require `barbershop_id`:

- `public.profiles`
- `public.barbers`
- `public.services`
- `public.appointments`

## Why This Matters

Tenant-aware RLS depends on each tenant-scoped row having a reliable `barbershop_id`.

Making `barbershop_id` mandatory improves tenant safety because it prevents new rows from bypassing tenant ownership through missing tenant metadata.

This makes the database schema match the current application and RLS contract:

- authenticated reads and writes are scoped by `barbershop_id`
- public booking resolves a barbershop before creating an appointment
- public appointments require `barbershop_id`, `barber_id`, and `service_id`
- public inserts validate that barber and service belong to the same active barbershop

## Preconditions Validated

Before applying `NOT NULL`, these conditions had already been validated:

- Tenant-aware RLS was applied by `barbershop_id`.
- Real isolation was validated with the second fake barbershop.
- Public booking by slug was validated.
- Invalid public booking slug remained blocked.
- Public appointments required `barbershop_id`, `barber_id`, and `service_id`.
- The `NOT NULL` plan was documented in `docs/supabase-barbershop-id-not-null-plan.md`.

The pre-application null diagnostic returned `0` missing `barbershop_id` rows for:

- `profiles`
- `barbers`
- `services`
- `appointments`

## SQL Applied

The following SQL was applied manually in Supabase:

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

## Post-Application Validation

After application, `information_schema.columns` confirmed:

```txt
appointments | barbershop_id | NO
barbers      | barbershop_id | NO
profiles     | barbershop_id | NO
services     | barbershop_id | NO
```

The `NO` value confirms that `barbershop_id` is no longer nullable in the four main tenant tables.

## Production Flows Validated

The following flows were validated after applying `NOT NULL`:

- `/book/gestao-maxima`
- `/book/barbearia-fake-rls`
- owner login
- barber login

Observed result:

- public booking continued working for `gestao-maxima`
- public booking continued working for `barbearia-fake-rls`
- owner login continued working
- barber login continued working
- tenant isolation remained aligned with the prior RLS validation

## Still Pending

These steps were intentionally not included:

- The temporary trigger `set_default_appointment_barbershop_id` has not been removed.
- A real second production barbershop has not been created.

## Recommended Next Steps

1. Plan safe removal of the temporary trigger `set_default_appointment_barbershop_id`.
2. Validate that no flow depends on automatic fallback assignment of `barbershop_id`.
3. Keep the fake second barbershop available for isolation regression checks.
4. After trigger removal is applied and validated, document that removal in a separate record.
