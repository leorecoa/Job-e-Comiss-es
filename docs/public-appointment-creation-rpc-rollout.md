# Public Appointment Creation RPC Rollout

## Objective

Move anonymous appointment creation from direct table INSERT to the tenant-scoped `public.create_public_appointment(...)` RPC. The RPC derives catalog and financial snapshot fields from the database and returns only the created UUID.

The review-only SQL was synchronized with the remote RPC correction related to PR #160. This repository change does not apply remote SQL. The RPC creates appointments with `status = 'scheduled'`; after frontend validation, the rollout removes `appointments_public_insert_scheduled` and revokes direct INSERT from `anon`. Roles `anon` and `authenticated` receive only EXECUTE on the RPC as defined by the script.

## Safe Order

1. Run the preflight in `docs/public-appointment-creation-rpc.sql` and review RLS, grants, constraints and the active-slot index.
2. Apply section 2 manually in the Supabase SQL Editor to create the RPC and grant EXECUTE.
3. Test valid, cross-tenant, inactive entity, invalid input and slot-conflict calls as `anon`.
4. Deploy the frontend that calls the RPC and validate `/book/:slug` in production.
5. Only after successful validation, run section 3 to drop `appointments_public_insert_scheduled` and revoke direct INSERT from `anon`.
6. Confirm `anon` also has no direct SELECT on `public.appointments`.
7. Run section 4 to inspect RLS, policies, table grants, both RPC signatures, `SECURITY DEFINER`, controlled search paths, return fields and EXECUTE privileges.
8. Repeat public, owner and barber smoke tests.

Do not deploy the RPC frontend before section 2 exists. Do not run sections 2 and 3 as one unattended operation.

## Security Properties

- RLS remains enabled and internal owner/barber policies are preserved.
- No public SELECT on `public.appointments` is added.
- `barber_name`, `service_type`, `service_value`, `commission_rate`, `status` and `financial_record_id` are not trusted from the client.
- The function is `SECURITY DEFINER` only to perform the controlled insert without public table access. It has a restricted search path and explicit grants.

## Final Expected State

`anon`:

- can execute `public.create_public_appointment(uuid, uuid, uuid, text, text, timestamptz, timestamptz, text)`;
- can execute `public.get_public_appointment_slots(uuid)`;
- cannot INSERT directly into `public.appointments`;
- cannot SELECT directly from `public.appointments`;
- has no dependency on `appointments_public_insert_scheduled`, which must be absent.

`authenticated` keeps only the table access required by the existing internal RLS policies. This rollout does not add authenticated table privileges. Both `anon` and `authenticated` receive EXECUTE on the two reviewed public RPCs, while `PUBLIC` does not. The canonical revokes from `PUBLIC` are defined in `docs/public-appointment-creation-rpc.sql` for creation and `docs/public-appointment-availability-rpc.sql` for slots.

`public.get_public_appointment_slots(uuid)` is scoped by its required `barbershop_id` argument and returns only `barber_id`, `barber_name`, `start_at`, `end_at`, `status` and `barbershop_id`. It must not return `client_name`, `client_phone`, `notes` or `financial_record_id`.

## Validation

```bash
npm run check
npm run build
npm audit --audit-level=moderate
npx playwright test
git diff --check
```

## Rollback

If the frontend must return to direct INSERT, first restore the exact reviewed `appointments_public_insert_scheduled` policy from `docs/supabase-tenant-rls-plan.sql` and its `anon` INSERT grant. Only then roll back the frontend and remove the RPC using section 5.

Remote SQL application is manual and is not performed by this repository change.
