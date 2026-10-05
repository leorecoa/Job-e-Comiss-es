# Commercial access policy

## Status and scope

Migration 040 introduces only an administrative, observational entitlement
resolver. It implements no gating or operational restriction. Migrations
001-039 remain unchanged; no operational path calls the resolver.
All tenants keep their current operational behavior in the observational phase.

See [tenant plan foundation](tenant-plan-foundation.md) for persisted contracts.

## Commercial state versus entitlement

Commercial state comes from `tenant_subscriptions` and represents the persisted
commercial relationship: `pending`, `trialing`, `active`, `paused` or `canceled`.
Only absence of a subscription for a valid, authorized tenant means `unassigned`.

Entitlement is a separate derived decision about which capabilities may
execute. Reading that decision must not modify the commercial state. Commercial
permission never substitutes for operational authorization, identity checks or
tenant isolation: an operation must satisfy both when enforcement is introduced.

Reader 037, `public.get_tenant_commercial_state()`, remains literal and
informational. Do not turn it into an enforcement mechanism or change its
owner-only contract to serve public/barber writers. Writer 038 remains
administrative; owner, barber, browser and service_role gain no commercial
writing authority through this policy.

## Compatibility

`unassigned` preserves the current operational behavior. It is not blocked,
trialing or active, and is not an implicit commercial plan. Do not automatically
backfill existing or newly created tenants.

Resolver errors, invalid identity, missing tenant and malformed commercial data
must not be converted to `unassigned`. A failed lookup is not proof of absence.

## Future access matrix

This matrix is policy for later enforcement, not an instruction to block today.
Preserved access always remains subject to the existing RBAC and tenant scope.

| Persisted state / condition | Derived meaning | Future access policy |
| --- | --- | --- |
| No subscription | `unassigned` | Preserve current operational compatibility until an explicit migration strategy is approved. |
| `pending` | Pending relationship | Do not initiate new demand; preserve reads, history and existing commitments. |
| `trialing`, start <= now < end | Valid trial | Permit new demand during `[trial_started_at, trial_ends_at)`. |
| `trialing`, now < start | `trial_not_started` | No new demand in the observational decision; no operational enforcement yet. |
| `trialing`, now >= end | `trial_expired` | No new demand in the observational decision; no operational enforcement yet. |
| `active` | Active relationship | Permit commercially approved capabilities; this is not proof of payment. |
| `paused` | Paused relationship | Suspend new demand; preserve administration, history and existing commitments. |
| `canceled` | Ended relationship | Accept no new demand; preserve data and existing commitments. |

## New demand and capability boundaries

The observational capabilities are `can_create_internal_appointment` and
`can_accept_public_booking`. Both are true only for `unassigned`, `trial_valid`
and `active`; both are false for all other conditions in the matrix. True does
not authorize RBAC/tenant access; false does not block any current operation.

Suspending appointment creation does not automatically restrict team management,
catalog, settings, reports, history or financial operations. Each capability
requires its own approved policy. Editing, rescheduling, canceling or completing
an existing appointment must not silently be classified as new demand. Specify
their boundaries separately while preserving existing commitments and financial
integrity. No capability named here is enforced by this PR.

## Trial and trusted time

040 captures `pg_catalog.clock_timestamp()` exactly once per evaluation, returns
it as `evaluated_at`, and uses it for every temporal comparison. No external
clock is accepted. The interval includes the start and excludes the end. At exactly
`trial_ends_at`, derive `trial_expired`; before the start derive
`trial_not_started`. These are derived conditions, not persisted statuses.

Never automatically persist `expired`, change `trialing` to `paused`/`canceled`,
charge, renew or block merely because time elapsed. The Founding Partner pilot
remains exactly 720 elapsed hours; writer 038 remains generic. A past
`current_period_end` (stored as `current_period_ends_at`) does not invalidate
`active` without a separately approved policy.

## Public booking

For future enforcement, public presentation may remain available and existing
appointments must be preserved. Restrictive commercial conditions may prevent
NEW bookings under an explicitly approved capability policy.

External unavailability must not reveal debt, plan or commercial situation.
A prior availability response is neither a reservation nor authorization to
create an appointment. Creation must revalidate entitlement in the database;
the proxy and UI cannot be the only enforcement boundary.

## Security and transaction boundary

- Frontend state and hidden/disabled buttons are not enforcement.
- `localStorage` and legacy `UserProfile.planType` / `isPro` are not authority.
- Owners and barbers cannot forge or self-assign entitlement.
- A client-supplied tenant/barbershop ID selects no authority by itself.
- Resolve identity and tenant through trusted authorization before evaluating access.
- Direct calls to operational RPCs must obey future enforcement, including SECURITY DEFINER paths.
- Direct table mutations must also be covered if their capability is restricted; protecting only HTTP endpoints or RPC consumers is insufficient.
- A write decision and mutation must avoid TOCTOU at the appropriate transactional boundary, including concurrent administrative commercial changes.
- Preserve all operational RBAC, RLS, ACLs and tenant isolation independently of commercial decisions.

040 adds only `private.resolve_tenant_entitlements(uuid)`, SECURITY INVOKER,
VOLATILE, with `search_path=pg_catalog`. PUBLIC, anon, authenticated and
service_role have no EXECUTE. No table grant, policy, public RPC or endpoint is
added. Trusted administration supplies a verified tenant; this private helper
does not resolve browser identity. A cached result cannot authorize a later write.

041 makes the administrative writer from 038 acquire the existing 027 tenant
advisory transaction lock before validation and UPSERT. This also serializes
the first subscription against appointment writers when no subscription row
exists (`unassigned`). Commit/rollback releases the lock naturally. The helper
requires READ COMMITTED; no global isolation configuration changes.

This reduces the coordination TOCTOU gap, but is not enforcement: appointment
writers still never consult 040. A future entitlement evaluation must happen
after acquiring locks, in the same transaction as creation. Locks do not freeze
the clock; the decision instant versus commit-time expiry needs explicit policy.
Direct administrative commercial SQL must follow the same protocol. For batches,
acquire all tenant locks in sorted order before row locks; existing row-trigger
lock inversions can still produce aborted deadlocks. No new mutex is introduced.

## Bootstrap and protected access

Never use commercial gating to prevent Auth, callback, necessary onboarding,
tenant resolution, essential bootstrap, reading the owner's own commercial state,
or necessary support/history access. These paths retain their existing
authorization requirements; preserving them grants no new access to another role.

Do not encode commercial suspension in `profile.active` or `barbershop.active`.
Do not make the entire dashboard depend on a commercial resolver succeeding.

## Failure policy

In the current observational phase, commercial failures do not affect operations.
Before enforcement, explicitly approve failure behavior per capability, including
unavailable resolution and stale results. Do not introduce a global accidental
block, a silent authorization bypass, or a conversion of errors to `unassigned`.
This document does not choose a universal fail-open/fail-closed policy.

## Rollout and next phases

Before restricting unassigned or existing tenants: inventory tenants, define
commercial conditions, communicate them, explicitly assign state, test the
policy, then roll out in a controlled and reversible manner. No automatic
backfill or restriction is part of this contract.

1. Commercial access policy documented.
2. 040 implements the private resolver; 041 coordinates commercial writes with agenda tenant locks.
3. Current phase: validate coordination and observational behavior without commercial blocking.
4. Introduce enforcement per capability, starting with creation of new demand.

Billing, checkout, payment providers, webhooks and cron remain separate work.
Do not modify 035/037/038/039 to collapse these responsibilities together.

## Decisions required before enforcement

- Approve activation of the observational matrix in operational writers, without automatic persisted transitions.
- Audit service_role's remaining privileged direct INSERT/ALL on appointments before claiming complete enforcement; 041 does not revoke it or add a commercial trigger.
- Classify reactivation of cancelled/no_show through update_owner_appointment explicitly as new demand or an existing commitment; 041 leaves that RPC unchanged.
- Specify permitted capabilities for each plan and boundaries for existing commitments; no unapproved feature limits are inferred.
- Define per-capability failures, transaction/concurrency behavior and any caching/invalidation contract.
- Approve tenant communication, assignment criteria and reversible rollout procedure.

Validation before enforcement must cover state/time boundaries, unassigned
compatibility, cross-tenant and direct-call attempts, concurrent state changes,
public information minimization, resolver failures, and preserved bootstrap,
history and financial completion. UI tests alone do not prove authorization.
