param(
    [ValidateSet('backend', 'frontend', 'all')]
    [string] $Mode = 'all'
)

$ErrorActionPreference = 'Stop'

$projectDir = Resolve-Path (Join-Path $PSScriptRoot '..')
$toolsDir = Join-Path $PSScriptRoot 'tools'
$cloudflaredPath = Join-Path $toolsDir 'cloudflared.exe'

function Write-Step([string] $message) {
    Write-Host "[INFO] $message"
}

function Test-CommandAvailable([string] $name) {
    return [bool] (Get-Command $name -ErrorAction SilentlyContinue)
}

function Update-PathFromMachine() {
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machinePath;$userPath"
}

function Install-WithWinget([string] $packageId, [string] $displayName) {
    if (-not (Test-CommandAvailable 'winget')) {
        throw "winget chua san sang. Hay cai $displayName thu cong roi chay lai."
    }

    Write-Step "Dang cai $displayName bang winget..."
    winget install --exact --id $packageId --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "Khong cai duoc $displayName bang winget."
    }
    Update-PathFromMachine
}

function Ensure-Node() {
    if ((Test-CommandAvailable 'node') -and (Test-CommandAvailable 'npm')) {
        Write-Step "Node.js da san sang: $(node --version), npm $(npm --version)"
        return
    }

    Install-WithWinget 'OpenJS.NodeJS.LTS' 'Node.js LTS'

    if (-not ((Test-CommandAvailable 'node') -and (Test-CommandAvailable 'npm'))) {
        throw 'Da cai Node.js nhung cua so hien tai chua nhan PATH. Dong terminal va chay lai file .bat.'
    }
}

function Test-Python310() {
    if (-not (Test-CommandAvailable 'py')) {
        return $false
    }
    py -3.10 --version *> $null
    return $LASTEXITCODE -eq 0
}

function Ensure-Python310() {
    if (Test-Python310) {
        Write-Step "Python 3.10 da san sang: $(py -3.10 --version)"
        return
    }

    Install-WithWinget 'Python.Python.3.10' 'Python 3.10'

    if (-not (Test-Python310)) {
        throw 'Da cai Python 3.10 nhung Python launcher chua san sang. Dong terminal va chay lai file .bat.'
    }
}

function Ensure-Cloudflared() {
    New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null

    if (Test-Path -LiteralPath $cloudflaredPath) {
        Write-Step "cloudflared da san sang: $cloudflaredPath"
        return
    }

    $globalCloudflared = Get-Command 'cloudflared.exe' -ErrorAction SilentlyContinue
    if ($globalCloudflared -and (Test-Path -LiteralPath $globalCloudflared.Source)) {
        Write-Step "Tim thay cloudflared trong PATH. Dang copy vao thu muc project..."
        Copy-Item -LiteralPath $globalCloudflared.Source -Destination $cloudflaredPath -Force
        return
    }

    $downloadUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
    Write-Step "Chua co cloudflared. Dang tai cloudflared-windows-amd64.exe..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $downloadUrl -OutFile $cloudflaredPath -UseBasicParsing

    if (-not (Test-Path -LiteralPath $cloudflaredPath)) {
        throw 'Tai cloudflared that bai.'
    }

    Write-Step "cloudflared da duoc tai: $cloudflaredPath"
}

Write-Step "Kiem tra moi truong Eco-loop Campus ($Mode)..."

if ($Mode -eq 'backend' -or $Mode -eq 'all') {
    Ensure-Python310
}

if ($Mode -eq 'frontend' -or $Mode -eq 'all') {
    Ensure-Node
}

Ensure-Cloudflared

Write-Host "[OK] Moi truong da san sang."
