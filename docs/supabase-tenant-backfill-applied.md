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

## Current database behavior

* Authenticated users can read only their own barbershop from `public.barbershops`.
* Existing data is linked to the initial barbershop.
* Public booking still works.
* New public appointments receive the default `barbershop_id` automatically.

## Current decision

`barbershop_id` remains nullable for now.

Do not apply `NOT NULL` yet.

Do not enforce tenant RLS on all tables yet.

The temporary appointment trigger exists only because the current public booking route does not resolve a barbershop by slug yet.

## Manual validation

Validated successfully:

* Owner dashboard works.
* Barber dashboard works.
* Public booking `/book` works.
* Public appointments receive `barbershop_id`.
* Existing appointments continue working.

## Next steps

* Add tenant-aware frontend flow.
* Introduce public booking by barbershop slug.
* Replace the temporary default trigger with explicit tenant resolution.
* Enforce tenant isolation with RLS across `profiles`, `barbers`, `services`, and `appointments`.
* Only after full validation, consider making `barbershop_id` `NOT NULL`.
