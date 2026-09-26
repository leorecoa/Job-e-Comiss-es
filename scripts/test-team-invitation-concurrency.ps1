[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$container = 'supabase_db_Job-e-Comiss-es'
$prefix = 'eeee1333-0000-4000-8000-'
function Id([int]$n) { return $prefix + $n.ToString('000000000000') }
$tenant = Id 1
$barber = Id 10
$otherBarber = Id 11
$owner = Id 101
$recipient = Id 104
$otherRecipient = Id 105
$invite = Id 201
$otherInvite = Id 202
# Synthetic test tokens only. Production tokens never enter this script.
$token = 'a' * 64
$otherToken = 'b' * 64

function Sql([string]$query) {
  $previous = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $output = $query | & docker exec -i $container psql -X -qAt -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1
    $code = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previous }
  if ($code -ne 0) { throw 'Local invitation test SQL failed; output suppressed.' }
  return ($output | Out-String).Trim()
}
function Actor([string]$user, [string]$query) {
  return "set local role authenticated; select set_config('request.jwt.claims','{`"sub`":`"$user`",`"role`":`"authenticated`"}',true); $query"
}
function Wait-State([string]$predicate, [string]$description) {
  $deadline = [DateTime]::UtcNow.AddSeconds(15)
  do {
    if ((Sql "select exists(select 1 from pg_stat_activity where $predicate);") -eq 't') { return }
    Start-Sleep -Milliseconds 100
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "Did not observe $description."
}
$worker = {
  param($container, $query)
  $ErrorActionPreference = 'Continue'
  $output = $query | & docker exec -i $container psql -X -qAt -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1
  $code = $LASTEXITCODE
  [pscustomobject]@{ Code = $code; Output = ($output | Out-String) }
}
$running = & docker ps --filter "name=^/$container$" --format '{{.Names}}'
if ($LASTEXITCODE -ne 0 -or $running -ne $container) { throw 'Local project database must already be running.' }
$occupied = Sql "select exists(select 1 from public.barbershops where id='$tenant') or exists(select 1 from auth.users where id in ('$owner','$recipient','$otherRecipient'));"
if ($occupied -ne 'f') { throw 'Fixture IDs already exist. Stop without deleting existing data.' }
$created = $false
$jobs = @()
try {
  Sql @"
begin;
insert into public.barbershops(id,name,slug) values ('$tenant','Invitation concurrency','invitation-concurrency-033');
insert into public.barbers(id,name,barbershop_id) values ('$barber','Target A','$tenant'),('$otherBarber','Target B','$tenant');
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_user_meta_data) values
('$owner','authenticated','authenticated','owner-concurrency-033@example.test',now(),'{"role":"owner"}'),
('$recipient','authenticated','authenticated','recipient-concurrency-033@example.test',now(),'{"role":"barber"}'),
('$otherRecipient','authenticated','authenticated','other-concurrency-033@example.test',now(),'{"role":"barber"}');
update public.profiles set barbershop_id='$tenant' where id='$owner';
commit;
"@ | Out-Null
  $created = $true
  $scenarios = @('same-invitation','same-barber','accept-revoke','accept-reissue','same-user','accept-bridge','expiry-wait','revoke-accept','reissue-accept')
  foreach ($scenario in $scenarios) {
    Sql @"
begin;
delete from public.team_invitations where barbershop_id='$tenant';
update public.profiles set barber_id=null,barbershop_id=null where id in ('$recipient','$otherRecipient');
insert into public.team_invitations(id,barbershop_id,barber_id,recipient_email,token_hash,created_by)
values ('$invite','$tenant','$barber','recipient-concurrency-033@example.test',extensions.digest('$token','sha256'),'$owner');
commit;
"@ | Out-Null
    $first = Actor $recipient "select public.accept_team_invitation('$token');"
    $second = Actor $recipient "select public.accept_team_invitation('$token');"
    $expectedError = 'TEAM_INVITATION_UNAVAILABLE'
    $accepted = 1
    $linked = 1
    $pending = 0
    $revoked = 0
    switch ($scenario) {
      'same-barber' {
        Sql "insert into public.team_invitations(id,barbershop_id,barber_id,recipient_email,token_hash,created_by) values ('$otherInvite','$tenant','$barber','other-concurrency-033@example.test',extensions.digest('$otherToken','sha256'),'$owner');" | Out-Null
        $second = Actor $otherRecipient "select public.accept_team_invitation('$otherToken');"
        $pending = 1
      }
      'accept-revoke' { $second = Actor $owner "select public.revoke_team_invitation('$invite');" }
      'accept-reissue' { $second = Actor $owner "select invitation_id from public.issue_team_invitation('$barber','other-concurrency-033@example.test');" }
      'same-user' {
        Sql "insert into public.team_invitations(id,barbershop_id,barber_id,recipient_email,token_hash,created_by) values ('$otherInvite','$tenant','$otherBarber','recipient-concurrency-033@example.test',extensions.digest('$otherToken','sha256'),'$owner');" | Out-Null
        $second = Actor $recipient "select public.accept_team_invitation('$otherToken');"
        $pending = 1
      }
      'accept-bridge' {
        $second = Actor $owner "select profile_id from public.link_barber_profile_by_email('other-concurrency-033@example.test','$barber');"
        $expectedError = 'profiles_barber_id_unique'
      }
      'expiry-wait' {
        # The invitation remains valid when the second connection starts waiting.
        $first = "select id from public.barbers where id='$barber' for update;"
        $accepted = 0; $linked = 0; $pending = 1
      }
      'revoke-accept' {
        $first = Actor $owner "select public.revoke_team_invitation('$invite');"
        $accepted = 0; $linked = 0; $revoked = 1
      }
      'reissue-accept' {
        $first = Actor $owner "select invitation_id from public.issue_team_invitation('$barber','other-concurrency-033@example.test');"
        $accepted = 0; $linked = 0; $revoked = 1; $pending = 1
      }
    }
    # Hold the completed first operation open; observe the actual database wait, not just job start.
    $jobs = @(Start-Job -ScriptBlock $worker -ArgumentList $container,
      "set application_name='invitation-033-first'; begin; set local statement_timeout='20s'; $first select pg_sleep(10); commit;")
    Wait-State "application_name='invitation-033-first' and wait_event='PgSleep'" 'first transaction holding locks'
    if ($scenario -eq 'expiry-wait') {
      # One captured instant satisfies the exact 48h constraint.
      Sql "with t as (select clock_timestamp() as ts) update public.team_invitations set created_at=t.ts-interval '48 hours'+interval '4 seconds',expires_at=t.ts+interval '4 seconds' from t where id='$invite';" | Out-Null
    }
    $jobs += Start-Job -ScriptBlock $worker -ArgumentList $container,
      "set application_name='invitation-033-second'; begin; set local statement_timeout='20s'; $second commit;"
    Wait-State "application_name='invitation-033-second' and exists(select 1 from pg_stat_activity f where f.application_name='invitation-033-first' and f.pid=any(pg_blocking_pids(pg_stat_activity.pid)))" 'second transaction blocked by first'
    if ($scenario -eq 'expiry-wait' -and (Sql "select expires_at>clock_timestamp() from public.team_invitations where id='$invite';") -ne 't') {
      throw 'Expiry fixture was already expired before its lock wait was observed.'
    }
    $results = @($jobs | Wait-Job | Receive-Job)
    $jobs | Remove-Job
    $jobs = @()
    if ($results.Count -ne 2 -or $results[0].Code -ne 0 -or $results[1].Code -eq 0 -or $results[1].Output -notmatch [regex]::Escape($expectedError)) {
      throw "Unexpected transaction outcome: $scenario (output suppressed)."
    }
    $valid = Sql @"
select
 (select count(*) from public.team_invitations where barbershop_id='$tenant' and accepted_at is not null)=$accepted
 and (select count(*) from public.team_invitations where barbershop_id='$tenant' and accepted_at is null and revoked_at is null)=$pending
 and (select count(*) from public.team_invitations where barbershop_id='$tenant' and revoked_at is not null)=$revoked
 and (select count(*) from public.profiles where id in ('$recipient','$otherRecipient') and barber_id is not null)=$linked
 and not exists(select barber_id from public.profiles where barbershop_id='$tenant' and barber_id is not null group by barber_id having count(*)>1)
 and not exists(select 1 from public.team_invitations i join public.profiles p on p.id=i.accepted_by
   where i.barbershop_id='$tenant' and (p.barber_id is distinct from i.barber_id or p.barbershop_id is distinct from i.barbershop_id));
"@
    if ($valid -ne 't') { throw "Partial mutation or inconsistent invitation: $scenario." }
    Write-Output "PASS $scenario : second waited for first; final state and cardinality verified."
  }
} finally {
  if ($jobs.Count -gt 0) {
    $jobs | Wait-Job | Out-Null
    $jobs | Remove-Job
  }
  if ($created) {
    Sql @"
begin;
delete from public.team_invitations where barbershop_id='$tenant';
delete from auth.users where id in ('$owner','$recipient','$otherRecipient');
delete from public.barbers where id in ('$barber','$otherBarber');
delete from public.barbershops where id='$tenant';
commit;
"@ | Out-Null
    $leftover = Sql "select exists(select 1 from public.barbershops where id='$tenant') or exists(select 1 from auth.users where id in ('$owner','$recipient','$otherRecipient')) or exists(select 1 from public.team_invitations where barbershop_id='$tenant') or exists(select 1 from public.barbers where id in ('$barber','$otherBarber')) or exists(select 1 from public.profiles where id in ('$owner','$recipient','$otherRecipient'));"
    if ($leftover -ne 'f') { throw 'Residual concurrency fixtures detected.' }
    Write-Output 'PASS cleanup: no fixture rows remain.'
  }
}
