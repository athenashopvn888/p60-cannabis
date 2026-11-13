[CmdletBinding()]
param(
  [ValidateSet('preview', 'production')]
  [string]$Environment = 'preview',
  [string]$Project = '',
  [string]$Scope = ''
)

$ErrorActionPreference = 'Stop'
$roles = @(
  @{ Name = 'MASTER'; Env = 'PNY_MASTER_PIN_HASH' },
  @{ Name = 'KITCHEN'; Env = 'PNY_KITCHEN_PIN_HASH' },
  @{ Name = 'DEMO'; Env = 'PNY_DEMO_PIN_HASH' }
)
$plainPins = @{}
$hashes = @{}

function ConvertFrom-MaskedInput([Security.SecureString]$SecureValue) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Read-ConfirmedPin([string]$Role) {
  while ($true) {
    $first = ConvertFrom-MaskedInput (Read-Host "Enter new $Role PIN (digits only, maximum 6)" -AsSecureString)
    $second = ConvertFrom-MaskedInput (Read-Host "Type new $Role PIN again" -AsSecureString)
    try {
      if ($first -notmatch '^\d{1,6}$') {
        Write-Warning "$Role PIN must contain digits only and be no more than 6 digits."
        continue
      }
      if ($first -in @('111111', '123456')) {
        Write-Warning "$Role PIN is too obvious. Choose another."
        continue
      }
      if ($first -cne $second) {
        Write-Warning "$Role PIN entries did not match. Try again."
        continue
      }
      return $first
    }
    finally {
      $second = $null
    }
  }
}

try {
  if (-not $Project) {
    $Project = if ($Environment -eq 'production') { 'pny1-pos' } else { 'p60-cannabis' }
  }
  $vercelArgs = @('--project', $Project, '--no-color')
  if ($Scope) { $vercelArgs += @('--scope', $Scope) }

  Write-Host "Target: Vercel project $Project, $Environment environment. PINs will stay masked and only scrypt hashes will be sent."
  foreach ($role in $roles) {
    do {
      $pin = Read-ConfirmedPin $role.Name
      $duplicate = $plainPins.Values -contains $pin
      if ($duplicate) { Write-Warning "MASTER, KITCHEN and DEMO PINs must all be different." }
    } while ($duplicate)
    $plainPins[$role.Name] = $pin
  }

  foreach ($role in $roles) {
    $hash = $plainPins[$role.Name] | node .\scripts\hash-pny-pin-stdin.mjs
    if ($LASTEXITCODE -ne 0 -or $hash -notmatch '^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$') {
      throw "Could not hash the $($role.Name) PIN."
    }
    $hashes[$role.Env] = $hash
  }

  $listed = (& npx vercel env ls $Environment @vercelArgs 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) { throw "Vercel environment lookup failed. Check your Vercel login, project and scope." }

  foreach ($role in $roles) {
    $name = $role.Env
    if ($listed -match "(?m)\b$([regex]::Escape($name))\b") {
      $hashes[$name] | & npx vercel env update $name $Environment --sensitive --yes @vercelArgs
    }
    else {
      $hashes[$name] | & npx vercel env add $name $Environment --sensitive --yes @vercelArgs
    }
    if ($LASTEXITCODE -ne 0) { throw "Vercel did not save $name for $Environment." }
  }

  Write-Host "Saved all three PNY01 special-login hashes to $Environment. Redeploy the preview so it receives the new hashes."
}
finally {
  foreach ($key in @($plainPins.Keys)) { $plainPins[$key] = $null }
  foreach ($key in @($hashes.Keys)) { $hashes[$key] = $null }
  $plainPins.Clear()
  $hashes.Clear()
  [GC]::Collect()
}
