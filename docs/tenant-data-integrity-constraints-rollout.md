# Tenant Data Integrity Constraints Rollout

## Objective

Add tenant-consistent relationships without changing RLS, public grants, application code or existing data.

Review-only SQL: `docs/tenant-data-integrity-constraints.sql`.

The remote schema already contains and has validated these CHECK constraints: `services_price_non_negative`, `services_duration_valid`, `services_commission_rate_valid`, `appointments_service_value_non_negative`, `appointments_commission_rate_valid`, `appointments_time_valid` and `appointments_status_check`. They are not created, validated or removed by this rollout.

## Risks And Prerequisites

- Run every preflight query first. Stop if a violation query returns rows; the constraint inventory is informational. Review and correct invalid data in a separate approved change.
- Confirm the production schema still matches `docs/supabase-schema.sql` and review the current constraint inventory returned by the script.
- Schedule the rollout for a low-write window. `CREATE INDEX CONCURRENTLY` reduces blocking, but attaching and validating constraints still takes locks and scans data.
- Run each concurrent index statement outside an explicit transaction.
- Take a current database backup and record the query results before rollout.

## Manual Order

1. Open the reviewed SQL in the Supabase SQL Editor. Do not run the whole file blindly.
2. Run section 1 and require zero invalid rows.
3. Run section 2 outside an explicit transaction.
4. Run section 3 one constraint group at a time, monitoring locks and errors.
5. Run section 4 and confirm every proposed constraint has `convalidated = true`.
6. Re-run all preflight queries and validate public booking plus owner and barber flows.

The script does not grant public `SELECT` on `public.appointments`, does not disable RLS and does not add a global tenant fallback.

## Validation

Validate in a controlled environment before production:

```bash
npm run check
npm run build
npm audit --audit-level=moderate
git diff --check
```

Also verify same-tenant inserts succeed, cross-tenant appointment/profile links fail, valid nullable commission rates remain accepted, and public booking still uses `public.get_public_appointment_slots(uuid)`.

## Rollback

Use only the commented rollback section at the end of the SQL, in reverse dependency order. It removes only constraints introduced by this rollout, uses no `CASCADE`, and does not change or repair data. Re-run the preflight and application validation after rollback.

Remote application is manual and must happen only after review and explicit approval.
