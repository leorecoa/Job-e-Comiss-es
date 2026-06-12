# Public Booking Tenant Contract

## Status

The public booking flow is now tenant-aware.

This document records the current contract between the frontend, Supabase data model, and temporary database fallback behavior.

## Current routes

The application supports:

```txt
/book
/book/gestao-maxima
```

## Route behavior

### `/book`

The generic public booking route remains available for compatibility.

It uses the default barbershop slug:

```txt
gestao-maxima
```

### `/book/gestao-maxima`

The slug-based public booking route resolves the barbershop explicitly before creating an appointment.

The expected flow is:

```txt
slug -> barbershop -> barbershopId -> appointment.barbershopId -> appointments.barbershop_id
```

## Current Supabase state

The following tenant foundation exists in Supabase:

* `public.barbershops`
* initial barbershop with slug `gestao-maxima`
* `barbershop_id` on:

  * `profiles`
  * `barbers`
  * `services`
  * `appointments`

Current validation result:

```txt
profiles      0 missing barbershop_id
barbers       0 missing barbershop_id
services      0 missing barbershop_id
appointments  0 missing barbershop_id
```

## Frontend contract

The public booking frontend must not create an appointment without a resolved `barbershopId`.

Current behavior:

* `PublicBookingPage` resolves a barbershop by slug.
* `/book` falls back to `gestao-maxima`.
* `/book/gestao-maxima` resolves the explicit slug.
* Invalid or inactive barbershop slugs show an error state.
* Public booking submit is blocked when no barbershop is resolved.
* `createPublicAppointment` preserves `barbershopId`.
* Public appointment validation rejects missing `barbershopId`.

## Repository behavior

The current public booking flow uses tenant-aware data where available:

* barbers are associated with `barbershopId`
* services are associated with `barbershopId`
* appointments are created with `barbershopId`
* public slots are filtered by `barbershopId`

Repository-level tenant filtering is in place. RLS hardening should be reviewed and applied separately using `docs/supabase-tenant-rls-plan.sql`.

Tenant-aware RLS has since been applied manually in Supabase and validated in production. See `docs/supabase-tenant-rls-applied.md`.

## Public slots view contract

Public booking availability is calculated from `public.public_appointment_slots`, not from full `appointments` rows.

The view must expose these columns in this order:

```txt
barber_id
barber_name
start_at
end_at
status
barbershop_id
```

`barbershop_id` is required so the frontend repository can filter occupied slots by barbershop.

Keep `barbershop_id` at the end of the view. This preserves the existing PostgreSQL view column order and avoids the `create or replace view` error:

```txt
cannot change name of view column "barber_id" to "barbershop_id"
```

This is the expected reference definition:

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

This document records the expected state only; do not add a separate executable migration for this hotfix.

## Production hotfix

The production Supabase view was manually updated to add `barbershop_id` at the end of `public.public_appointment_slots`.

That hotfix aligned production with the tenant-aware repository query, which includes `barbershop_id` when reading public slots:

```txt
public_appointment_slots?select=barbershop_id,barber_id,barber_name,start_at,end_at,status
```

The PostgREST select list can request fields in query order, but the PostgreSQL view definition must preserve `barbershop_id` as the final view column.

Without this column, PostgREST returns:

```txt
column public_appointment_slots.barbershop_id does not exist
```

## Temporary database fallback

Supabase still has a temporary fallback trigger for public appointments:

```txt
function: public.set_default_appointment_barbershop_id()
trigger: set_default_appointment_barbershop_id
```

This trigger exists only as a safety fallback.

The application should not depend on this trigger in the normal public booking flow.

## Current decision

Do not remove the trigger yet.

Do not apply `NOT NULL` to `barbershop_id` yet.

Tenant-aware RLS has been applied manually in Supabase after review and production validation.

Keep `docs/supabase-tenant-rls-plan.sql` as the reviewable reference for future environments or rollback analysis.

## Next technical step

Current hardening record:

```txt
docs: record applied tenant rls
```

Recorded state:

* tenant-aware policies applied for barbershops, profiles, barbers, services and appointments
* keep owner and barber dashboards working
* keep public booking working
* preserve `/book` fallback and invalid slug blocking
* keep the temporary public appointment fallback trigger for now
* keep `barbershop_id` nullable until a later validation step decides otherwise

## Later hardening steps

After the applied tenant-aware RLS state remains stable:

1. test a fake second barbershop in a controlled environment
2. harden public appointment `barber_id` and `service_id` checks if needed
3. apply `barbershop_id NOT NULL` only in a later separate step
4. remove temporary appointment fallback trigger in a separate PR/window
5. document final multi-tenant production contract
