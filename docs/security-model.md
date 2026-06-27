# Security Model

## Overview

Job e Comissoes is a multi-tenant SaaS application for barbershops.

Each barbershop is treated as an independent tenant identified by `barbershop_id`.

The public booking flow resolves the tenant by slug through routes such as:

```txt
/book/:slug
```

The application must not assume a global default tenant for operational actions.

## Multi-tenant model

`public.barbershops` is the root tenant entity.

Operational data is scoped to a tenant through `barbershop_id`:

- `public.barbers`
- `public.services`
- `public.appointments`
- `public.profiles`

Current application rules:

- barbershop resolution happens before public booking actions
- owner flows use the authenticated profile's `barbershop_id`
- barber flows use the authenticated profile's `barbershop_id` and `barber_id`
- the app must not fall back to a global tenant
- the app must not use `Gestao Maxima` as a silent fallback tenant

## RLS and data access

Operational data security depends on Supabase RLS and policies.

The frontend is not the final authority for access control. It reduces bad requests and accidental leakage, but row access is enforced in Supabase.

Current access model:

- `owner` can operate only inside the owner's own `barbershop_id`
- `barber` can operate only inside the barber's own `barbershop_id`
- barber appointment access is further scoped by `barber_id`
- public users can read only the active data required for booking
- public users can insert a valid `scheduled` appointment for the resolved tenant

`appointments` do not have public `SELECT`.

That table contains client data such as:

- `client_name`
- `client_phone`
- `notes`

Public availability must use `public.public_appointment_slots`, not full `appointments` rows.

## Public booking

The public booking flow is tenant-aware and slug-based:

```txt
/book/:slug
```

The flow resolves the barbershop first and only then loads tenant-scoped barbers, services, and occupied slots.

Current validation before insert includes:

- resolved `barbershop_id`
- active barbershop
- active barber belonging to the same `barbershop_id`
- active service belonging to the same `barbershop_id`
- valid selected slot from the generated availability list
- valid `client_name`
- valid `client_phone`
- bounded `notes`
- valid `start_at`
- valid `end_at`
- `end_at > start_at`

The public booking payload is validated in application code before calling Supabase.

Public inserts must remain insert-only:

- no `.select()`
- no `.single()`
- no public `SELECT` on `appointments`

This avoids requiring public read permission on sensitive appointment rows.

## Duplicate booking protection

Active slot conflicts are defined by:

```txt
barbershop_id + barber_id + start_at
```

Blocking statuses:

- `scheduled`
- `confirmed`
- `completed`

Non-blocking statuses:

- `cancelled`
- `no_show`

Application code performs a pre-check before insert, and the database has a partial unique index for race protection:

```txt
appointments_unique_active_barbershop_barber_start
```

Applied index definition:

```sql
create unique index if not exists appointments_unique_active_barbershop_barber_start
on public.appointments (barbershop_id, barber_id, start_at)
where status in ('scheduled', 'confirmed', 'completed');
```

This does not replace RLS. It prevents two active appointments from occupying the same barber slot in the same tenant.

## Fail-closed in production

Production must not operate without Supabase configured.

If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing or invalid in production:

- the app must block operational actions
- the app must not use localStorage as an operational database
- the app must show a configuration-unavailable state

Local fallback is limited to development or demo contexts.

Production must not persist operational data in localStorage as a substitute for Supabase, including:

- tenant identity
- booking data
- catalog data
- profiles
- roles
- financial records

## RBAC

Current roles:

- `owner`
- `barber`

These roles help drive the UI, but role values in the frontend are not the source of truth for security.

Real authorization depends on the combination of:

- authenticated profile
- `barbershop_id`
- `barber_id` where applicable
- Supabase RLS and policies

Frontend role checks improve UX and reduce invalid actions, but they do not replace backend enforcement.

## Current limits

This document does not claim absolute security.

Known limits and recommended follow-up work:

- external CAPTCHA or rate limiting can still be added for public booking abuse control
- Supabase policies should be reviewed periodically, especially before tenant or RBAC changes
- dependencies should continue to be audited regularly
- `npm audit --audit-level=moderate` remains part of the recurring project validation

## Operational checklist

Before deploying or changing tenant-sensitive behavior:

- apply manual SQL only when a reviewed doc in `docs/` explicitly requires it
- confirm Vercel environment variables for Supabase are present and valid
- run `npm audit --audit-level=moderate`
- keep `appointments` without public `SELECT`
- review RLS and policies before changing tenant, booking, or RBAC behavior
- preserve `public.public_appointment_slots` as the public availability surface
