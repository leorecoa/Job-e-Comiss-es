$ErrorActionPreference = 'Stop'

$container = docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | Select-Object -First 1
if (-not $container) {
  throw 'Supabase local database container is not running.'
}

$userId = '99990000-0000-4000-8000-000000000001'
$appointmentId = '99990000-0000-4000-8000-000000000002'
$tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
$barberId = '11111111-1111-4111-8111-111111111111'
$serviceId = '33333333-3333-4333-8333-333333333333'

$seedSql = @"
insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('$userId', 'authenticated', 'authenticated', 'financial-concurrency@example.test', now(), now());
insert into public.profiles (id, display_name, role, active, barbershop_id)
values ('$userId', 'Financial Concurrency Owner', 'owner', true, '$tenantId');
insert into public.appointments
  (id, client_name, client_phone, barber_id, barber_name, service_id, service_type, service_value, commission_rate, start_at, end_at, status, barbershop_id)
values
  ('$appointmentId', 'Financial Concurrency', '9199999999', '$barberId', 'Barber Alpha', '$serviceId', 'Service Alpha', 40, 50, now() + interval '70 days', now() + interval '70 days 30 minutes', 'scheduled', '$tenantId');
"@

$firstSql = @"
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '$userId', 'role', 'authenticated')::text, true);
select financial_record_id from public.complete_appointment_with_financial_record('$appointmentId');
select pg_sleep(4);
commit;
"@

$secondSql = @"
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '$userId', 'role', 'authenticated')::text, true);
select financial_record_id from public.complete_appointment_with_financial_record('$appointmentId');
commit;
"@

$cleanupSql = @"
delete from public.financial_records where appointment_id = '$appointmentId';
delete from public.appointments where id = '$appointmentId';
delete from public.profiles where id = '$userId';
delete from auth.users where id = '$userId';
"@

try {
  docker exec $container psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c $seedSql | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not seed financial concurrency fixtures.' }

  $first = Start-Job -ScriptBlock {
    param($containerName, $sql)
    $output = docker exec $containerName psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -Atc $sql 2>&1
    [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($output -join "`n") }
  } -ArgumentList $container, $firstSql

  $firstReady = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $activeSleeps = docker exec $container psql -U supabase_admin -d postgres -Atc "select count(*) from pg_stat_activity where pid <> pg_backend_pid() and state = 'active' and query like '%select pg_sleep(4)%';"
    if ($activeSleeps.Trim() -ge '1') {
      $firstReady = $true
      break
    }
    Start-Sleep -Milliseconds 250
  }
  if (-not $firstReady) { throw 'The first financial completion did not acquire the row lock in time.' }

  $timer = [System.Diagnostics.Stopwatch]::StartNew()
  $secondOutput = docker exec $container psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -Atc $secondSql 2>&1
  $secondExitCode = $LASTEXITCODE
  $timer.Stop()

  $firstResult = Receive-Job -Job (Wait-Job -Job $first)
  Remove-Job -Job $first

  if ($firstResult.ExitCode -ne 0 -or $secondExitCode -ne 0) {
    throw 'A concurrent financial completion call failed.'
  }
  if ($timer.ElapsedMilliseconds -lt 1200) {
    throw 'The second financial completion did not wait for the appointment row lock.'
  }

  $recordCount = docker exec $container psql -U supabase_admin -d postgres -Atc "select count(*) from public.financial_records where appointment_id = '$appointmentId';"
  $linkedId = docker exec $container psql -U supabase_admin -d postgres -Atc "select financial_record_id from public.appointments where id = '$appointmentId';"
  if ($recordCount.Trim() -ne '1' -or -not $linkedId.Trim()) {
    throw 'Concurrent completion did not preserve exactly one linked financial record.'
  }

  Write-Output 'Concurrent financial completions returned one linked financial record after row serialization.'
} finally {
  docker exec $container psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c $cleanupSql | Out-Null
}
