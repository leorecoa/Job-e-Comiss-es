# Supabase Tenant Backfill Applied

## Status

Initial tenant backfill was applied successfully in Supabase.

## Applied steps

* Created `public.barbershops`.
* Created initial barbershop:

  * name: `Gestão Máxima`
  * slug: `gestao-maxima`
  * id: `<production-barbershop-id>`
* Added nullable `barbershop_id` to:

  * `profiles`
  * `barbers`
  * `services`
  * `appointments`
* Backfilled existing records with the initial barbershop.
* Created `private.current_user_barbershop_id()`.
* Enabled RLS on `public.barbershops`.
* Added `barbershops_authenticated_read_own` policy.
* Added temporary fallback trigger for public appointments:

  * function: `public.set_default_appointment_barbershop_id()`
  * trigger: `set_default_appointment_barbershop_id`
* Applied a manual production hotfix to `public.public_appointment_slots` so public booking can filter occupied slots by barbershop.
* Added `barbershop_id` as the final column in `public.public_appointment_slots`, preserving the existing view column order.

## Current database behavior

* Authenticated users can read only their own barbershop from `public.barbershops`.
* Existing data is linked to the initial barbershop.
* Public booking still works.
* New public appointments receive the default `barbershop_id` automatically.
* Historical note: public booking availability originally read `public.public_appointment_slots`.
* Current frontend availability should use `public.get_public_appointment_slots(uuid)` after applying `docs/public-appointment-availability-rpc.sql`.
* `public.public_appointment_slots` exposes `barber_id`, `barber_name`, `start_at`, `end_at`, `status`, and `barbershop_id` in that order.

## Decision At Backfill Time

`barbershop_id` remains nullable for now.

Do not apply `NOT NULL` yet.

Do not enforce tenant RLS on all tables yet.

The temporary appointment trigger remains only as a safety fallback. The normal public booking flow should resolve a barbershop and send `barbershop_id` explicitly.

The public slots view hotfix should remain documented as reference state, not as a new executable migration. Keep `barbershop_id` at the end of the view definition to avoid PostgreSQL renaming/reordering errors during `create or replace view`.

## Later Applied State

Tenant-aware RLS, public appointment entity ID hardening, `barbershop_id NOT NULL`, and temporary trigger removal were later applied and validated.

See:

* `docs/supabase-tenant-rls-applied.md`
* `docs/public-appointment-entity-id-hardening.md`
* `docs/supabase-barbershop-id-not-null-applied.md`
* `docs/supabase-appointment-barbershop-trigger-removal-applied.md`

## Manual validation

Validated successfully:

* Owner dashboard works.
* Barber dashboard works.
* Public booking `/book` works.
* Public appointments receive `barbershop_id`.
* Historical public slot reads could filter by `barbershop_id` through `public.public_appointment_slots`; current frontend reads should use `public.get_public_appointment_slots(uuid)`.
* Existing appointments continue working.

## Next steps

* Add tenant-aware frontend flow.
* Introduce public booking by barbershop slug.
* Temporary default trigger was replaced by explicit tenant resolution.
* Enforce tenant isolation with RLS across `profiles`, `barbers`, `services`, and `appointments`.
* Keep validating that no flow depends on automatic fallback assignment.
