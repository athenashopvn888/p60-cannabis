[CmdletBinding()]
param(
    [string]$OutputDirectory = 'K:\User Folders\ADMIN\Documents\ChatGPT\Fleet Cig App\backups\pnys-foundation'
)

$ErrorActionPreference = 'Stop'
$secureUrl = $null
$urlPtr = [IntPtr]::Zero
$plainUrl = $null
$previousUrl = $env:POS_SUPABASE_DB_URL

try {
    $secureUrl = Read-Host 'PNYS database URL (masked; never printed or saved)' -AsSecureString
    $urlPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)
    $plainUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($urlPtr)
    if ([string]::IsNullOrWhiteSpace($plainUrl)) {
        throw 'Database URL was empty.'
    }

    $env:POS_SUPABASE_DB_URL = $plainUrl
    & "$PSScriptRoot\..\node_modules\.bin\tsx.cmd" "$PSScriptRoot\reconcile-pnys-foundation.ts" $OutputDirectory
    if ($LASTEXITCODE -ne 0) {
        throw "PNYS reconciliation exited with code $LASTEXITCODE."
    }
}
finally {
    if ($null -eq $previousUrl) {
        Remove-Item Env:POS_SUPABASE_DB_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:POS_SUPABASE_DB_URL = $previousUrl
    }
    $plainUrl = $null
    if ($urlPtr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($urlPtr)
    }
    $secureUrl = $null
}
