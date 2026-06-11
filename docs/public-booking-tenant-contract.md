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

The full repository-level tenant isolation is not complete yet.

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

Do not enforce full tenant RLS on all tables yet.

These steps should happen only after repository-level tenant isolation is completed and validated.

## Next technical step

Recommended next PR:

```txt
feat: enforce barbershop isolation in repositories
```

Expected goals:

* filter barbers by `barbershop_id`
* filter services by `barbershop_id`
* filter appointments by `barbershop_id`
* keep owner and barber dashboards working
* keep public booking working
* preserve `/book` fallback temporarily
* keep RLS unchanged until repository behavior is validated

## Later hardening steps

After repository-level isolation is validated:

1. enforce tenant-aware RLS policies
2. validate dashboards and public booking
3. remove temporary appointment fallback trigger
4. apply `barbershop_id NOT NULL`
5. document final multi-tenant production contract
