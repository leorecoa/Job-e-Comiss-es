# Atomic owner onboarding

## Cause

`profiles.barbershop_id` was required before an owner could create a barbershop, while tenant RLS required that same profile link to permit the insert. The frontend attempted two independent writes, allowing failure between tenant creation and profile update.

## Model

Migration `20260809001300` allows an active `owner` or `barber` profile to exist temporarily without a tenant. An unscoped profile can read only itself and receives no tenant access. Owners never have `barber_id`; barber linkage is either entirely null or contains both `barber_id` and `barbershop_id`.

An `AFTER INSERT` trigger on `auth.users` provisions exactly one profile only when `raw_user_meta_data.role` is exactly `owner` or `barber`. Missing or invalid roles are deliberately ignored. Existing profiles are never changed, and the migration backfill follows the same rule for confirmed and unconfirmed users.

## Transactional RPC

`public.create_owner_barbershop(...)` derives the user from `auth.uid()`, locks the profile, validates the owner state, inserts the first barbershop and links the profile in one transaction. Concurrent or repeated calls cannot create a second tenant. The frontend uses only this RPC during onboarding.

Expected public codes:

- `OWNER_ONBOARDING_AUTH_REQUIRED`
- `OWNER_ONBOARDING_PROFILE_NOT_FOUND`
- `OWNER_ONBOARDING_NOT_AUTHORIZED`
- `OWNER_ONBOARDING_ALREADY_CONFIGURED`
- `OWNER_ONBOARDING_SLUG_TAKEN`
- `OWNER_ONBOARDING_INVALID_INPUT`

## Rollout

1. Review the migration preflight and production inventory without writing data.
2. Apply migration `20260809001300` manually through the approved Supabase migration process.
3. Confirm the trigger, constraints, RLS policies and effective RPC grants.
4. Confirm every valid-role Auth user has one profile and the user without role still has none.
5. Test one new owner signup and first barbershop creation before enabling pilot traffic.
6. Monitor expected onboarding codes separately from unexpected database or 5xx failures.

The migration aborts if an existing owner has `barber_id` or if an existing barber has a partial tenant link. Do not bypass the preflight, disable RLS or repair the user without metadata by assigning a guessed role.

## Local validation

```powershell
npx supabase db reset --local
npx supabase test db --local supabase/tests
scripts\test-owner-onboarding-concurrency.ps1
```

After validation, stop the local stack. No remote SQL is executed by these steps.
