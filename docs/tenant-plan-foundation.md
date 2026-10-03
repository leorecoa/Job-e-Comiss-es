# Tenant plan foundation (035)

PR A introduces commercial state only. It does not grant features, charge money,
change onboarding, or gate any operational path.

## Model

- `commercial_plans.code`: stable lowercase identifier, 1-64 characters, with a
  nonblank display name. No plans, prices, limits or capabilities are seeded.
- `tenant_subscriptions.barbershop_id`: primary key and restricted FK to the
  tenant. At most one row in any status, including canceled. This is a current
  state projection, not subscription history or a billing ledger.
- `plan_code`: required FK to a catalog entry. Referenced identities cannot be
  renamed/deleted while in use. Future revisions should use explicit new codes
  when entitlement semantics change rather than silently redefine an identity.
- Explicit status: `pending`, `trialing`, `active`, `paused`, `canceled`. No default
  activation. These are provider-neutral states, not feature decisions.
- Optional trial and current-period pairs use finite `timestamptz` instants with
  strictly increasing endpoints ([start, end)). `trialing` requires a trial pair.
  No trial duration, recurrence, conversion or expiry automation is assumed.
- `created_at` / `updated_at` follow the existing `now()` and `set_updated_at`
  pattern. Declarative checks do not implement transition authorization.

## Compatibility and security

No backfill and no automatic subscription on tenant creation. A missing row is
explicitly **unassigned**, not trial, paid, unlimited, expired or blocked. Existing
and new tenants keep their current operational behavior. No existing row, RPC,
policy, grant, trigger or frontend is changed by 035.

Both tables enable RLS with no policies. PUBLIC, anon, authenticated and
service_role have no table or column CRUD privileges. Only trusted database
administration can populate them at this stage. There is no new API reader or
writer, no security-definer function and no browser access. This is deliberately
closed even between users of the same tenant.

Legacy frontend `UserProfile.planType` / `isPro` and localStorage are not sources
of commercial authority and are not imported into these tables.

## Rollout and next decisions

Review and apply append-only 035 manually through the existing deployment process;
this PR performs no remote operation. Validate the final ACL query and pgTAP before
rollout. Do not drop tables for rollback after commercial records exist.

Before any enforcement PR, product must approve actual plan codes, capabilities,
limits, trial policy, state transitions and an explicit migration strategy for
unassigned tenants. Build a tenant-derived, authorized server-side resolver and
controlled writer then; never allow clients to set their own commercial state.
Absence must not accidentally become an access-denial rule on that cutover.

No payment provider identifiers, amounts, invoices, webhooks, pricing UI, schedule
changes or financial-record changes belong to this foundation.

## Read-only commercial resolver (037)

`public.get_tenant_commercial_state()` has zero arguments. Only an authenticated
user with an active owner profile and an existing linked tenant may read it.
Identity comes from `auth.uid()` and tenant from that profile, never from browser
selectors, metadata, `UserProfile.planType` / `isPro`, or localStorage.

The STABLE SECURITY DEFINER function uses `search_path = pg_catalog` and qualified
references. EXECUTE is granted only to authenticated; PUBLIC, anon and service_role
cannot execute it. Both commercial tables remain closed to direct CRUD, with no
new table/column grants or policies. RPC access confers no writing authority.

An authorized call returns exactly one row: `status`, `plan_code`,
`trial_started_at`, `trial_ends_at`, `current_period_start`, `current_period_end`.
The period fields alias `current_period_started_at` / `current_period_ends_at`;
the persisted columns are unchanged. Instants remain timestamptz, without calendar
or timezone conversion. No administrative metadata is returned.

Only a missing subscription after successful authorization returns `unassigned`
with all other fields NULL. This means neither blocked, free, trial nor active.
Missing identity/profile/tenant, an inactive owner or another role raises
`TENANT_COMMERCIAL_STATE_FORBIDDEN` (P0001), not unassigned. Query errors propagate;
they are not converted into a commercial state.

Persisted pending/trialing/active/paused/canceled states are returned literally,
including trialing with a past trial end. No expiry calculation, plan seed,
subscription creation, writer, billing, trigger or enforcement is introduced.
The RPC is not wired into Auth, onboarding, agenda, booking or frontend guards;
its failure cannot become an operational access decision in this PR.

Review 037 and run `supabase/tests/tenant_commercial_state_test.sql` locally before
manual rollout. Never repair/reset/reapply old migrations to accommodate an old
local container. No operational behavior or legacy frontend state is changed.
