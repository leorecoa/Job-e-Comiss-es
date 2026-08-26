[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$containerName = 'supabase_db_Job-e-Comiss-es'
$ownerAlphaId = '01700000-0000-4000-8000-000000000001'
$ownerBetaId = '01700000-0000-4000-8000-000000000002'
$tenantAlphaId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
$tenantBetaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'
$alphaPath = "$tenantAlphaId/migration-017-upsert.png"
$betaPath = "$tenantBetaId/migration-017-upsert.png"

function Invoke-LocalSql {
  param([Parameter(Mandatory = $true)][string]$Sql)

  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $output = & docker exec $containerName psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc $Sql 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousPreference
  }
  if ($exitCode -ne 0) {
    throw "Local Storage fixture SQL failed with exit code $exitCode."
  }
  return ($output | Out-String).Trim()
}

function ConvertTo-Base64Url {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)
  return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function New-LocalJwt {
  param(
    [Parameter(Mandatory = $true)][string]$UserId,
    [Parameter(Mandatory = $true)][string]$Secret
  )

  $header = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes('{"alg":"HS256","typ":"JWT"}'))
  $expiresAt = [DateTimeOffset]::UtcNow.AddMinutes(15).ToUnixTimeSeconds()
  $payloadJson = @{ sub = $UserId; role = 'authenticated'; aud = 'authenticated'; exp = $expiresAt } | ConvertTo-Json -Compress
  $payload = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes($payloadJson))
  $unsignedToken = "$header.$payload"
  $hmac = [Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($Secret))
  try {
    $signature = ConvertTo-Base64Url ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($unsignedToken)))
  }
  finally {
    $hmac.Dispose()
  }
  return "$unsignedToken.$signature"
}

function Invoke-StorageRequest {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$Token,
    [Parameter(Mandatory = $true)][string]$ApiKey,
    [byte[]]$Body,
    [hashtable]$AdditionalHeaders = @{}
  )

  $headers = @{ Authorization = "Bearer $Token"; apikey = $ApiKey }
  foreach ($key in $AdditionalHeaders.Keys) { $headers[$key] = $AdditionalHeaders[$key] }
  $parameters = @{ Method = $Method; Uri = $Url; Headers = $headers; UseBasicParsing = $true }
  if ($null -ne $Body) {
    $parameters.Body = $Body
    $parameters.ContentType = 'image/png'
  }
  return Invoke-WebRequest @parameters
}

function Remove-StorageObject {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Token,
    [Parameter(Mandatory = $true)][string]$ApiKey,
    [Parameter(Mandatory = $true)][string]$ApiUrl
  )

  $headers = @{ Authorization = "Bearer $Token"; apikey = $ApiKey }
  $body = @{ prefixes = @($Path) } | ConvertTo-Json -Compress
  return Invoke-WebRequest -Method Delete -Uri "$ApiUrl/storage/v1/object/barbershop-branding" -Headers $headers -ContentType 'application/json' -Body $body -UseBasicParsing
}

$runningContainer = & docker ps --filter "name=^/$containerName$" --format '{{.Names}}'
if ($LASTEXITCODE -ne 0 -or $runningContainer -ne $containerName) {
  throw 'The isolated local Supabase stack must be running before this test.'
}

$previousPreference = $ErrorActionPreference
try {
  $ErrorActionPreference = 'Continue'
  $statusLines = & npx supabase status -o env 2>$null
  $statusExitCode = $LASTEXITCODE
}
finally {
  $ErrorActionPreference = $previousPreference
}
if ($statusExitCode -ne 0) { throw 'Could not read local Supabase test configuration.' }
$localConfig = @{}
foreach ($line in $statusLines) {
  if ($line -match '^([^=]+)="(.*)"$') { $localConfig[$matches[1]] = $matches[2] }
}
$apiUrl = $localConfig['API_URL']
$anonKey = $localConfig['ANON_KEY']
$jwtSecret = $localConfig['JWT_SECRET']
if (-not $apiUrl -or -not $anonKey -or -not $jwtSecret) {
  throw 'Local Supabase API configuration is incomplete.'
}

$cleanupSql = "delete from auth.users where id in ('$ownerAlphaId', '$ownerBetaId');"
$alphaToken = New-LocalJwt -UserId $ownerAlphaId -Secret $jwtSecret
$betaToken = New-LocalJwt -UserId $ownerBetaId -Secret $jwtSecret
$objectBaseUrl = "$apiUrl/storage/v1/object/barbershop-branding"

try {
  Invoke-LocalSql -Sql $cleanupSql | Out-Null
  Invoke-LocalSql -Sql @"
insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('$ownerAlphaId', 'authenticated', 'authenticated', 'storage-owner-alpha@example.test', pg_catalog.jsonb_build_object('role', 'owner'), now(), now()),
  ('$ownerBetaId', 'authenticated', 'authenticated', 'storage-owner-beta@example.test', pg_catalog.jsonb_build_object('role', 'owner'), now(), now());
update public.profiles set barbershop_id = '$tenantAlphaId' where id = '$ownerAlphaId';
update public.profiles set barbershop_id = '$tenantBetaId' where id = '$ownerBetaId';
"@ | Out-Null

  $fixtureCount = Invoke-LocalSql -Sql "select count(*) from public.profiles where id in ('$ownerAlphaId', '$ownerBetaId') and role = 'owner' and active = true and barbershop_id is not null;"
  if ($fixtureCount -ne '2') { throw 'Local owner fixtures are incomplete.' }

  $identityResponse = Invoke-WebRequest -Method Get -Uri "$apiUrl/rest/v1/profiles?select=id" -Headers @{ Authorization = "Bearer $alphaToken"; apikey = $anonKey } -UseBasicParsing
  $identityRows = @($identityResponse.Content | ConvertFrom-Json)
  if ($identityRows.Count -ne 1 -or $identityRows[0].id -ne $ownerAlphaId) {
    throw 'Local owner JWT did not resolve to the expected profile.'
  }

  foreach ($fixture in @(@{ Path = $alphaPath; Token = $alphaToken }, @{ Path = $betaPath; Token = $betaToken })) {
    Remove-StorageObject -Path $fixture.Path -Token $fixture.Token -ApiKey $anonKey -ApiUrl $apiUrl | Out-Null
  }

  $firstBody = [Text.Encoding]::UTF8.GetBytes('first-branding-image')
  $secondBody = [Text.Encoding]::UTF8.GetBytes('second-branding-image')
  Invoke-StorageRequest -Method Post -Url "$objectBaseUrl/$alphaPath" -Token $alphaToken -ApiKey $anonKey -Body $firstBody | Out-Null
  Invoke-StorageRequest -Method Post -Url "$objectBaseUrl/$alphaPath" -Token $alphaToken -ApiKey $anonKey -Body $secondBody -AdditionalHeaders @{ 'x-upsert' = 'true' } | Out-Null
  Invoke-StorageRequest -Method Post -Url "$objectBaseUrl/$betaPath" -Token $betaToken -ApiKey $anonKey -Body $firstBody | Out-Null

  $crossTenantBlocked = $false
  try {
    Invoke-StorageRequest -Method Post -Url "$objectBaseUrl/$betaPath" -Token $alphaToken -ApiKey $anonKey -Body $secondBody -AdditionalHeaders @{ 'x-upsert' = 'true' } | Out-Null
  }
  catch {
    $crossTenantBlocked = $_.Exception.Response.StatusCode.value__ -in @(400, 401, 403)
  }
  if (-not $crossTenantBlocked) { throw 'Cross-tenant branding overwrite was not blocked.' }

  $publicResponse = Invoke-WebRequest -Method Get -Uri "$apiUrl/storage/v1/object/public/barbershop-branding/$alphaPath" -UseBasicParsing
  if ($publicResponse.StatusCode -ne 200) { throw 'Public branding URL did not remain accessible.' }

  Write-Output 'Branding Storage upsert validation passed.'
}
finally {
  foreach ($fixture in @(@{ Path = $alphaPath; Token = $alphaToken }, @{ Path = $betaPath; Token = $betaToken })) {
    try { Remove-StorageObject -Path $fixture.Path -Token $fixture.Token -ApiKey $anonKey -ApiUrl $apiUrl | Out-Null } catch { }
  }
  Invoke-LocalSql -Sql $cleanupSql | Out-Null
}
