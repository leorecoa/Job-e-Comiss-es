# Public Booking Tenant Contract

## Status

The public booking flow is tenant-aware and slug-based.

This document records the current contract between the frontend and the Supabase data model. New tenants must be created and configured by their owner. The app must not assume a default production barbershop.

## Current Routes

The application supports:

```txt
/book/:slug
/book
/agendar
```

## Route Behavior

### `/book/:slug`

The slug-based route resolves the barbershop explicitly before loading catalog data or creating an appointment.

Expected flow:

```txt
slug -> barbershop -> barbershopId -> tenant catalog -> appointment.barbershopId -> appointments.barbershop_id
```

If the slug is unknown or inactive, the page must show an error state and block submit.

### `/book` and `/agendar`

The generic public routes remain available for compatibility, but they must not silently assume any production tenant slug.

If no tenant slug is resolved, the app should show a safe state, route the user to a tenant-specific link, or require explicit tenant selection. Operational booking still requires a resolved `barbershopId`.

## Current Supabase Contract

The tenant foundation uses:

- `public.barbershops`
- `barbershop_id` on `profiles`
- `barbershop_id` on `barbers`
- `barbershop_id` on `services`
- `barbershop_id` on `appointments`

Each owner is expected to create or operate their own barbershop tenant. Existing barbershops used during migration or validation are not default tenants for new production usage.

## Frontend Contract

Public booking must not create an appointment without a resolved `barbershopId`.

Current behavior:

- `PublicBookingPage` resolves a barbershop by slug.
- `/book/:slug` uses exactly the slug from the URL.
- invalid or inactive slugs show an error state.
- public booking submit is blocked when no barbershop is resolved.
- public booking submit is blocked without a selected active barber and active service from the same tenant.
- public appointment validation rejects missing `barbershopId`, `barberId`, or `serviceId`.
- public booking must not fall back to any hardcoded tenant.

## Repository Behavior

The public booking flow uses tenant-aware data:

- barbers are filtered by `active = true` and `barbershop_id`
- services are filtered by `active = true` and `barbershop_id`
- public slots are loaded through `public.get_public_appointment_slots(uuid)` and filtered by the required `barbershop_id` argument
- appointments are created with `barbershop_id`, `barber_id`, and `service_id`

Tenant-aware RLS has been applied manually in Supabase and validated in production. See `docs/supabase-tenant-rls-applied.md`.

Public appointment inserts were hardened to require `barbershop_id`, `barber_id`, and `service_id`. See `docs/public-appointment-entity-id-hardening.md`.

## Public Slots Availability Contract

Public booking availability is calculated through `public.get_public_appointment_slots(uuid)`, not from full `appointments` rows and not from a global slot query.

The RPC must receive the resolved tenant id:

```txt
p_barbershop_id = resolved barbershop id from /book/:slug
```

It must return only:

```txt
barber_id
barber_name
start_at
end_at
status
barbershop_id
```

The RPC must not return `client_name`, `client_phone`, `notes`, `service_value` or other personal/financial fields.

Reference SQL:

```txt
docs/public-appointment-availability-rpc.sql
```

Rollout rule:

1. Apply and validate `public.get_public_appointment_slots(uuid)` manually in Supabase.
2. Deploy the frontend that calls the RPC.
3. Confirm `/book/:slug` works without public SELECT on `appointments`.
4. Only in a later PR or operational step, evaluate revoking public access to the legacy view.

## Legacy Public Slots View Contract

`public.public_appointment_slots` is retained during rollout for compatibility/reference. New frontend code should not query it directly.

The view must expose these columns in this order:

```txt
barber_id
barber_name
start_at
end_at
status
barbershop_id
```

`barbershop_id` is required so legacy callers can filter occupied slots by barbershop.

Keep `barbershop_id` at the end of the view. This preserves the existing PostgreSQL view column order and avoids the `create or replace view` error:

```txt
cannot change name of view column "barber_id" to "barbershop_id"
```

Expected reference definition:

```sql
create or replace view public.public_appointment_slots
with (security_invoker = true)
as
select
  a.barber_id,
  a.barber_name,
  a.start_at,
  a.end_at,
  a.status,
  a.barbershop_id
from public.appointments a
where a.status in ('scheduled', 'confirmed');
```

This document records the expected legacy view state only. The current public availability SQL is `docs/public-appointment-availability-rpc.sql`.

## Removed Temporary Database Fallback

Supabase previously had a temporary fallback trigger for public appointments:

```txt
function: public.set_default_appointment_barbershop_id()
trigger: set_default_appointment_barbershop_id
```

This trigger was removed after tenant hardening was completed and validated.

The application must not depend on fallback assignment in the normal public booking flow.

See `docs/supabase-appointment-barbershop-trigger-removal-applied.md`.

## Current Decision

`barbershop_id NOT NULL` has been applied and validated in production. See `docs/supabase-barbershop-id-not-null-applied.md`.

Tenant-aware RLS has been applied manually in Supabase after review and production validation.

Keep `docs/supabase-tenant-rls-plan.sql` as the reviewable reference for future environments or rollback analysis.

## Later Hardening Steps

1. Repeat second-tenant validation before critical RLS changes.
2. Keep hardened public appointment `barber_id` and `service_id` checks validated before critical booking changes.
3. Clean fake validation data when it is no longer needed.
4. Create real production barbershops through owner onboarding, not SQL-only shortcuts.
5. Evaluate multi-barbershop dashboards separately if needed.
