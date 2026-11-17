$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $workspace 'artifacts\pnys-kitchen-e2e\preview.env'

if (-not (Test-Path -LiteralPath $envFile)) {
  throw 'Pulled PNYS preview environment file was not found.'
}

$secureUrl = Read-Host 'PNYS database URL (masked; never printed or saved)' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)
try {
  $plainUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  if ($plainUrl -notmatch '^postgres(ql)?://') { throw 'A valid PostgreSQL URL is required.' }
  $previousUrl = $env:POS_SUPABASE_DB_URL
  $previousCli = $env:PNYS_KITCHEN_E2E_CLI
  $env:POS_SUPABASE_DB_URL = $plainUrl
  $env:PNYS_KITCHEN_E2E_CLI = '1'
  Push-Location $workspace
  try {
    npx tsx scripts/pnys-kitchen-refill-e2e.ts $envFile
    if ($LASTEXITCODE -ne 0) { throw "Kitchen E2E runner exited with code $LASTEXITCODE." }
  } finally {
    Pop-Location
  }
} finally {
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  $plainUrl = $null
  if ($null -eq $previousUrl) { Remove-Item Env:POS_SUPABASE_DB_URL -ErrorAction SilentlyContinue } else { $env:POS_SUPABASE_DB_URL = $previousUrl }
  if ($null -eq $previousCli) { Remove-Item Env:PNYS_KITCHEN_E2E_CLI -ErrorAction SilentlyContinue } else { $env:PNYS_KITCHEN_E2E_CLI = $previousCli }
}
