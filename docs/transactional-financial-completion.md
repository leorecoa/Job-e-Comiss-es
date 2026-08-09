# Transactional financial completion

Migration `20260809001200_add_transactional_financial_completion.sql` adds tenant-scoped persistence for financial records and the authenticated RPC:

```sql
public.complete_appointment_with_financial_record(uuid)
```

The RPC locks the appointment row, validates the active owner or barber profile, creates one immutable financial snapshot and links its UUID through `appointments.financial_record_id`. The unique appointment constraint makes retries and concurrent calls idempotent. Any insert or update failure rolls the entire transaction back.

## Access

- Owners can read financial records from their tenant.
- Barbers can read only records linked to their own `barber_id`.
- `anon` and `PUBLIC` have no table access or RPC execution.
- `authenticated` has read access under RLS and can execute the completion RPC, but cannot write the table directly.
- `service_role` keeps table administration access but cannot execute the completion RPC.

## Rollout

Apply the migration manually after review. Do not use a global tenant fallback or disable RLS. Validate locally with:

```powershell
npx supabase db reset --local
npx supabase test db --local supabase/tests
scripts\test-financial-completion-concurrency.ps1
```

The migration intentionally performs no backfill. Existing completed appointments with a null financial link, including the diagnostic production appointment, must be repaired explicitly through the authenticated RPC after rollout review.
