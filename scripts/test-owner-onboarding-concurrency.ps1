[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$containerName = 'supabase_db_Job-e-Comiss-es'
$userId = '01300000-0000-4000-8000-000000000099'

function Invoke-LocalSql {
  param([Parameter(Mandatory = $true)][string]$Sql)

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $output = & docker exec $containerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc $Sql 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($exitCode -ne 0) {
    throw "Local concurrency SQL failed with exit code $exitCode."
  }
  return ($output | Out-String).Trim()
}

$runningContainer = & docker ps --filter "name=^/$containerName$" --format '{{.Names}}'
if ($LASTEXITCODE -ne 0 -or $runningContainer -ne $containerName) {
  throw 'The isolated local Supabase database must be running before this test.'
}

$cleanupSql = @"
delete from auth.users where id = '$userId';
delete from public.barbershops where slug in ('concurrency-owner-a', 'concurrency-owner-b');
"@

try {
  Invoke-LocalSql -Sql $cleanupSql | Out-Null
  Invoke-LocalSql -Sql @"
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('$userId', 'authenticated', 'authenticated', 'concurrency-owner@example.test', pg_catalog.jsonb_build_object('role', 'owner'), now(), now());
"@ | Out-Null

  $callTemplate = @"
begin;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub', '$userId', 'role', 'authenticated')::text, true);
select id from public.create_owner_barbershop('Concurrency Owner', '__SLUG__');
commit;
"@

  $jobScript = {
    param($Container, $Sql)
    $output = & docker exec $Container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc $Sql 2>&1
    [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($output | Out-String) }
  }
  $jobA = Start-Job -ArgumentList $containerName, ($callTemplate.Replace('__SLUG__', 'concurrency-owner-a')) -ScriptBlock $jobScript
  $jobB = Start-Job -ArgumentList $containerName, ($callTemplate.Replace('__SLUG__', 'concurrency-owner-b')) -ScriptBlock $jobScript
  $jobs = @($jobA, $jobB)

  $results = $jobs | Wait-Job | Receive-Job
  $jobs | Remove-Job -Force

  $successes = @($results | Where-Object ExitCode -eq 0)
  $controlledFailures = @($results | Where-Object {
    $_.ExitCode -ne 0 -and $_.Output.Contains('OWNER_ONBOARDING_ALREADY_CONFIGURED')
  })

  if ($successes.Count -ne 1 -or $controlledFailures.Count -ne 1) {
    throw 'Concurrent calls did not produce exactly one success and one controlled rejection.'
  }

  $invariants = Invoke-LocalSql -Sql @"
select
  (select count(*) from public.barbershops where slug in ('concurrency-owner-a', 'concurrency-owner-b')) || '|' ||
  (select count(*) from public.profiles where id = '$userId' and barbershop_id is not null) || '|' ||
  (select count(*) from public.barbershops b where b.slug in ('concurrency-owner-a', 'concurrency-owner-b') and not exists (select 1 from public.profiles p where p.barbershop_id = b.id));
"@

  if ($invariants -ne '1|1|0') {
    throw "Concurrency invariants failed: $invariants"
  }

  Write-Output 'Owner onboarding concurrency validation passed.'
}
finally {
  Invoke-LocalSql -Sql $cleanupSql | Out-Null
}
