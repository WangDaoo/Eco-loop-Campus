param(
    [ValidateSet('backend', 'frontend', 'all')]
    [string] $Mode = 'all',
    [switch] $WithDocker,
    [switch] $WithPostgres,
    [switch] $WithAndroid
)

$ErrorActionPreference = 'Stop'

$projectDir = Resolve-Path (Join-Path $PSScriptRoot '..')
$toolsDir = Join-Path $PSScriptRoot 'tools'
$cloudflaredPath = Join-Path $toolsDir 'cloudflared.exe'
$downloadsDir = Join-Path $toolsDir 'downloads'
$runtimeDir = Join-Path $projectDir '.runtime'
$pythonInstallerPath = Join-Path $downloadsDir 'python-3.10.11-amd64.exe'
$pythonInstallerUrl = 'https://www.python.org/ftp/python/3.10.11/python-3.10.11-amd64.exe'
$androidSdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$androidCmdlineZip = Join-Path $downloadsDir 'commandlinetools-win-15859902_latest.zip'
$androidCmdlineUrl = 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip'
$dockerInstallerPath = Join-Path $downloadsDir 'Docker Desktop Installer.exe'
$dockerInstallerUrl = 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe'
$postgresInstallerPath = Join-Path $downloadsDir 'postgresql-15.19-1-windows-x64.exe'
$postgresInstallerUrl = 'https://get.enterprisedb.com/postgresql/postgresql-15.19-1-windows-x64.exe'
$postgresPasswordPath = Join-Path $runtimeDir 'postgres_password.txt'
$jdkDir = Join-Path $toolsDir 'jdk-17'
$jdkZip = Join-Path $downloadsDir 'temurin-17-jdk-windows-x64.zip'
$jdkZipUrl = 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse'

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

function Get-SecureRandomBytes([int] $count) {
    $bytes = New-Object byte[] $count
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    }
    finally {
        $rng.Dispose()
    }
    return $bytes
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

function Install-WithWingetIfAvailable([string] $packageId, [string] $displayName) {
    if (-not (Test-CommandAvailable 'winget')) {
        return $false
    }

    Write-Step "Dang cai $displayName bang winget..."
    winget install --exact --id $packageId --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "Khong cai duoc $displayName bang winget."
    }
    Update-PathFromMachine
    return $true
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

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & py -3.10 --version 2>&1
        return $LASTEXITCODE -eq 0 -and ($output -join "`n") -match 'Python 3\.10'
    }
    catch {
        return $false
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
}

function Invoke-NativeCommandTolerant([string] $ErrorMessage, [scriptblock] $Command) {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $Command
        if ($LASTEXITCODE -ne 0) {
            throw $ErrorMessage
        }
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
}

function Ensure-Python310() {
    if (Test-Python310) {
        Write-Step "Python 3.10 da san sang: $(py -3.10 --version)"
        return
    }

    if (-not (Install-WithWingetIfAvailable 'Python.Python.3.10' 'Python 3.10')) {
        New-Item -ItemType Directory -Force -Path $downloadsDir | Out-Null
        Write-Step 'Khong co winget. Dang tai Python 3.10.11 tu www.python.org...'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $pythonInstallerUrl -OutFile $pythonInstallerPath -UseBasicParsing

        if (-not (Test-Path -LiteralPath $pythonInstallerPath)) {
            throw 'Tai Python 3.10.11 installer that bai.'
        }

        Write-Step 'Dang cai Python 3.10.11 cho user hien tai...'
        $process = Start-Process -FilePath $pythonInstallerPath -ArgumentList @('/quiet', 'InstallAllUsers=0', 'PrependPath=1', 'Include_launcher=1', 'Include_pip=1') -Wait -PassThru
        if ($process.ExitCode -ne 0) {
            Write-Host "[FIX] Mo installer Python da tai neu can cai thu cong: $pythonInstallerPath"
            throw "Cai Python 3.10.11 that bai. ExitCode=$($process.ExitCode)"
        }
        Update-PathFromMachine
    }

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

function Ensure-DockerDesktop() {
    if ((Test-CommandAvailable 'docker')) {
        docker compose version *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Step "Docker da san sang: $(docker --version)"
            return
        }
    }

    if (Install-WithWingetIfAvailable 'Docker.DockerDesktop' 'Docker Desktop') {
        Write-Step 'Docker Desktop da cai bang winget. Mo Docker Desktop, bat WSL2 backend neu duoc hoi, roi chay lai script.'
        exit 2
    }

    New-Item -ItemType Directory -Force -Path $downloadsDir | Out-Null
    Write-Step 'Khong co winget. Dang tai Docker Desktop Installer.exe tu desktop.docker.com...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $dockerInstallerUrl -OutFile $dockerInstallerPath -UseBasicParsing

    if (-not (Test-Path -LiteralPath $dockerInstallerPath)) {
        throw 'Tai Docker Desktop Installer.exe that bai.'
    }

    Write-Step 'Dang cai Docker Desktop che do per-user...'
    $process = Start-Process -FilePath $dockerInstallerPath -ArgumentList @('install', '--user') -Wait -PassThru
    if ($process.ExitCode -eq 2) {
        Write-Step 'Docker Desktop installer da tra ExitCode=2. Thuong can mo Docker Desktop, cap quyen WSL2/restart Windows, roi chay lai setup.'
        Write-Step "Neu Docker Desktop chua hien, mo installer tai: $dockerInstallerPath"
        exit 2
    }
    if ($process.ExitCode -ne 0) {
        Write-Host "[FIX] Mo file installer da tai va cai thu cong neu can: $dockerInstallerPath"
        throw "Cai Docker Desktop that bai. ExitCode=$($process.ExitCode)"
    }

    Update-PathFromMachine
    Write-Step 'Docker Desktop da cai xong. Mo Docker Desktop, bat WSL2 backend neu duoc hoi, roi chay lai script.'
    exit 2
}

function Find-PostgresBin() {
    $command = Get-Command 'psql.exe' -ErrorAction SilentlyContinue
    if ($command -and (Test-Path -LiteralPath $command.Source)) {
        return Split-Path -Parent $command.Source
    }

    $roots = @(
        "${env:ProgramFiles}\PostgreSQL",
        "${env:ProgramFiles(x86)}\PostgreSQL"
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

    foreach ($root in $roots) {
        $candidate = Get-ChildItem -LiteralPath $root -Directory |
            Sort-Object { [int]($_.Name -replace '[^\d]', '') } -Descending |
            ForEach-Object { Join-Path $_.FullName 'bin' } |
            Where-Object { Test-Path -LiteralPath (Join-Path $_ 'psql.exe') } |
            Select-Object -First 1
        if ($candidate) {
            return $candidate
        }
    }

    return $null
}

function Get-OrCreatePostgresPassword() {
    New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
    if (Test-Path -LiteralPath $postgresPasswordPath) {
        return (Get-Content -LiteralPath $postgresPasswordPath -Raw).Trim()
    }

    $bytes = Get-SecureRandomBytes 18
    $password = 'EcoPg-' + [Convert]::ToBase64String($bytes).Replace('+', 'A').Replace('/', 'B').TrimEnd('=')
    Set-Content -LiteralPath $postgresPasswordPath -Value $password -Encoding ASCII
    return $password
}

function Test-JavaForAndroid() {
    if (-not (Test-CommandAvailable 'java')) {
        return $false
    }

    $javaPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $versionText = (& java -version 2>&1 | Out-String)
        return $LASTEXITCODE -eq 0 -and $versionText -match 'version "17\.|version "18\.|version "19\.|version "2[0-9]\.|openjdk version "17\.|openjdk version "18\.|openjdk version "19\.|openjdk version "2[0-9]\.'
    }
    catch {
        return $false
    }
    finally {
        $ErrorActionPreference = $javaPreference
    }
}

function Ensure-PostgreSQL() {
    $postgresBin = Find-PostgresBin
    if ($postgresBin) {
        Write-Step "PostgreSQL native da san sang: $postgresBin"
        return
    }

    $password = Get-OrCreatePostgresPassword

    if (Install-WithWingetIfAvailable 'PostgreSQL.PostgreSQL.15' 'PostgreSQL 15') {
        $postgresBin = Find-PostgresBin
        if ($postgresBin) {
            Write-Step "PostgreSQL 15 da cai bang winget: $postgresBin"
            return
        }
        throw 'Da cai PostgreSQL 15 bang winget nhung khong tim thay psql.exe. Dong terminal va chay lai.'
    }

    New-Item -ItemType Directory -Force -Path $downloadsDir | Out-Null
    Write-Step 'Khong co winget. Dang tai PostgreSQL 15 native installer...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $postgresInstallerUrl -OutFile $postgresInstallerPath -UseBasicParsing

    if (-not (Test-Path -LiteralPath $postgresInstallerPath)) {
        throw 'Tai PostgreSQL 15 installer that bai.'
    }

    Write-Step 'Dang cai PostgreSQL 15 native. Buoc nay can quyen Administrator de tao Windows service...'
    $arguments = @(
        '--mode', 'unattended',
        '--unattendedmodeui', 'none',
        '--superpassword', $password,
        '--serverport', '5432',
        '--servicename', 'postgresql-x64-15',
        '--enable-components', 'server,commandlinetools'
    )
    $process = Start-Process -FilePath $postgresInstallerPath -ArgumentList $arguments -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        Write-Host "[FIX] Mo installer PostgreSQL da tai neu can cai thu cong: $postgresInstallerPath"
        throw "Cai PostgreSQL 15 that bai. ExitCode=$($process.ExitCode)"
    }

    Update-PathFromMachine
    $postgresBin = Find-PostgresBin
    if (-not $postgresBin) {
        throw 'Da cai PostgreSQL 15 nhung chua tim thay psql.exe. Restart terminal roi chay lai setup.'
    }

    Write-Step "PostgreSQL 15 da san sang: $postgresBin"
}

function Ensure-Jdk17() {
    $bundledJava = Join-Path $jdkDir 'bin\java.exe'
    if (Test-Path -LiteralPath $bundledJava) {
        $env:JAVA_HOME = $jdkDir
        $env:Path = "$(Join-Path $jdkDir 'bin');$env:Path"
        Write-Step "JDK 17 da san sang trong project: $jdkDir"
        return
    }

    if (Test-JavaForAndroid) {
        Write-Step 'JDK da san sang cho Android build.'
        return
    }

    if ($env:SETUP_INSTALL_SYSTEM_JDK -eq '1' -and (Install-WithWingetIfAvailable 'EclipseAdoptium.Temurin.17.JDK' 'Temurin.17.JDK')) {
        if (-not (Test-CommandAvailable 'java')) {
            throw 'Da cai JDK 17 nhung terminal hien tai chua nhan PATH. Dong terminal va chay lai.'
        }
        return
    }

    New-Item -ItemType Directory -Force -Path $downloadsDir | Out-Null
    $tempExtract = Join-Path $downloadsDir 'temurin-17-jdk'
    if (Test-Path -LiteralPath $tempExtract) {
        Remove-Item -LiteralPath $tempExtract -Recurse -Force
    }

    Write-Step 'Khong co winget. Dang tai JDK 17 zip tu api.adoptium.net...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $jdkZipUrl -OutFile $jdkZip -UseBasicParsing

    Write-Step 'Dang giai nen JDK 17 vao thu muc project...'
    Expand-Archive -LiteralPath $jdkZip -DestinationPath $tempExtract -Force
    $jdkHome = Get-ChildItem -LiteralPath $tempExtract -Directory | Select-Object -First 1
    if (-not $jdkHome) {
        throw 'Khong tim thay thu muc JDK sau khi giai nen.'
    }
    if (Test-Path -LiteralPath $jdkDir) {
        Remove-Item -LiteralPath $jdkDir -Recurse -Force
    }
    Move-Item -LiteralPath $jdkHome.FullName -Destination $jdkDir

    $env:JAVA_HOME = $jdkDir
    $env:Path = "$(Join-Path $jdkDir 'bin');$env:Path"
    Write-Step "JDK 17 da cai trong project: $jdkDir"
}

function Ensure-AndroidSdk() {
    Ensure-Jdk17

    $sdkManager = Join-Path $androidSdkRoot 'cmdline-tools\latest\bin\sdkmanager.bat'
    if (-not (Test-Path -LiteralPath $sdkManager)) {
        New-Item -ItemType Directory -Force -Path $downloadsDir | Out-Null
        New-Item -ItemType Directory -Force -Path $androidSdkRoot | Out-Null
        $tempExtract = Join-Path $downloadsDir 'android-commandline-tools'
        if (Test-Path -LiteralPath $tempExtract) {
            Remove-Item -LiteralPath $tempExtract -Recurse -Force
        }

        Write-Step 'Dang tai Android command-line tools...'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $androidCmdlineUrl -OutFile $androidCmdlineZip -UseBasicParsing

        Write-Step 'Dang giai nen Android command-line tools...'
        Expand-Archive -LiteralPath $androidCmdlineZip -DestinationPath $tempExtract -Force
        $latestDir = Join-Path $androidSdkRoot 'cmdline-tools\latest'
        New-Item -ItemType Directory -Force -Path (Split-Path $latestDir -Parent) | Out-Null
        if (Test-Path -LiteralPath $latestDir) {
            Remove-Item -LiteralPath $latestDir -Recurse -Force
        }
        Move-Item -LiteralPath (Join-Path $tempExtract 'cmdline-tools') -Destination $latestDir
    }

    if (-not (Test-Path -LiteralPath $sdkManager)) {
        throw "Khong tim thay sdkmanager sau khi cai Android SDK: $sdkManager"
    }

    $env:ANDROID_HOME = $androidSdkRoot
    $env:ANDROID_SDK_ROOT = $androidSdkRoot
    Write-Step "Android SDK: $androidSdkRoot"

    Write-Step 'Chap nhan Android SDK licenses...'
    Invoke-NativeCommandTolerant 'Chap nhan Android SDK licenses that bai.' {
        cmd /c "for /l %i in (1,1,40) do @echo y" | & $sdkManager --licenses --sdk_root="$androidSdkRoot" *> $null
    }

    Write-Step 'Dang cai Android SDK packages cho Eco-loop mobile...'
    Invoke-NativeCommandTolerant 'Cai Android SDK packages that bai.' {
        & $sdkManager --sdk_root="$androidSdkRoot" 'platform-tools' 'platforms;android-34' 'build-tools;34.0.0' 'cmdline-tools;latest'
    }
}

Write-Step "Kiem tra moi truong Eco-loop Campus ($Mode)..."

if ($Mode -eq 'backend' -or $Mode -eq 'all') {
    Ensure-Python310
}

if ($Mode -eq 'frontend' -or $Mode -eq 'all') {
    Ensure-Node
}

if ($WithDocker) {
    Ensure-DockerDesktop
}

if ($WithPostgres) {
    Ensure-PostgreSQL
}

if ($WithAndroid) {
    Ensure-AndroidSdk
}

Ensure-Cloudflared

Write-Host "[OK] Moi truong da san sang."
