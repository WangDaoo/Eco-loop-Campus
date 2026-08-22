param(
    [Parameter(Mandatory = $true)]
    [string] $Name,

    [Parameter(Mandatory = $true)]
    [string] $Url,

    [Parameter(Mandatory = $true)]
    [string] $OutFile,

    [string] $CloudflaredPath = (Join-Path $PSScriptRoot 'tools\cloudflared.exe')
)

$ErrorActionPreference = 'Stop'

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

Write-Host "[INFO] Dang mo Cloudflare quick tunnel cho $Name..."
Write-Host "[INFO] Local target: $Url"
Write-Host "[INFO] Public URL se duoc ghi vao: $OutFile"

$published = $false
& $CloudflaredPath tunnel --url $Url 2>&1 | ForEach-Object {
    $line = [string] $_
    Write-Host $line

    if (-not $published -and $line -match 'https://[A-Za-z0-9-]+\.trycloudflare\.com') {
        $publicUrl = $Matches[0]
        Set-Content -LiteralPath $OutFile -Value $publicUrl -Encoding ASCII
        Write-Host "[OK] $Name public URL: $publicUrl"
        $published = $true
    }
}
