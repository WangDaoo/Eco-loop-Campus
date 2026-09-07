param(
    [Parameter(Mandatory = $true)]
    [string] $Name,

    [Parameter(Mandatory = $true)]
    [string] $Url,

    [Parameter(Mandatory = $true)]
    [string] $OutFile,

    [string] $PidFile = '',

    [string] $LogFile = '',

    [string] $CloudflaredPath = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'uat_process_helpers.ps1')

if ([string]::IsNullOrWhiteSpace($CloudflaredPath)) {
    $CloudflaredPath = Join-Path $PSScriptRoot 'tools\cloudflared.exe'
}

if (-not (Test-Path -LiteralPath $CloudflaredPath)) {
    $command = Get-Command 'cloudflared.exe' -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "Khong tim thay cloudflared tai $CloudflaredPath. Hay chay ensure_windows_runtime.ps1 truoc."
    }
    $CloudflaredPath = $command.Source
}

$outDir = Split-Path -Parent $OutFile
if ($outDir) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

Remove-Item -LiteralPath $OutFile -Force -ErrorAction SilentlyContinue
if ([string]::IsNullOrWhiteSpace($LogFile)) {
    $LogFile = "$OutFile.cloudflared.log"
}
$stdoutLog = "$LogFile.stdout"
Remove-Item -LiteralPath $LogFile, $stdoutLog -Force -ErrorAction SilentlyContinue

Write-Host "[INFO] Dang mo Cloudflare quick tunnel cho $Name..."
Write-Host "[INFO] Local target: $Url"
Write-Host "[INFO] Public URL se duoc ghi vao: $OutFile"

$cloudflared = $null
try {
    $cloudflared = Start-Process -FilePath $CloudflaredPath -ArgumentList @('tunnel', '--url', $Url, '--no-autoupdate') `
        -RedirectStandardOutput $stdoutLog -RedirectStandardError $LogFile -WindowStyle Hidden -PassThru
    if (-not [string]::IsNullOrWhiteSpace($PidFile)) {
        Save-UatProcessIdentity -Process $cloudflared -Path $PidFile -Kind 'cloudflared'
    }

    $seen = 0
    while (-not $cloudflared.HasExited) {
        if (Test-Path -LiteralPath $LogFile) {
            $lines = @(Get-Content -LiteralPath $LogFile)
            for ($index = $seen; $index -lt $lines.Count; $index++) {
                $line = [string]$lines[$index]
                Write-Host $line
                if (-not (Test-Path -LiteralPath $OutFile) -and $line -match 'https://[A-Za-z0-9-]+\.trycloudflare\.com') {
                    $publicUrl = $Matches[0]
                    Set-Content -LiteralPath $OutFile -Value $publicUrl -Encoding ASCII
                    Write-Host "[OK] $Name public URL: $publicUrl"
                }
            }
            $seen = $lines.Count
        }
        Start-Sleep -Seconds 1
        $cloudflared.Refresh()
    }
    if ($cloudflared.ExitCode -ne 0) { throw "cloudflared exited with code $($cloudflared.ExitCode)." }
}
catch {
    if ($cloudflared) {
        $cloudflared.Refresh()
        if (-not $cloudflared.HasExited) { Stop-Process -Id $cloudflared.Id -Force }
    }
    throw
}
