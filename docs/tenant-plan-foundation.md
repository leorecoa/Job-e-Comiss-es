# Tenant plan foundation (035)

PR A introduces commercial state only. It does not grant features, charge money,
change onboarding, or gate any operational path.

The approved [commercial access policy](commercial-access-policy.md) separates
this persisted state from future entitlement decisions. It preserves unassigned
compatibility and reader 037's informational contract; no enforcement is active.

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

## Administrative writer (038)

`private.set_tenant_subscription(uuid, text, text, timestamptz, timestamptz,
timestamptz, timestamptz)` returns void. All seven arguments are explicit:
tenant, existing plan code, status, trial start/end and current-period start/end.
NULL clears an optional pair; partial pairs are rejected by the 035 constraints.
There are no commercial defaults, inferred dates or transition matrix.

This VOLATILE SECURITY INVOKER function uses `search_path = pg_catalog` and
qualified objects. Only trusted database administration with the existing
underlying privileges can use it. PUBLIC, anon, authenticated (owner/barber)
and service_role have no EXECUTE. Table grants and RLS are unchanged. Private
schema placement alone is not authorization; the explicit function ACL matters.
No HTTP endpoint or browser authority is introduced. A database administrator
already able to write tables is still trusted, not sandboxed by this function.

The atomic tenant-key UPSERT replaces the full current state, preserving
created_at and using the existing transaction-time updated_at trigger.
Concurrent successful writes use last-write-wins in database write order,
not request arrival order; no optimistic version check is promised. Paused and
canceled rows remain persisted. Missing rows alone mean unassigned.

No plans are seeded. No billing, gating, commercial history, automation or
automatic provisioning exists. Review/apply only 038 through the normal manual
rollout; never repair/reset/reapply 001-037. Validate foundation, reader and
writer pgTAP together against a local database containing the approved baseline.

## Founding Partner pilot (039)

039 registers only `founding_partner` / `Parceiro Fundador`. It assigns no tenant.
An exact identity already present is left untouched, including timestamps;
a different name raises `FOUNDING_PARTNER_PLAN_CONFLICT`, never overwriting it.

The pilot is 30 days defined as exactly 720 elapsed hours, using the half-open
interval [trial_started_at, trial_ends_at). Administration explicitly supplies
both instants (with offsets), status `trialing`, and NULL for both current-period
fields through writer 038. Calculate the end with `interval '720 hours'`, not
calendar days dependent on session timezone/DST. Confirm the tenant and any
existing subscription before calling the full-replacement, last-write-wins writer.
038 remains generic: it does not enforce a pilot-specific duration globally.

The offer is R$ 0 during the pilot, without a card, with implementation and
support included. This is not a persisted or definitive price, nor lifetime
free access. Continuation is optional, subject to a later commercial decision
and presentation of terms before contracting.

After the end instant the persisted status remains literally `trialing` until
an explicit administrative decision. There is no automatic expiry transition,
charge, renewal, blocking, billing, gating, cron, webhook or commercial history.
Owner/barber/browser/service_role cannot activate or modify the pilot. Existing
ACL/RLS and the reader remain unchanged; no HTTP endpoint is introduced.

Run `supabase/tests/founding_partner_pilot_test.sql` with psql/pgTAP preserving
its relative migration include, alongside the 035/037/038 tests. All fixtures
and the registration/repeat exercises are rolled back; use a local test database.

## Observational entitlement resolver (040)

`private.resolve_tenant_entitlements(p_barbershop_id uuid)` returns exactly one
row: `commercial_status text`, `commercial_condition text`,
`can_create_internal_appointment boolean`, `can_accept_public_booking boolean`,
`reason text`, `evaluated_at timestamptz`. It is VOLATILE SECURITY INVOKER with
`search_path=pg_catalog`; PUBLIC/anon/authenticated/service_role have no EXECUTE.
Administration must supply a trusted tenant and retain underlying read authority.
No client/table grants or RLS change, public RPC, endpoint or operational caller
is introduced. Reader 037 remains literal/informational; writer 038 remains
administrative and generic. No frontend commercial state becomes authority.

| Persisted status | Derived condition | Both capabilities | Reason |
| --- | --- | --- | --- |
| NULL (no subscription) | unassigned | true | UNASSIGNED_COMPATIBILITY |
| pending | pending | false | COMMERCIAL_PENDING |
| trialing | trial_valid | true | TRIAL_VALID |
| trialing | trial_not_started | false | TRIAL_NOT_STARTED |
| trialing | trial_expired | false | TRIAL_EXPIRED |
| active | active | true | COMMERCIAL_ACTIVE |
| paused | paused | false | COMMERCIAL_PAUSED |
| canceled | canceled | false | COMMERCIAL_CANCELED |

One database `clock_timestamp()` supplies both classification and `evaluated_at`.
Trials use `[trial_started_at, trial_ends_at)`. The literal stored status never
changes; future/expired trials remain `trialing`. No special founding_partner
branch or active-period expiry is inferred. Missing subscription remains
compatible, not a plan or an error. True grants no operational authorization;
040 alone blocks nothing. 042 now enforces only public booking creation.
No state is mutated or automatically provisioned.

Explicit P0001 errors are `COMMERCIAL_ENTITLEMENT_TENANT_REQUIRED`,
`COMMERCIAL_ENTITLEMENT_TENANT_NOT_FOUND`, `COMMERCIAL_ENTITLEMENT_PLAN_INVALID`,
`COMMERCIAL_ENTITLEMENT_STATUS_INVALID` and `COMMERCIAL_ENTITLEMENT_TRIAL_INVALID`.
Database errors propagate; errors never become unassigned or capability booleans.
035 constraints normally make the defensive corrupt-plan/status/trial branches
unreachable. Tests preserve those constraints and verify rejection at the data
boundary rather than manufacturing corruption. Exact microsecond equality at
trial boundaries is inspected in the comparison operators; behavioral tests
check each window against the actual returned evaluation instant, without an
injected clock. That source check alone is not an end-to-end boundary proof.

040 itself adds no locks, billing, gating, transitions, bootstrap changes or
operational restrictions. Run the 035/037/038/039/040 contracts with 041 below.

## Commercial write coordination (041)

041 replaces only the definition of `private.set_tenant_subscription(...)`,
preserving its seven arguments, void return, INVOKER/VOLATILE/search_path, ACL,
validation errors, NULL/full-replacement semantics and timestamp behavior.
Its first statement calls `private.lock_availability_tenants(array[p_barbershop_id])`
from 027, before any commercial mutation. No helper, namespace, table, artificial
row lock, session lock or explicit unlock is introduced. Execution still requires
trusted administrative privileges; a tenant ID itself conveys no authority.
PUBLIC, anon, authenticated and service_role remain without commercial EXECUTE.

Existing appointment writers already acquire this same tenant transaction lock.
Even without a subscription, the tenant key coordinates initial assignment with
agenda writes. Whichever transaction gets the lock first proceeds; the other
waits until commit/rollback. Commercial writers remain last-write-wins after
serialization. READ COMMITTED is enforced by the unchanged helper. Different
tenant keys do not share an intentional global mutex. Sorted multi-tenant locking
and advisory-before-row ordering remain necessary for administrative batches.

041 alone is coordination only: no appointment writer changes or calls to resolver
040, no capabilities enforced, no commercial rejection of appointments/bookings.
False observational decisions still do not block operations. Coordination reduces
TOCTOU exposure, but future enforcement must evaluate after locks in the creation
transaction. Locks do not stop time. Direct privileged SQL that bypasses the
administrative writer must explicitly follow the protocol; it is not sandboxed.

Before enforcement: audit privileged service_role INSERT/ALL on appointments,
and decide how cancelled/no_show reactivation via update_owner_appointment is
classified. Neither surface is changed here. No table grants/RLS change.

Run `commercial_subscription_coordination_test.sql` and the previous commercial
contracts, plus availability/write regressions. Run
`scripts/test-commercial-subscription-concurrency.ps1 -Database validation_<name>`
separately against a disposable local Docker database containing 001-041. It
rejects the normal postgres database, uses synthetic fixtures with collision
preflight/cleanup, and observes real advisory waits between open transactions.
It tests both orders, missing rows, rollback, full replacement, different tenants
and explicit rejection of REPEATABLE READ without changing global isolation.

## Public booking enforcement (042)

Only `create_public_appointment` now checks `can_accept_public_booking`, after
the unchanged tenant/barber/phone locks and operational validation, immediately
before INSERT. The fresh 040 evaluation uses its own clock_timestamp: a trial
that expires during a lock wait is denied. The decision is evaluation-time,
not transaction-start or commit-time. Unassigned, active and valid trial remain
allowed; pending, future/expired trial, paused and canceled are denied.

No subscription is provisioned. Owner/barber creation, existing commitments,
completion and reads remain unchanged. Internal reactivation
`cancelled/no_show -> scheduled/confirmed` is future new demand, not implemented.
No billing or global commercial enforcement is introduced.

Capability IS NOT TRUE raises only `PUBLIC_APPOINTMENT_COMMERCIAL_UNAVAILABLE`.
Resolver errors propagate fail-closed without INSERT; errors never mean
unassigned. The unchanged proxy returns generic `PUBLIC_BOOKING_UNAVAILABLE`
with no-store, not commercial details. An HTTP timeout does not prove rollback;
no automatic retry or idempotency is added.

service_role retains privileged direct INSERT under the baseline. No versioned
production endpoint uses that path. It remains an administrative bypass outside
the official public RPC; reducing that privilege requires separate hardening.
No RLS, grants, resolver or commercial-writer definition changes in 042.

Validate 035/037/038/039/040/041 plus `public_booking_entitlement_test.sql`,
operational regressions and the following against disposable local 001-042 only:

```powershell
scripts/test-public-booking-entitlement-concurrency.ps1 -Database validation_<name>
```
