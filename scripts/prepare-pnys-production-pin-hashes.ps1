[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$roles = @('MASTER', 'KITCHEN', 'DEMO')
$plainPins = @{}
$hashes = [ordered]@{}
$outputDirectory = Join-Path $env:LOCALAPPDATA 'PNYS'
$outputPath = Join-Path $outputDirectory 'pnys-special-pin-hashes.production.json'

function ConvertFrom-MaskedInput([Security.SecureString]$SecureValue) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Read-ConfirmedPin([string]$Role) {
  while ($true) {
    $first = ConvertFrom-MaskedInput (Read-Host "Enter new $Role PIN (digits only, maximum 6)" -AsSecureString)
    $second = ConvertFrom-MaskedInput (Read-Host "Type new $Role PIN again" -AsSecureString)
    try {
      if ($first -notmatch '^\d{1,6}$') { Write-Warning "$Role PIN must contain digits only and be no more than 6 digits."; continue }
      if ($first -in @('111111', '123456')) { Write-Warning "$Role PIN is too obvious. Choose another."; continue }
      if ($first -cne $second) { Write-Warning "$Role PIN entries did not match. Try again."; continue }
      return $first
    }
    finally { $second = $null }
  }
}

try {
  foreach ($role in $roles) {
    do {
      $pin = Read-ConfirmedPin $role
      $duplicate = $plainPins.Values -contains $pin
      if ($duplicate) { Write-Warning 'MASTER, KITCHEN and DEMO PINs must all be different.' }
    } while ($duplicate)
    $plainPins[$role] = $pin
  }

  foreach ($role in $roles) {
    $hash = $plainPins[$role] | node .\scripts\hash-pny-pin-stdin.mjs
    if ($LASTEXITCODE -ne 0 -or $hash -notmatch '^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$') { throw "Could not hash the $role PIN." }
    $hashes["PNY_${role}_PIN_HASH"] = $hash
  }

  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
  $hashes | ConvertTo-Json | Set-Content -LiteralPath $outputPath -Encoding UTF8
  & icacls.exe $outputPath /inheritance:r /grant:r "${env:USERNAME}:(R,W)" | Out-Null
  Write-Host 'Saved only the three scrypt hashes to the current Windows user secure local folder.'
  Write-Host "Hash file: $outputPath"
  Write-Host 'No Vercel environment was changed.'
}
finally {
  foreach ($key in @($plainPins.Keys)) { $plainPins[$key] = $null }
  foreach ($key in @($hashes.Keys)) { $hashes[$key] = $null }
  $plainPins.Clear()
  $hashes.Clear()
  [GC]::Collect()
}
