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

4. From the temporary validated backup directory, restore with the PostgreSQL client in one transaction. Review `roles.sql` first and follow current Supabase guidance for conflicts with managed local roles; do not edit the retained backup copy.

```powershell
& psql `
  --single-transaction `
  --variable ON_ERROR_STOP=1 `
  --file '.\roles.sql' `
  --file '.\schema.sql' `
  --command 'SET session_replication_role = replica' `
  --file '.\data.sql' `
  --dbname $localDbUrl.AbsoluteUri
if ($LASTEXITCODE -ne 0) { throw 'Local restore failed.' }
$localDbUrl = $null
$localStatus = $null
```
5. Do not run `db reset` as part of this rehearsal. The restore target must be disposable and contain no needed data.
6. Run the validation checklist below. A restore is unsuccessful if any check is missing.
7. Stop the local stack with `npx supabase stop`, then securely delete the disposable local environment and temporary dump copy.

The operator must review SQL before execution. Role restoration can conflict with roles managed by the local stack, so this runbook intentionally does not automate `psql` or bypass errors.

## Restore validation

- Confirm migrations `001` through `012` are represented and the restored schema matches the versioned migrations.
- Inventory expected tables, functions, triggers, indexes, foreign keys, unique constraints, and check constraints.
- Confirm RLS is enabled where versioned and compare policies, grants, and RPC execution privileges with the canonical migrations.
- Compare per-table row counts with a separately recorded, access-controlled backup inventory; include `appointments`, `profiles`, `barbers`, `services`, and `financial_records`.
- Confirm each completed financial appointment has exactly one `financial_records` row, the tenant matches, and `appointments.financial_record_id` is linked.
- Validate Auth users and required Auth metadata separately. The regular schema dump excludes the managed `auth` schema.
- Confirm `barbershop-branding` bucket metadata, public flag, 5 MB limit, MIME types, and four tenant-scoped policies.
- Confirm every expected physical branding object exists and its independently recorded hash matches.
- Run `npx supabase test db --local supabase/tests`, `npm run check`, and a local smoke test without real data.
- Confirm test fixtures rolled back and no backup files were created inside the repository.

## Storage backup

The database dump can preserve database metadata, but it does not contain the physical objects served by the Storage API. Back up `barbershop-branding` separately to private encrypted off-site storage using a reviewed, operator-run export process outside this repository.

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
