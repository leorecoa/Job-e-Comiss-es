param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^validation_[a-z0-9_]+$')]
    [string]$Database
)
$ErrorActionPreference = 'Stop'
# Local Docker only. Require a disposable database, never the normal postgres DB.
$container = 'supabase_db_Job-e-Comiss-es'
$tenant = 'eeee4242-0000-4000-8000-000000000001'
$plan = 'public_booking_concurrency_042'

function Invoke-LocalSql([string]$Sql) {
    $result = & docker exec $container psql -X -U postgres -d $Database -v ON_ERROR_STOP=1 -Atc $Sql
    if ($LASTEXITCODE -ne 0) { throw 'Local SQL failed.' }
    return $result
}
function Write-State([string]$TenantId, [string]$Status) {
    return "select private.set_tenant_subscription('$TenantId','$plan','$Status',null,null,null,null);"
}
function Start-Session([string]$Name, [string]$Sql) {
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = 'docker'
    $info.Arguments = "exec -i $container psql -X -qAt -U postgres -d $Database -v ON_ERROR_STOP=1"
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardInput = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    [void]$process.Start()
    $session = @{ Process = $process; Output = $process.StandardOutput.ReadToEndAsync(); Error = $process.StandardError.ReadToEndAsync() }
    $process.StandardInput.WriteLine("begin; set local statement_timeout='15s'; set local application_name='$Name'; $Sql")
    $process.StandardInput.Flush()
    return $session
}
function Wait-Condition([string]$Sql, [string]$Description) {
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($watch.Elapsed.TotalSeconds -lt 10) {
        if ((Invoke-LocalSql $Sql) -eq 't') { return }
        Start-Sleep -Milliseconds 100
    }
    throw "Condition not observed: $Description"
}
function End-Session($Session, [string]$End = 'commit', [string]$ExpectedError = '') {
    if (-not $Session.Process.HasExited) {
        $Session.Process.StandardInput.WriteLine("$End;`n\q")
        $Session.Process.StandardInput.Close()
    }
    if (-not $Session.Process.WaitForExit(15000)) { throw 'Local session did not finish.' }
    $output = $Session.Output.GetAwaiter().GetResult()
    $errorText = $Session.Error.GetAwaiter().GetResult()
    if ($ExpectedError) {
        if ($Session.Process.ExitCode -eq 0 -or $errorText -notmatch [regex]::Escape($ExpectedError)) { throw "Expected $ExpectedError, got: $errorText $output" }
    } elseif ($Session.Process.ExitCode -ne 0) { throw "Local session failed: $errorText" }
    return $output
}
$barber = 'eeee4242-0000-4000-8000-000000000010'
$service = 'eeee4242-0000-4000-8000-000000000020'
$gate = "select private.lock_availability_tenants(array['$tenant'::uuid]);"
$booking = "set local role service_role; select public.create_public_appointment('$tenant','$barber','$service','Concurrency fixture','11999999999','2035-01-08T09:00Z','2035-01-08T09:30Z');"
$denied = 'PUBLIC_APPOINTMENT_COMMERCIAL_UNAVAILABLE'
$cases = @(
    @{ Name='booking-first/unassigned'; First=$booking; Second=(Write-State $tenant 'paused'); End='commit'; Expected='paused'; Rows=1 },
    @{ Name='booking-first/active'; Seed='active'; First=$booking; Second=(Write-State $tenant 'paused'); End='commit'; Expected='paused'; Rows=1 },
    @{ Name='commercial-first/initial'; First=(Write-State $tenant 'paused'); Second=$booking; End='commit'; Expected='paused'; Rows=0; Error=$denied },
    @{ Name='commercial-first/update'; Seed='active'; First=(Write-State $tenant 'paused'); Second=$booking; End='commit'; Expected='paused'; Rows=0; Error=$denied },
    @{ Name='commercial-first/enable'; Seed='pending'; First=(Write-State $tenant 'active'); Second=$booking; End='commit'; Expected='active'; Rows=1 },
    @{ Name='rollback/initial'; First=(Write-State $tenant 'paused'); Second=$booking; End='rollback'; Expected='unassigned'; Rows=1 },
    @{ Name='rollback/update'; Seed='active'; First=(Write-State $tenant 'paused'); Second=$booking; End='rollback'; Expected='active'; Rows=1 },
    @{ Name='trial-expires-while-waiting'; Trial=$true; First=$gate; Second=$booking; End='commit'; Expected='trialing'; Rows=0; Error=$denied },
    @{ Name='resolver-database-timeout'; First='lock table public.tenant_subscriptions in access exclusive mode;'; Second="set local lock_timeout='4s'; $booking"; End='rollback'; Expected='unassigned'; Rows=0; Error='canceling statement due to lock timeout'; DbError=$true }
)
$existing = Invoke-LocalSql "select (select count(*) from public.barbershops where id='$tenant')+(select count(*) from public.commercial_plans where code='$plan')+(select count(*) from public.barbers where id='$barber')+(select count(*) from public.services where id='$service');"
if ($existing -ne '0') { throw 'Fixture collision; refusing to overwrite or clean it.' }
$setupDone = $false
try {
    Invoke-LocalSql @"
begin;
insert into public.barbershops(id,name,slug,operational_timezone,slot_step_minutes,business_hours)
select '$tenant','Concurrency fixture','public-entitlement-concurrency-042','UTC',30,
jsonb_object_agg(d,jsonb_build_object('active',true,'open','09:00','close','18:00'))
from unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday']) d;
insert into public.barbers(id,name,barbershop_id) values('$barber','Fixture barber','$tenant');
insert into public.services(id,name,barbershop_id,price,duration_minutes,commission_rate) values('$service','Fixture service','$tenant',50,30,40);
insert into public.commercial_plans(code,name) values('$plan','Concurrency fixture');
commit;
"@ | Out-Null
    $setupDone = $true
    foreach ($case in $cases) {
        Invoke-LocalSql "begin; delete from public.appointments where barbershop_id='$tenant'; delete from public.tenant_subscriptions where barbershop_id='$tenant'; commit;" | Out-Null
        if ($case.Seed) { Invoke-LocalSql (Write-State $tenant $case.Seed) | Out-Null }
        if ($case.Trial) {
            Invoke-LocalSql "select private.set_tenant_subscription('$tenant','$plan','trialing',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '8 seconds',null,null);" | Out-Null
            if ((Invoke-LocalSql "select can_accept_public_booking from private.resolve_tenant_entitlements('$tenant');") -ne 't') { throw 'Trial was not valid before waiting.' }
        }
        $first = $null
        $second = $null
        try {
            $first = Start-Session 'public-042-holder' $case.First
            Wait-Condition "select exists(select 1 from pg_stat_activity where datname=current_database() and application_name='public-042-holder' and state='idle in transaction');" 'holder retains transaction locks'
            $second = Start-Session 'public-042-waiter' $case.Second
            $event = if ($case.DbError) { 'relation' } else { 'advisory' }
            Wait-Condition "select exists(select 1 from pg_stat_activity w join pg_stat_activity h on h.pid=any(pg_blocking_pids(w.pid)) where w.datname=current_database() and h.datname=current_database() and w.application_name='public-042-waiter' and h.application_name='public-042-holder' and w.wait_event_type='Lock' and w.wait_event='$event');" 'waiter blocked by actual holder'
            if ($case.Trial) {
                if ((Invoke-LocalSql "select clock_timestamp()<trial_ends_at from public.tenant_subscriptions where barbershop_id='$tenant';") -ne 't') { throw 'Trial expired before the observed wait.' }
                Wait-Condition "select clock_timestamp()>=trial_ends_at from public.tenant_subscriptions where barbershop_id='$tenant';" 'real trial expiry while booking is blocked'
            }
            if ($case.DbError) {
                # Keep the table lock until the resolver query actually times out.
                End-Session $second 'commit' $case.Error | Out-Null
                $errorText = $second.Error.GetAwaiter().GetResult()
                if ($errorText -notmatch 'resolve_tenant_entitlements') { throw "Failure did not occur inside resolver: $errorText" }
                End-Session $first $case.End | Out-Null
            } else {
                End-Session $first $case.End | Out-Null
                End-Session $second 'commit' $case.Error | Out-Null
            }
            $final = Invoke-LocalSql "select coalesce((select status from public.tenant_subscriptions where barbershop_id='$tenant'),'unassigned');"
            if ($final -ne $case.Expected) { throw "Unexpected state: $final" }
            $count = Invoke-LocalSql "select count(*) from public.appointments where barbershop_id='$tenant';"
            if ($count -ne [string]$case.Rows) { throw "Unexpected appointment count: $count" }
            Write-Output "PASS $($case.Name): state=$final appointments=$count"
        } finally {
            foreach ($session in @($first,$second)) {
                if ($session) {
                    try {
                        if (-not $session.Process.HasExited) { End-Session $session 'rollback' | Out-Null }
                    } finally { $session.Process.Dispose() }
                }
            }
        }
    }
} finally {
    if ($setupDone) {
        Invoke-LocalSql "begin; delete from public.appointments where barbershop_id='$tenant'; delete from public.tenant_subscriptions where barbershop_id='$tenant'; delete from public.services where id='$service'; delete from public.barbers where id='$barber'; delete from public.commercial_plans where code='$plan'; delete from public.barbershops where id='$tenant'; commit;" | Out-Null
    }
}
