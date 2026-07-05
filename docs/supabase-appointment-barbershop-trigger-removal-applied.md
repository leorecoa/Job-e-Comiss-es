# Supabase Appointment Barbershop Trigger Removal Applied

## Status

The temporary appointment `barbershop_id` fallback trigger was manually removed from Supabase and validated in production.

This document records the applied production state. It is not an executable migration.

## What Was Removed

The temporary trigger was removed:

```txt
trigger_name: set_default_appointment_barbershop_id
event: INSERT
table: appointments
action: EXECUTE FUNCTION set_default_appointment_barbershop_id()
```

The temporary function was also removed:

```txt
schema: public
routine_name: set_default_appointment_barbershop_id
type: FUNCTION
```

## Why It Was No Longer Needed

The trigger existed as a migration fallback while appointments were moving to explicit tenant ownership.

It is no longer needed because the tenant hardening cycle is now complete:

- tenant-aware RLS is applied by `barbershop_id`
- broad legacy policies were removed
- tenant isolation was validated with a second fake barbershop
- public appointments require `barbershop_id`, `barber_id`, and `service_id`
- `barbershop_id` is `NOT NULL` on `profiles`, `barbers`, `services`, and `appointments`
- the frontend/repository sends explicit tenant and entity IDs

Keeping the fallback would make the database infer a default barbershop for new inserts, which is not appropriate for the final multi-tenant contract.

## SQL Applied

The following SQL was applied manually in Supabase:

```sql
begin;

drop trigger if exists set_default_appointment_barbershop_id
on public.appointments;

drop function if exists public.set_default_appointment_barbershop_id();

notify pgrst, 'reload schema';

commit;
```

## Post-Removal Validation

After removing the trigger and function, these production flows were validated:

- `/book/gestao-maxima` creates appointments normally
- `/book/barbearia-fake-rls` creates appointments normally
- `/book/barbearia-inexistente` remains blocked
- owner login continues working
- barber login continues working

The latest appointments query confirmed new records still include:

- `barbershop_id`
- `barber_id`
- `service_id`

Validated example:

```txt
client_name: look
status: scheduled
barber_id: present
service_id: present
barbershop_id: present
```

## Observed Result

Public booking did not depend on the removed fallback trigger.

New appointments continued to be created with explicit tenant and entity IDs, and invalid public slugs continued to be blocked.

Owner and barber authenticated flows continued working after removal.

## Final Tenant Hardening State

The tenant hardening cycle is now complete for the current single-business production model:

- `barbershop_id` exists on tenant-scoped tables
- existing tenant data was backfilled
- public booking resolves barbershops by slug
- invalid public slugs are blocked
- public slot reads use `public.get_public_appointment_slots(uuid)`
- tenant-aware RLS is applied
- broad legacy policies were removed
- public appointment inserts require tenant and entity IDs
- `barbershop_id` is `NOT NULL` in the main tenant tables
- the temporary appointment fallback trigger was removed

The project should now treat missing `barbershop_id`, `barber_id`, or `service_id` as a bug instead of relying on fallback behavior.

## Possible Next Steps

These are separate future decisions, not part of this applied removal:

1. Clean fake validation data when it is no longer needed.
2. Create a real second barbershop only when there is a business/commercial flow for it.
3. Evaluate multi-barbershop dashboards if the product needs cross-shop operations.
4. Review the Vite chunk-size warning separately from tenant hardening.
