[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$containerName = 'supabase_db_Job-e-Comiss-es'
$ownerId = '01400000-0000-4000-8000-000000000090'
$barberId = '01400000-0000-4000-8000-000000000091'
$targetBarberId = '11111111-1111-4111-8111-111111111111'
$tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
$targetEmail = 'concurrency-link@example.test'

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
    throw "Local profile linking SQL failed with exit code $exitCode."
  }
  return ($output | Out-String).Trim()
}

$runningContainer = & docker ps --filter "name=^/$containerName$" --format '{{.Names}}'
if ($LASTEXITCODE -ne 0 -or $runningContainer -ne $containerName) {
  throw 'The isolated local Supabase database must be running before this test.'
}

$cleanupSql = "delete from auth.users where id in ('$ownerId', '$barberId');"

try {
  Invoke-LocalSql -Sql $cleanupSql | Out-Null
  Invoke-LocalSql -Sql @"
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('$ownerId', 'authenticated', 'authenticated', 'concurrency-owner-link@example.test', pg_catalog.jsonb_build_object('role', 'owner'), now(), now()),
  ('$barberId', 'authenticated', 'authenticated', '$targetEmail', pg_catalog.jsonb_build_object('role', 'barber'), now(), now());
update public.profiles set barbershop_id = '$tenantId' where id = '$ownerId';
"@ | Out-Null

  $callSql = @"
begin;
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object('sub', '$ownerId', 'role', 'authenticated')::text, true);
select profile_id from public.link_barber_profile_by_email('$targetEmail', '$targetBarberId');
commit;
"@

  $jobScript = {
    param($Container, $Sql)
    $output = & docker exec $Container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc $Sql 2>&1
    [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($output | Out-String) }
  }
  $jobs = @(
    Start-Job -ArgumentList $containerName, $callSql -ScriptBlock $jobScript
    Start-Job -ArgumentList $containerName, $callSql -ScriptBlock $jobScript
  )
  $results = $jobs | Wait-Job | Receive-Job
  $jobs | Remove-Job -Force

  if (@($results | Where-Object ExitCode -ne 0).Count -ne 0) {
    throw 'A concurrent profile linking call failed.'
  }

  $invariants = Invoke-LocalSql -Sql @"
select
  (select count(*) from public.profiles where id = '$barberId') || '|' ||
  (select count(*) from public.profiles where id = '$barberId' and role = 'barber' and active = true and barbershop_id = '$tenantId' and barber_id = '$targetBarberId');
"@
  if ($invariants -ne '1|1') {
    throw "Profile linking concurrency invariants failed: $invariants"
  }

  Write-Output 'Profile linking concurrency validation passed.'
}
finally {
  Invoke-LocalSql -Sql $cleanupSql | Out-Null
}
