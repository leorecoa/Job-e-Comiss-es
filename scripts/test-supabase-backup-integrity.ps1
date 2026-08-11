[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupDirectory
)

$ErrorActionPreference = 'Stop'
$ExpectedNames = @('roles.sql', 'schema.sql', 'data.sql')
$Directory = [System.IO.Path]::GetFullPath($BackupDirectory)
$ManifestPath = Join-Path $Directory 'manifest.json'

if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
  throw 'manifest.json was not found.'
}

$manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
if ($manifest.format_version -ne 1 -or $manifest.supabase_cli_version -ne '2.113.0') {
  throw 'Unsupported manifest format or Supabase CLI version.'
}

$createdAt = [DateTimeOffset]::MinValue
if (-not [DateTimeOffset]::TryParse($manifest.created_at_utc, [ref]$createdAt)) {
  throw 'Manifest timestamp is invalid.'
}

$manifestNames = @($manifest.files | ForEach-Object { $_.name })
if (@($manifestNames).Count -ne $ExpectedNames.Count -or @($ExpectedNames | Where-Object { $_ -notin $manifestNames }).Count -ne 0) {
  throw 'Manifest must contain exactly roles.sql, schema.sql and data.sql.'
}

foreach ($entry in $manifest.files) {
  if ([System.IO.Path]::GetFileName($entry.name) -ne $entry.name) {
    throw 'Manifest contains an unsafe file name.'
  }

  $path = Join-Path $Directory $entry.name
  $item = Get-Item -LiteralPath $path
  if ($item.Length -eq 0 -or $item.Length -ne [long]$entry.size_bytes) {
    throw "Size validation failed for $($entry.name)."
  }

  $actualHash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne ([string]$entry.sha256).ToLowerInvariant()) {
    throw "SHA-256 validation failed for $($entry.name)."
  }

  Write-Host "$($entry.name): size and SHA-256 valid."
}

Write-Host 'Backup integrity validation passed.'
