$ErrorActionPreference = 'Stop'

$container = docker ps --filter 'name=supabase_db_Job-e-Comiss-es' --format '{{.Names}}' | Select-Object -First 1
if (-not $container) {
  throw 'Supabase local database container is not running.'
}

$phone = '9191111199'
$tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
$barberId = '11111111-1111-4111-8111-111111111111'
$serviceId = '33333333-3333-4333-8333-333333333333'

$seedSql = @"
insert into public.appointments
  (client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, start_at, end_at, status, barbershop_id, created_at)
values
  ('Concurrency Seed One', '$phone', '$barberId', 'Barber Alpha', '$serviceId', 'Service Alpha', 40, date_trunc('minute', now()) + interval '50 days', date_trunc('minute', now()) + interval '50 days 30 minutes', 'scheduled', '$tenantId', now() - interval '2 minutes'),
  ('Concurrency Seed Two', '$phone', '$barberId', 'Barber Alpha', '$serviceId', 'Service Alpha', 40, date_trunc('minute', now()) + interval '51 days', date_trunc('minute', now()) + interval '51 days 30 minutes', 'confirmed', '$tenantId', now() - interval '2 minutes');
"@

$firstSql = @"
begin;
set local role anon;
select public.create_public_appointment('$tenantId', '$barberId', '$serviceId', 'Concurrency Third', '$phone', date_trunc('minute', now()) + interval '52 days', date_trunc('minute', now()) + interval '52 days 30 minutes', null);
reset role;
update public.appointments set created_at = now() - interval '2 minutes' where barbershop_id = '$tenantId' and client_phone = '$phone' and client_name = 'Concurrency Third';
select pg_sleep(2);
commit;
"@

$secondSql = @"
begin;
set local role anon;
select public.create_public_appointment('$tenantId', '$barberId', '$serviceId', 'Concurrency Fourth', '$phone', date_trunc('minute', now()) + interval '53 days', date_trunc('minute', now()) + interval '53 days 30 minutes', null);
rollback;
"@

$cleanupSql = "delete from public.appointments where barbershop_id = '$tenantId' and client_phone = '$phone';"

try {
  docker exec $container psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c $seedSql | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not seed concurrency fixtures.' }

  $first = Start-Job -ScriptBlock {
    param($containerName, $sql)
    $output = docker exec $containerName psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c $sql 2>&1
    [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($output -join "`n") }
  } -ArgumentList $container, $firstSql

  Start-Sleep -Milliseconds 300
  $timer = [System.Diagnostics.Stopwatch]::StartNew()
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $secondOutput = docker exec $container psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c $secondSql 2>&1
  $secondExitCode = $LASTEXITCODE
  $ErrorActionPreference = $previousErrorActionPreference
  $timer.Stop()

  $firstResult = Receive-Job -Job (Wait-Job -Job $first)
  Remove-Job -Job $first

  if ($firstResult.ExitCode -ne 0) { throw "First concurrent call failed: $($firstResult.Output)" }
  if ($secondExitCode -eq 0 -or ($secondOutput -join "`n") -notmatch 'PUBLIC_APPOINTMENT_ACTIVE_LIMIT') {
    throw 'Second concurrent call did not return PUBLIC_APPOINTMENT_ACTIVE_LIMIT.'
  }
  if ($timer.ElapsedMilliseconds -lt 1200) {
    throw 'Second concurrent call did not wait for the transaction-level advisory lock.'
  }

  Write-Output 'Concurrent public booking calls were serialized and the fourth active appointment was blocked.'
} finally {
  docker exec $container psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c $cleanupSql | Out-Null
}
