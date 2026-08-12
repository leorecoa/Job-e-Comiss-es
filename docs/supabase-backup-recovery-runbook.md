# Supabase Backup and Recovery Runbook

## Scope and targets

This runbook covers manual logical backups for the Supabase Free plan. Free projects do not provide downloadable daily backups or PITR, so this process targets an RPO of 24 hours and an RTO of 4 hours for the pilot. Also create a backup before every migration or release.

Database dumps contain sensitive and personal data. They must stay outside this repository in private, encrypted off-site storage. Never commit a dump, manifest containing operational identifiers, database URL, or password.

## Create a logical backup

Prerequisites: Docker Desktop, repository dependencies installed from the lockfile, and a database connection URL obtained manually from the Supabase Connect panel. Stop if a new credential must be created or reset. Do not use `link`, `--linked`, `db pull`, `db push`, or any restore command.

In a fresh PowerShell process, use an output directory outside the repository:

```powershell
$env:SUPABASE_DB_URL = '<session-pooler-or-direct-connection-url>'
.\scripts\backup-supabase-logical.ps1 -OutputDirectory 'D:\PrivateBackups\Job-e-Comissoes'
Remove-Item Env:\SUPABASE_DB_URL
```

The script pins the installed Supabase CLI to `2.113.0`, does not print the connection, refuses repository paths and existing timestamped directories, and creates:

- `roles.sql`: cluster roles;
- `schema.sql`: application schema;
- `data.sql`: data using `COPY`, excluding managed vector artifacts `storage.buckets_vectors` and `storage.vector_indexes`;
- `manifest.json`: UTC timestamp, CLI version, byte sizes, and SHA-256 hashes.

The CLI excludes Supabase-managed schemas from the normal schema dump. Auth and Storage still require the explicit checks below. A successful database dump is not proof that physical Storage objects were copied.

Validate immediately and again after every transfer:

```powershell
.\scripts\test-supabase-backup-integrity.ps1 -BackupDirectory 'D:\PrivateBackups\Job-e-Comissoes\job-e-comissoes-YYYYMMDDTHHMMSSZ'
```

## Restore rehearsal: local only

Restoration is exclusively a manual rehearsal in a new, isolated local Supabase stack. Never supply `--linked`, a production `--db-url`, or a remote connection. Stop before any command if the target cannot be positively identified as local.

1. Copy the selected backup from encrypted storage to a temporary directory outside the repository and validate its hashes.
2. Start a clean local stack with `npx supabase start`. Capture its status in memory; do not print or persist the result because it contains local credentials.
3. Resolve the local database URL from the status JSON and require a loopback host before continuing:

```powershell
$localStatus = npx supabase status -o json | ConvertFrom-Json
$localDbUrl = [uri]$localStatus.DB_URL
if ($localDbUrl.Host -notin @('127.0.0.1', 'localhost', '::1')) {
  throw 'Restore target is not local.'
}
```

4. Review `roles.sql` before execution. Never edit the retained backup. Create a temporary derived copy that omits exactly these four known `ALTER ROLE` statements for roles managed by the local Supabase stack:

- `anon`;
- `authenticated`;
- `authenticator`;
- `supabase_admin`.

The derived file must contain no other `ALTER ROLE`. Stop if the source contains another role or command requiring omission, or if the review cannot prove that only those four statements changed. Record only the sanitized review result, never SQL contents or identifiers.

5. From the temporary validated backup directory, restore the derived roles file, schema, and data with the PostgreSQL client in one transaction. Keep commands short to reduce PowerShell paste errors:

```powershell
& psql `
  --single-transaction `
  --variable ON_ERROR_STOP=1 `
  --file '.\roles.local.sql' `
  --file '.\schema.sql' `
  --command 'SET session_replication_role = replica' `
  --file '.\data.sql' `
  --dbname $localDbUrl.AbsoluteUri
if ($LASTEXITCODE -ne 0) { throw 'Local restore failed.' }
```

Any failure under `--single-transaction` must roll back the entire restore. Stop, preserve sanitized error evidence, verify rollback, and review the cause; never continue with a partially restored database.

6. The normal dump excludes DDL from the managed Storage schema. For the current application state, restore the canonical branding policies locally only after reconfirming the loopback target and verifying these exact migration hashes:

```text
20260809000600_storage_policies.sql
9F2F826D0C0DCA606B0D955F78A5DA7984DDD9BE2E30C817BC41E9753FB07006

20260809000900_consolidate_branding_storage_policies.sql
70886489E3A694F57F13C577FDFC08FABC75840067E15CFD926538D6BCBA0AB2
```

Apply those two reviewed files with `psql` only to `$localDbUrl.AbsoluteUri`, in migration order. Stop on a hash mismatch, non-loopback destination, or SQL failure. Do not use `db reset`, `migration repair`, `--linked`, or `--db-url`. The absence of `supabase_migrations` from the logical dump is expected and does not authorize history repair.

7. Run the validation checklist below. A rehearsal is not fully approved if any required check is missing.
8. Clear connection values from memory, stop without creating a local backup, and securely discard the temporary environment and derived files:

```powershell
$localDbUrl = $null
$localStatus = $null
npx supabase stop --no-backup
```

Keep the original backup intact. This runbook intentionally does not automate restore or bypass review gates.

## Restore validation

- Confirm migrations `001` through `012` are represented and the restored schema matches the versioned migrations.
- Inventory expected tables, functions, triggers, indexes, foreign keys, unique constraints, and check constraints.
- Confirm RLS is enabled where versioned and compare policies, grants, and RPC execution privileges with the canonical migrations.
- Compare per-table row counts with a separately recorded, access-controlled backup inventory; include `appointments`, `profiles`, `barbers`, `services`, and `financial_records`.
- Confirm each completed financial appointment has exactly one `financial_records` row, the tenant matches, and `appointments.financial_record_id` is linked.
- Validate Auth users and identities separately. The final aggregate query must report `users_without_identity = 0` and `orphan_identities = 0`:

```sql
select
  count(*) filter (where i.user_id is null) as users_without_identity,
  (select count(*)
   from auth.identities orphan
   left join auth.users u on u.id = orphan.user_id
   where u.id is null) as orphan_identities
from auth.users u
left join auth.identities i on i.user_id = u.id;
```

- Confirm `barbershop-branding` bucket metadata, public flag, 5 MB limit, MIME types, and exactly four canonical tenant-scoped policies on `storage.objects`.
- Confirm every expected physical branding object exists and its independently recorded hash matches.
- Run `npx supabase test db --local supabase/tests`, `npm run check`, and a local smoke test without real data.
- Confirm test fixtures rolled back and no backup files were created inside the repository.

## Verified rehearsal: 2026-08-12

The first real local rehearsal is partially approved. Manifest, sizes, SHA-256, loopback destination, disposable PostgreSQL health, database restore, `public` and `private` schemas, six expected public tables with RLS, RPCs, Auth users, tenant integrity, financial integrity, bucket metadata, and the four canonical branding policies passed. The legacy public view remained absent, and `anon` retained no direct `SELECT` or `INSERT` on `appointments`.

The initial single-transaction attempt failed on `ALTER ROLE` for the four managed roles listed above and rolled back completely. A temporary derived roles file omitted exactly those four reviewed statements and contained no other `ALTER ROLE`; the original backup remained unchanged. The derived roles, schema, and data then restored successfully in one transaction.

The dump did not contain `supabase_migrations`, which is expected, and no repair was performed. The normal structural dump also did not recreate the `storage.objects` policies; after confirming the loopback target and the hashes above, canonical migrations 006 and 009 restored exactly four policies locally.

Auth users were restored, but the final `auth.identities` evidence was not recorded before cleanup. Treat both aggregate Auth results as mandatory gates in every future rehearsal; this rehearsal does not claim they passed. Metadata for six Storage objects was restored, but physical bytes are outside the logical dump and remain an open recovery dependency.

The stack was stopped with `--no-backup`, the temporary environment and derived file were deleted, the retained backup remained intact, and no remote connection was configured. Store only sanitized outcomes like these; never record dump contents or personal data.

## Storage backup

The database dump can preserve database metadata, but it does not contain the physical objects served by the Storage API. Back up `barbershop-branding` separately to private encrypted off-site storage using a reviewed, operator-run export process outside this repository.

A successful database restore is not a complete recovery. Completion requires the separately exported physical objects, verified against their private encrypted manifest and hashes.

Maintain an encrypted Storage manifest with bucket, object path, byte size, content type, export timestamp, and SHA-256 for each object. Do not include signed URLs, API keys, or credentials. Validate object count and hashes after export and after restore. Restoring metadata without the matching object bytes is an incomplete recovery.

Storage export may require privileged credentials. This repository does not automate that operation: stop and obtain explicit security review before creating or using a new credential. Never place a `service_role` key in frontend code or versioned files.

## Incident checklist

1. Freeze releases and writes where operationally possible; record the incident time in UTC.
2. Preserve evidence and identify the last known-good backup without modifying it.
3. Validate manifest, sizes, and hashes; select a recovery point and state expected data loss against the 24-hour RPO.
4. Notify the incident owner and obtain approval before any remote recovery action.
5. Rehearse the restore locally and complete every database, Auth, Storage, tenant-isolation, and financial validation.
6. Document the recovery plan, rollback plan, expected downtime, and whether the four-hour RTO remains achievable.
7. Stop here. Production restore is outside this runbook and requires a separately reviewed procedure and explicit approval.
8. After recovery, rotate exposed credentials, validate monitoring, and write a blameless incident review.

## Retention and disposal

Keep 7 daily backups and 4 weekly backups. Keep the most recent pre-migration or pre-release backup until that change is verified and covered by the normal retention window. Store at least one copy off-site in private encrypted storage with least-privilege access and access logging.

Test hash integrity after creation, after transfer, and monthly. Perform a local restore rehearsal at least quarterly and before pilot launch. Securely delete expired dump and Storage copies according to the storage provider's deletion guarantees, including replicas and recycle bins. Record only backup timestamp, outcome, and deletion evidence in operational records; never record credentials or dump contents.

## Free-plan limitations

- There is no project-managed daily backup available for download and no PITR; recovery depends on the last successful manual export.
- A 24-hour schedule can lose up to 24 hours of changes, and backup failure extends that window.
- Logical dumps need separate validation for Auth and Storage, and physical Storage objects require a separate backup.
- The four-hour RTO is a target, not a platform guarantee. Dataset size, credential access, local rehearsal quality, and incident review affect it.
