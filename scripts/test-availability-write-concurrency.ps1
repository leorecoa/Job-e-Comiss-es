$ErrorActionPreference = 'Stop'
$container = 'supabase_db_Job-e-Comiss-es'
$tenant = 'eeee2727-0000-4000-8000-000000000001'
$barber = 'eeee2727-0000-4000-8000-000000000002'
$service = 'eeee2727-0000-4000-8000-000000000003'
$appointment = 'eeee2727-0000-4000-8000-000000000004'
$owner = 'eeee2727-0000-4000-8000-000000000006'

function Invoke-LocalSql([string]$Sql) {
    $result = & docker exec $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc $Sql
    $code = $LASTEXITCODE
    if ($code -ne 0) { throw "Local SQL failed ($code)." }
    return $result
}

$insert = @"
insert into public.appointments(id,barbershop_id,barber_id,barber_name,service_id,service_type,service_value,client_name,client_phone,start_at,end_at,status)
values('$appointment','$tenant','$barber','Concurrency','$service','Concurrency',50,'Local fixture','11999999999','2030-01-07T09:00Z','2030-01-07T09:30Z','scheduled');
"@
$setup = @"
insert into public.barbershops(id,name,slug,operational_timezone,slot_step_minutes,business_hours)
select '$tenant','Concurrency fixture','availability-concurrency','UTC',30,
jsonb_object_agg(d,jsonb_build_object('active',true,'open','09:00','close','18:00'))
from unnest(array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])d;
insert into public.barbers(id,name,barbershop_id,availability_mode) values('$barber','Concurrency','$tenant','custom');
insert into public.services(id,name,barbershop_id,price,duration_minutes) values('$service','Concurrency','$tenant',50,30);
insert into public.barber_working_hours(barbershop_id,barber_id,weekday,start_time,end_time) values('$tenant','$barber',1,'09:00','18:00');
insert into auth.users(id,aud,role,email) values('$owner','authenticated','authenticated','availability-concurrency@example.test');
insert into public.profiles(id,role,active,barbershop_id) values('$owner','owner',true,'$tenant');
"@
$cases = @(
    @{ Name = 'create/create'; First = $insert; Second = $insert.Replace($appointment, 'eeee2727-0000-4000-8000-000000000005'); Error = 'APPOINTMENT_ACTIVE_SLOT_CONFLICT' },
    @{ Name = 'create/time-off'; First = $insert; Second = "insert into public.barber_time_off(barbershop_id,barber_id,starts_at,ends_at) values('$tenant','$barber','2030-01-07T09:15Z','2030-01-07T09:45Z');"; Error = 'APPOINTMENT_TIME_OFF_CONFLICT' },
    @{ Name = 'reschedule/create'; First = "set local role authenticated; select set_config('request.jwt.claim.sub','$owner',true); select * from public.update_owner_appointment('$appointment','Local fixture','11999999999','$barber','Concurrency','$service','Concurrency',50,0,'2030-01-07T09:00Z','2030-01-07T09:30Z','scheduled',null);"; Second = $insert.Replace($appointment, 'eeee2727-0000-4000-8000-000000000005'); Error = 'APPOINTMENT_ACTIVE_SLOT_CONFLICT' },
    @{ Name = 'create/working-hours'; First = $insert; Second = "update public.barber_working_hours set start_time='10:00' where barber_id='$barber';"; Error = 'APPOINTMENT_OUTSIDE_WORKING_HOURS' }
)
$jobs = @()
# Never clean up a fixture that predates this invocation.
$existing = Invoke-LocalSql "select (select count(*) from public.barbershops where id='$tenant')+(select count(*) from auth.users where id='$owner');"
if ($existing -ne '0') { throw 'Fixture already exists; inspect it manually before running.' }
try {
    Invoke-LocalSql "begin; $setup commit;" | Out-Null
    foreach ($case in $cases) {
        Invoke-LocalSql "delete from public.appointments where barbershop_id='$tenant';" | Out-Null
        if ($case.Name -eq 'reschedule/create') {
            Invoke-LocalSql ($insert.Replace('T09:00Z','T10:00Z').Replace('T09:30Z','T10:30Z')) | Out-Null
        }
        $firstSql = "begin; set local application_name='availability-027-holder'; $($case.First) select pg_sleep(8); commit;"
        $first = Start-Job -ArgumentList $container,$firstSql -ScriptBlock {
            param($c,$sql)
            $output = & docker exec $c psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc $sql 2>&1
            $code = $LASTEXITCODE
            [pscustomobject]@{ Code=$code; Output=($output -join "`n") }
        }
        $jobs += $first
        $ready = $false
        for ($i=0; $i -lt 80; $i++) {
            $count = Invoke-LocalSql "select count(*) from pg_stat_activity where application_name='availability-027-holder' and wait_event='PgSleep';"
            if ($count -eq '1') { $ready=$true; break }
            Start-Sleep -Milliseconds 100
        }
        if (-not $ready) { throw 'Holder did not reach its protected transaction.' }
        $secondSql = "begin; set local application_name='availability-027-waiter'; $($case.Second) commit;"
        $second = Start-Job -ArgumentList $container,$secondSql -ScriptBlock {
            param($c,$sql)
            $output = & docker exec $c psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc $sql 2>&1
            $code = $LASTEXITCODE
            [pscustomobject]@{ Code=$code; Output=($output -join "`n") }
        }
        $jobs += $second
        $waited = $false
        for ($i=0; $i -lt 50; $i++) {
            $count = Invoke-LocalSql "select count(*) from pg_stat_activity where application_name='availability-027-waiter' and wait_event_type='Lock' and wait_event='advisory';"
            if ($count -eq '1') { $waited=$true; break }
            Start-Sleep -Milliseconds 100
        }
        $one = Receive-Job -Job (Wait-Job $first)
        $two = Receive-Job -Job (Wait-Job $second)
        if (-not $waited -or $one.Code -ne 0 -or $two.Code -eq 0 -or $two.Output -notmatch $case.Error) {
            throw "Concurrency case failed: $($case.Name); waited=$waited; first=$($one.Code); second=$($two.Output)"
        }
        $count = Invoke-LocalSql "select count(*) from public.appointments where barbershop_id='$tenant';"
        if ($count -ne '1') { throw 'Unexpected appointment count.' }
        Write-Output "PASS $($case.Name): advisory wait observed; conflicting mutation rolled back."
    }
} finally {
    foreach ($job in $jobs) { $job | Wait-Job | Out-Null; Remove-Job $job }
    Invoke-LocalSql @"
delete from public.appointments where barbershop_id='$tenant';
delete from public.barber_time_off where barbershop_id='$tenant';
delete from public.barber_working_hours where barbershop_id='$tenant';
delete from public.profiles where id='$owner';
delete from auth.users where id='$owner';
delete from public.barbers where barbershop_id='$tenant';
delete from public.services where barbershop_id='$tenant';
delete from public.barbershops where id='$tenant';
"@ | Out-Null
}
