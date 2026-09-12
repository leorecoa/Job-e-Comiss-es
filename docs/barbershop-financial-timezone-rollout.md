# Financial timezone configuration

This release only persists an owner-confirmed financial calendar setting. It does
not change reports, completed_at, appointments, booking, financial records or vales.

## Contract and validation

- Migration 021 adds nullable `barbershops.financial_timezone` without a default or backfill.
- The browser suggests a zone; onboarding sends it only after the explicit checkbox.
  Settings require the explicit confirmation/save button. Reads/login never write it.
- `Intl.DateTimeFormat` provides preliminary validation. The database trigger is
  authoritative for all inserts/updates, including direct PostgREST updates.
- The trigger checks exact membership in `pg_catalog.pg_timezone_names`, excluding
  `posix/` and `right/` implementation namespaces. PostgreSQL tzdb names and aliases
  are accepted, not arbitrary offset/POSIX strings. There is no manual timezone list.
  Browser/server tzdb versions can differ; server rejection is shown as a friendly error.
  Reference: https://www.postgresql.org/docs/17/view-pg-timezone-names.html
- The original eight-argument creation RPC is unchanged. The nine-argument overload
  has no defaults: it delegates authentication, owner checks, profile locking and
  tenant creation to the original RPC, then saves the timezone in the same transaction.
  Invalid timezone rolls back tenant creation and the profile link.
- Existing owner-only tenant RLS controls updates; no policy is added or relaxed.
  Anon retains SELECT on all pre-existing columns, not the new financial setting.
  Only authenticated receives EXECUTE on the overload; PUBLIC/anon/service_role do not.
- Local settings/localStorage are not a remote source of truth. Unconfirmed tenants
  remain null and operational. No timezone is inferred from addresses or defaulted.

## Manual rollout

1. Review migration 021 and pgTAP in an isolated local stack. Execute
   `npx supabase db reset --local` and `npx supabase test db --local supabase/tests`.
2. Run `npm run typecheck`, `npm run check`, `npm run build`,
   `npm audit --audit-level=moderate`, the owner Playwright suite and `git diff --check`.
3. Inspect existing grants/columns before remote approval. Apply SQL manually only
   after review, before deploying a frontend that selects the new column.
4. Validate the migration's final booleans and existing null values. No backfill.
5. In controlled Preview, confirm a suggested zone, reload/login, edit the zone,
   test an invalid input and cross-tenant denial. Verify public branding still loads.
6. Roll back the frontend if needed; keep the additive column and confirmed data.
   Old onboarding clients continue creating null. Do not drop data during rollback.

An IANA timezone is saved as a name, never as the current UTC offset. This release
does not reinterpret historical periods. Changing report semantics or deciding how
future timezone changes affect historical closings requires a separate product decision.
