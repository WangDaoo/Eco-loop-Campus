[CmdletBinding()]
param(
    [switch] $Quiet
)

$ErrorActionPreference = "Stop"
$ProjectDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$RuntimeDir = Join-Path $ProjectDir ".runtime"
. (Join-Path $PSScriptRoot "uat_process_helpers.ps1")

Stop-UatRecordedProcess -Path (Join-Path $RuntimeDir "uat_tunnel.pid") -Name "Cloudflare UAT tunnel" -Quiet:$Quiet
Stop-UatRecordedProcess -Path (Join-Path $RuntimeDir "uat_backend.pid") -Name "UAT backend" -Quiet:$Quiet
Stop-UatRecordedProcessTree -Path (Join-Path $RuntimeDir "uat_backend_launcher.pid") -Name "UAT backend launcher" -Quiet:$Quiet

if (-not $Quiet) {
    Write-Host "[OK] Da dung cac tien trinh UAT duoc script ghi nhan. Database UAT va log van duoc giu lai."
}
