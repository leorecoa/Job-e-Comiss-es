[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory,

  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$CliVersion = '2.113.0'
$RepositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ResolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)

function Test-IsInsideRepository {
  param([string]$Path)

  $separator = [System.IO.Path]::DirectorySeparatorChar
  $rootWithSeparator = $RepositoryRoot.TrimEnd($separator) + $separator
  return $Path.Equals($RepositoryRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    $Path.StartsWith($rootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)
}

function Invoke-SupabaseDump {
  param(
    [string[]]$Arguments,
    [string]$Connection
  )

  $output = & npx --no-install supabase @Arguments --db-url $Connection 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw 'Supabase CLI dump failed. CLI output was suppressed to avoid exposing credentials.'
  }
}

if (Test-IsInsideRepository -Path $ResolvedOutput) {
  throw 'OutputDirectory must be outside the repository.'
}

if ($DryRun) {
  Write-Host 'Dry-run passed: no credential read and no remote command executed.'
  Write-Host "CLI required: Supabase $CliVersion. Output location is outside the repository."
  Write-Host 'Planned files: roles.sql, schema.sql, data.sql, manifest.json.'
  exit 0
}

$DbUrl = [Environment]::GetEnvironmentVariable('SUPABASE_DB_URL')
if ([string]::IsNullOrWhiteSpace($DbUrl)) {
  throw 'SUPABASE_DB_URL must be set in the process environment.'
}

$versionOutput = & npx --no-install supabase --version 2>$null
$versionExitCode = $LASTEXITCODE
$versionFirstLine = $versionOutput | Select-Object -First 1
$installedVersion = if ($null -eq $versionFirstLine) { '' } else { ([string]$versionFirstLine).Trim() }
if ($versionExitCode -ne 0 -or $installedVersion -ne $CliVersion) {
  throw "Supabase CLI $CliVersion is required. Run npm install from the repository lockfile."
}

$timestamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$BackupDirectory = Join-Path $ResolvedOutput "job-e-comissoes-$timestamp"
if (Test-Path -LiteralPath $BackupDirectory) {
  throw 'The timestamped backup directory already exists; no files were overwritten.'
}

New-Item -ItemType Directory -Path $BackupDirectory | Out-Null

try {
  $rolesFile = Join-Path $BackupDirectory 'roles.sql'
  $schemaFile = Join-Path $BackupDirectory 'schema.sql'
  $dataFile = Join-Path $BackupDirectory 'data.sql'

  Invoke-SupabaseDump -Connection $DbUrl -Arguments @('db', 'dump', '--role-only', '--file', $rolesFile)
  Invoke-SupabaseDump -Connection $DbUrl -Arguments @('db', 'dump', '--file', $schemaFile)
  Invoke-SupabaseDump -Connection $DbUrl -Arguments @(
    'db', 'dump', '--data-only', '--use-copy', '--file', $dataFile,
    '--exclude', 'storage.buckets_vectors',
    '--exclude', 'storage.vector_indexes'
  )

  $files = foreach ($path in @($rolesFile, $schemaFile, $dataFile)) {
    $item = Get-Item -LiteralPath $path
    if ($item.Length -eq 0) {
      throw "Backup artifact is empty: $($item.Name)"
    }

    [ordered]@{
      name = $item.Name
      size_bytes = $item.Length
      sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }

  $manifest = [ordered]@{
    format_version = 1
    created_at_utc = [DateTime]::UtcNow.ToString('o')
    supabase_cli_version = $CliVersion
    files = $files
    notes = @(
      'Auth and Storage metadata require explicit restore validation.',
      'Physical Storage objects are not included in this database backup.'
    )
  }
  $manifestJson = $manifest | ConvertTo-Json -Depth 5
  $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Join-Path $BackupDirectory 'manifest.json'), $manifestJson, $utf8WithoutBom)

  Write-Host "Backup completed at UTC $timestamp."
  foreach ($file in $files) {
    Write-Host "$($file.name): $($file.size_bytes) bytes, SHA-256 $($file.sha256)"
  }
  Write-Host 'Store this directory in private encrypted off-site storage. Never commit it.'
}
catch {
  Write-Error 'Backup failed. The incomplete timestamped directory must be securely discarded.'
  throw
}
finally {
  $DbUrl = $null
}
