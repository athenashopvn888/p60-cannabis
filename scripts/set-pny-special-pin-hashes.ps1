[CmdletBinding()]
param(
  [ValidateSet('preview')]
  [string]$Environment = 'preview',
  [string]$Project = 'pnys-pos',
  [string]$Scope = 'athenashopvn888-2439s-projects'
)

$ErrorActionPreference = 'Stop'
$expectedProject = 'pnys-pos'
$expectedProjectId = 'prj_YxPnreV6iBh3AZIrTKKUK1z9tnuJ'
$expectedOrgId = 'team_IqYig3d4WKblBzRjJ50L7GEc'
$expectedScope = 'athenashopvn888-2439s-projects'
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

function Invoke-VercelCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [AllowNull()]
    [string]$StdinValue = $null
  )

  foreach ($argument in $Arguments) {
    if ($argument -notmatch '^[A-Za-z0-9._:/=-]+$') {
      throw "Unsafe character in a Vercel CLI argument."
    }
  }

  # Keep native stderr away from the Windows PowerShell 5.1 error stream.
  # Vercel writes its harmless version banner to stderr even on success.
  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $env:ComSpec
  $startInfo.Arguments = '/d /s /c "npx vercel ' + ($Arguments -join ' ') + '"'
  $startInfo.WorkingDirectory = (Get-Location).Path
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardInput = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo
  try {
    if (-not $process.Start()) { throw "Could not start the Vercel CLI." }
    if ($null -ne $StdinValue) { $process.StandardInput.Write($StdinValue) }
    $process.StandardInput.Close()
    $standardOutput = $process.StandardOutput.ReadToEnd()
    $standardError = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    $commandExitCode = $process.ExitCode
  }
  finally {
    $process.Dispose()
  }

  return [PSCustomObject]@{
    ExitCode = $commandExitCode
    Output = ($standardError + $standardOutput)
  }
}

try {
  if ($Environment -ne 'preview') {
    throw 'This release script is preview-only.'
  }
  if ($Project -ne $expectedProject -or $Scope -ne $expectedScope) {
    throw "Refusing to target anything except $expectedScope/$expectedProject."
  }
  $linkPath = Join-Path (Get-Location).Path '.vercel\project.json'
  if (-not (Test-Path -LiteralPath $linkPath)) {
    throw 'This checkout is not linked to Vercel. Run this command from the PNYS worktree.'
  }
  $link = Get-Content -LiteralPath $linkPath -Raw | ConvertFrom-Json
  if ($link.projectName -ne $expectedProject -or $link.projectId -ne $expectedProjectId -or $link.orgId -ne $expectedOrgId) {
    throw 'The linked Vercel project does not match the approved PNYS project. No PIN was requested or saved.'
  }
  $vercelArgs = @('--project', $Project, '--no-color')
  if ($Scope) { $vercelArgs += @('--scope', $Scope) }

  Write-Host "Target team: $Scope"
  Write-Host "Target project: $Project ($expectedProjectId)"
  Write-Host "Target environment: $Environment"
  Write-Host 'PINs stay masked; only scrypt hashes are sent.'
  Write-Host 'MASTER = Manager dashboard login.' -ForegroundColor Cyan
  Write-Host 'KITCHEN = Kitchen dashboard login.' -ForegroundColor Cyan
  Write-Host 'DEMO = Staff test-till login.' -ForegroundColor Cyan
  $listResult = Invoke-VercelCommand -Arguments (@('env', 'ls', $Environment) + $vercelArgs)
  if ($listResult.ExitCode -ne 0) {
    throw "Vercel access check failed before any PIN was requested. Sign in to the account that owns '$Scope', then retry.`n$($listResult.Output.Trim())"
  }
  $listed = $listResult.Output

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

  foreach ($role in $roles) {
    $name = $role.Env
    if ($listed -match "(?m)\b$([regex]::Escape($name))\b") {
      $saveResult = Invoke-VercelCommand -Arguments (@('env', 'update', $name, $Environment, '--sensitive', '--yes') + $vercelArgs) -StdinValue $hashes[$name]
    }
    else {
      $saveResult = Invoke-VercelCommand -Arguments (@('env', 'add', $name, $Environment, '--sensitive', '--yes') + $vercelArgs) -StdinValue $hashes[$name]
    }
    if ($saveResult.ExitCode -ne 0) { throw "Vercel did not save $name for $Environment.`n$($saveResult.Output.Trim())" }
  }

  Write-Host "Saved all three PNYS special-login hashes to $Environment. Redeploy the PNYS preview so it receives the new hashes."
}
finally {
  foreach ($key in @($plainPins.Keys)) { $plainPins[$key] = $null }
  foreach ($key in @($hashes.Keys)) { $hashes[$key] = $null }
  $plainPins.Clear()
  $hashes.Clear()
  [GC]::Collect()
}
