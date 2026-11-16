[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$undoPath = Join-Path $repoRoot 'supabase\undo\20261113090000_pnys_foundation.undo.sql'
$migrationPath = Join-Path $repoRoot 'supabase\migrations\20261113090000_pnys_foundation.sql'
$backupDir = 'K:\User Folders\ADMIN\Documents\ChatGPT\Fleet Cig App\backups\pnys-foundation'

if (-not (Test-Path -LiteralPath $undoPath -PathType Leaf)) { throw 'STOP: undo.sql is not saved.' }
if (-not (Test-Path -LiteralPath $migrationPath -PathType Leaf)) { throw 'STOP: the PNYS migration is missing.' }

function Convert-SecureValue([Security.SecureString]$Value) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Invoke-NodeStep([string[]]$Arguments, [string]$Label) {
  & node @Arguments
  if ($LASTEXITCODE -ne 0) { throw "STOP: $Label failed with exit code $LASTEXITCODE." }
}

$first = $null
$second = $null
$dbUrl = $null
$confirmUrl = $null
try {
  $first = Read-Host 'Enter POS_SUPABASE_DB_URL (masked)' -AsSecureString
  $second = Read-Host 'Enter it again to confirm (masked)' -AsSecureString
  $dbUrl = Convert-SecureValue $first
  $confirmUrl = Convert-SecureValue $second
  if ($dbUrl -cne $confirmUrl) { throw 'STOP: the two database URLs do not match.' }

  $uri = $null
  if (-not [Uri]::TryCreate($dbUrl, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -notin @('postgres','postgresql') -or -not $uri.Host) {
    throw 'STOP: enter a complete PostgreSQL connection URL.'
  }

  $env:POS_SUPABASE_DB_URL = $dbUrl
  Push-Location $repoRoot
  try {
    Invoke-NodeStep @('--experimental-strip-types','scripts/pnys-foundation.ts','--backup-only',$backupDir) 'read-only PNY02 backup'
    Invoke-NodeStep @('--experimental-strip-types','scripts/apply-pnys-migration.ts') 'PNYS migration'
    Invoke-NodeStep @('--experimental-strip-types','scripts/pnys-foundation.ts','--clone-only') 'one-time PNY01-to-PNYS clone'
  } finally {
    Pop-Location
  }
  Write-Host 'PNYS foundation database steps completed successfully.' -ForegroundColor Green
} finally {
  Remove-Item Env:POS_SUPABASE_DB_URL -ErrorAction SilentlyContinue
  $dbUrl = $null
  $confirmUrl = $null
  if ($first) { $first.Dispose() }
  if ($second) { $second.Dispose() }
}
