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
* Public booking availability reads `public.public_appointment_slots`.
* `public.public_appointment_slots` exposes `barber_id`, `barber_name`, `start_at`, `end_at`, `status`, and `barbershop_id` in that order.

## Current decision

`barbershop_id` remains nullable for now.

Do not apply `NOT NULL` yet.

Do not enforce tenant RLS on all tables yet.

The temporary appointment trigger remains only as a safety fallback. The normal public booking flow should resolve a barbershop and send `barbershop_id` explicitly.

The public slots view hotfix should remain documented as reference state, not as a new executable migration. Keep `barbershop_id` at the end of the view definition to avoid PostgreSQL renaming/reordering errors during `create or replace view`.

## Manual validation

Validated successfully:

* Owner dashboard works.
* Barber dashboard works.
* Public booking `/book` works.
* Public appointments receive `barbershop_id`.
* Public slot reads can filter by `barbershop_id` through `public.public_appointment_slots`.
* Existing appointments continue working.

## Next steps

* Add tenant-aware frontend flow.
* Introduce public booking by barbershop slug.
* Replace the temporary default trigger with explicit tenant resolution.
* Enforce tenant isolation with RLS across `profiles`, `barbers`, `services`, and `appointments`.
* Only after full validation, consider making `barbershop_id` `NOT NULL`.
