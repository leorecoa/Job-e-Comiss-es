param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^validation_[a-z0-9_]+$')]
    [string]$Database
)
$ErrorActionPreference = 'Stop'
# Local Docker only. Require a disposable database, never the normal postgres DB.
$container = 'supabase_db_Job-e-Comiss-es'
$tenant = 'eeee4141-0000-4000-8000-000000000001'
$other = 'eeee4141-0000-4000-8000-000000000002'
$plan = 'coordination_concurrency_041'

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
function End-Session($Session, [string]$End = 'commit') {
    if (-not $Session.Process.HasExited) {
        $Session.Process.StandardInput.WriteLine("$End;`n\q")
        $Session.Process.StandardInput.Close()
    }
    if (-not $Session.Process.WaitForExit(15000)) { throw 'Local session did not finish.' }
    $output = $Session.Output.GetAwaiter().GetResult()
    $errorText = $Session.Error.GetAwaiter().GetResult()
    if ($Session.Process.ExitCode -ne 0) { throw "Local session failed: $errorText" }
    return $output
}

$gate = "select private.lock_availability_tenants(array['$tenant'::uuid]);"
$observe = "$gate select 'observed:'||coalesce((select status from public.tenant_subscriptions where barbershop_id='$tenant'),'unassigned');"
$cases = @(
    @{ Name='tenant-first/initial'; Seed=$false; First=$gate; Second=(Write-State $tenant 'active'); End='commit'; Expected='active' },
    @{ Name='tenant-first/update'; Seed=$true; First=$gate; Second=(Write-State $tenant 'active'); End='commit'; Expected='active' },
    @{ Name='commercial-first/initial'; Seed=$false; First=(Write-State $tenant 'paused'); Second=$observe; End='commit'; Expected='paused'; Observed='paused' },
    @{ Name='commercial-first/update'; Seed=$true; First=(Write-State $tenant 'paused'); Second=$observe; End='commit'; Expected='paused'; Observed='paused' },
    @{ Name='rollback/initial'; Seed=$false; First=(Write-State $tenant 'paused'); Second=$observe; End='rollback'; Expected='unassigned'; Observed='unassigned' },
    @{ Name='rollback/update'; Seed=$true; First=(Write-State $tenant 'paused'); Second=$observe; End='rollback'; Expected='pending'; Observed='pending' },
    @{ Name='commercial/commercial'; Seed=$false; First="select private.set_tenant_subscription('$tenant','$plan','trialing','2030-01-01Z','2030-01-31Z','2030-01-01Z','2030-02-01Z');"; Second=(Write-State $tenant 'active'); End='commit'; Expected='active' },
    @{ Name='different-tenants'; Seed=$false; First=(Write-State $tenant 'paused'); Second=(Write-State $other 'active'); End='commit'; Expected='paused'; Independent=$true }
)
$existing = Invoke-LocalSql "select (select count(*) from public.barbershops where id in ('$tenant','$other'))+(select count(*) from public.commercial_plans where code='$plan');"
if ($existing -ne '0') { throw 'Fixture already exists; refusing to overwrite or clean it.' }
$setupDone = $false
try {
    Invoke-LocalSql @"
begin;
insert into public.barbershops(id,name,slug) values
('$tenant','Commercial coordination fixture','commercial-coordination-041-a'),
('$other','Commercial coordination fixture','commercial-coordination-041-b');
insert into public.commercial_plans(code,name) values('$plan','Coordination fixture');
commit;
"@ | Out-Null
    $setupDone = $true
    if ((Invoke-LocalSql "show transaction_isolation;") -ne 'read committed') { throw 'READ COMMITTED required.' }
    foreach ($case in $cases) {
        Invoke-LocalSql "delete from public.tenant_subscriptions where barbershop_id in ('$tenant','$other');" | Out-Null
        if ($case.Seed) { Invoke-LocalSql (Write-State $tenant 'pending') | Out-Null }
        $first = $null
        $second = $null
        try {
            $first = Start-Session 'commercial-041-holder' $case.First
            Wait-Condition "select exists(select 1 from pg_stat_activity where datname=current_database() and application_name='commercial-041-holder' and state='idle in transaction');" 'holder completed its statement and retains transaction locks'
            $second = Start-Session 'commercial-041-waiter' $case.Second
            if ($case.Independent) {
                Wait-Condition "select exists(select 1 from pg_stat_activity where datname=current_database() and application_name='commercial-041-waiter' and state='idle in transaction');" 'different tenant completes before holder release'
                $secondOutput = End-Session $second
                if ((Invoke-LocalSql "select exists(select 1 from pg_stat_activity where datname=current_database() and application_name='commercial-041-holder' and state='idle in transaction');") -ne 't') { throw 'Holder ended too early.' }
                if ((Invoke-LocalSql "select status from public.tenant_subscriptions where barbershop_id='$other';") -ne 'active') { throw 'Independent tenant did not commit.' }
                End-Session $first $case.End | Out-Null
            } else {
                Wait-Condition "select exists(select 1 from pg_stat_activity w join pg_stat_activity h on h.pid=any(pg_blocking_pids(w.pid)) where w.datname=current_database() and h.datname=current_database() and w.application_name='commercial-041-waiter' and h.application_name='commercial-041-holder' and w.wait_event_type='Lock' and w.wait_event='advisory');" 'same-tenant advisory wait with the actual holder as blocker'
                End-Session $first $case.End | Out-Null
                $secondOutput = End-Session $second
            }
            if ($case.Observed -and $secondOutput -notmatch "observed:$($case.Observed)\b") { throw "Post-lock snapshot was stale: $secondOutput" }
            $final = Invoke-LocalSql "select coalesce((select status from public.tenant_subscriptions where barbershop_id='$tenant'),'unassigned');"
            if ($final -ne $case.Expected) { throw "Wrong state after $($case.Name): $final" }
            $count = Invoke-LocalSql "select count(*) from public.tenant_subscriptions where barbershop_id='$tenant';"
            $expectedCount = if ($case.Expected -eq 'unassigned') { '0' } else { '1' }
            if ($count -ne $expectedCount) { throw 'Unexpected subscription cardinality.' }
            if ((Invoke-LocalSql "select not exists(select 1 from public.tenant_subscriptions where barbershop_id in ('$tenant','$other') and (plan_code<>'$plan' or trial_started_at is not null or trial_ends_at is not null or current_period_started_at is not null or current_period_ends_at is not null or updated_at<created_at));") -ne 't') { throw 'Partial state or timestamps after replacement.' }
            Write-Output "PASS $($case.Name): coordinated progress; final=$final; rows=$count"
        } finally {
            foreach ($session in @($first,$second)) {
                if ($session) {
                    try { End-Session $session 'rollback' | Out-Null } finally { $session.Process.Dispose() }
                }
            }
        }
    }
    try {
        $ErrorActionPreference = 'Continue'
        $isolation = & docker exec $container psql -X -U postgres -d $Database -v ON_ERROR_STOP=1 -Atc "begin isolation level repeatable read; $(Write-State $tenant 'active')" 2>&1
        $isolationExit = $LASTEXITCODE
    } finally { $ErrorActionPreference = 'Stop' }
    if ($isolationExit -eq 0 -or ($isolation -join ' ') -notmatch 'AVAILABILITY_REQUIRES_READ_COMMITTED') { throw 'Unsupported isolation did not fail explicitly.' }
    Write-Output 'PASS READ COMMITTED precondition: REPEATABLE READ rejected without global configuration changes.'
} finally {
    if ($setupDone) {
        Invoke-LocalSql "begin; delete from public.tenant_subscriptions where barbershop_id in ('$tenant','$other'); delete from public.commercial_plans where code='$plan'; delete from public.barbershops where id in ('$tenant','$other'); commit;" | Out-Null
    }
}
