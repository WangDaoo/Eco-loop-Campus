$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')

function Read-RepoFile([string] $relativePath) {
    Get-Content -LiteralPath (Join-Path $root $relativePath) -Raw
}

function Assert-Contains([string] $content, [string] $needle, [string] $message) {
    if (-not $content.Contains($needle)) {
        throw $message
    }
}

function Assert-NotContains([string] $content, [string] $needle, [string] $message) {
    if ($content.Contains($needle)) {
        throw $message
    }
}

$backendBat = Read-RepoFile 'start_backend.bat'
$frontendBat = Read-RepoFile 'start_frontend.bat'
$serverSetupBat = Read-RepoFile 'setup_server_full.bat'
$nativeBootstrapScript = Read-RepoFile 'scripts\bootstrap_local_admin.ps1'
$publicReleaseBat = Read-RepoFile 'setup_public_release.bat'
$laptopBat = Read-RepoFile 'scripts\start_laptop_server.bat'
$portScript = Read-RepoFile 'scripts\release_ecoloop_port.ps1'
$initPostgresScript = Read-RepoFile 'backend\local_db\init_local_postgres.ps1'
$dockerCompose = Read-RepoFile 'docker-compose.yml'
$dockerEnvExample = Read-RepoFile '.env.docker.example'
$gitignore = Read-RepoFile '.gitignore'

Assert-Contains $backendBat 'ensure_windows_runtime.ps1' 'start_backend.bat must verify/install runtime dependencies.'
Assert-Contains $backendBat 'init_local_postgres.ps1' 'start_backend.bat must initialize/check local PostgreSQL before serving.'
Assert-Contains $backendBat '/api/health/db' 'start_backend.bat must expose the PostgreSQL health check URL.'
Assert-Contains $backendBat 'run_cloudflared_tunnel.ps1' 'start_backend.bat must open a public Cloudflare tunnel.'
Assert-Contains $backendBat 'api_public_url.txt' 'start_backend.bat must publish the API tunnel URL for frontend builds.'
Assert-Contains $backendBat 'release_ecoloop_port.ps1' 'start_backend.bat must release stale Eco-loop backend processes before binding port 8000.'

Assert-Contains $frontendBat 'ensure_windows_runtime.ps1' 'start_frontend.bat must verify/install Node and cloudflared.'
Assert-Contains $frontendBat 'api_public_url.txt' 'start_frontend.bat must read the backend public URL when available.'
Assert-Contains $frontendBat 'web_public_url.txt' 'start_frontend.bat must write the web public URL.'
Assert-Contains $frontendBat 'npm run build' 'start_frontend.bat must build the production web before serving public.'
Assert-Contains $frontendBat 'serve_cra_build.js' 'start_frontend.bat must serve the production build.'
Assert-Contains $frontendBat 'release_ecoloop_port.ps1' 'start_frontend.bat must release stale Eco-loop web processes before binding the web port.'
Assert-Contains $frontendBat 'set "WEB_PORT=3002"' 'start_frontend.bat must default web to port 3002 because 3000 is commonly occupied by desktop tools.'
Assert-Contains (Read-RepoFile 'scripts\serve_cra_build.js') 'process.env.WEB_PORT || 3002' 'serve_cra_build.js must default web to port 3002 when launched directly.'

Assert-Contains $serverSetupBat '-WithPostgres' 'setup_server_full.bat must install/check native PostgreSQL instead of Docker.'
Assert-Contains $serverSetupBat 'start_backend.bat' 'setup_server_full.bat must launch the native FastAPI backend.'
Assert-Contains $serverSetupBat 'start_frontend.bat' 'setup_server_full.bat must launch the native web frontend.'
Assert-Contains $serverSetupBat 'release_ecoloop_port.ps1' 'setup_server_full.bat must clear stale project port listeners before relaunching services.'
Assert-Contains $serverSetupBat 'bootstrap_local_admin.ps1' 'setup_server_full.bat must bootstrap admin against native PostgreSQL.'
Assert-Contains $serverSetupBat 'api_public_url.txt' 'setup_server_full.bat must wait for native backend public API URL.'
Assert-Contains $serverSetupBat 'New-NetFirewallRule' 'setup_server_full.bat must open backend/web firewall ports when run as admin.'
Assert-Contains $serverSetupBat '/api/health/db' 'setup_server_full.bat must verify backend database health.'
Assert-Contains $serverSetupBat 'Get-NetIPAddress' 'setup_server_full.bat must print LAN IPs for mobile/web clients.'
Assert-Contains $serverSetupBat 'set "WEB_PORT=3002"' 'setup_server_full.bat must default web to port 3002 before opening the public tunnel.'
Assert-Contains $serverSetupBat 'LocalPort %WEB_PORT%' 'setup_server_full.bat must open firewall for the configured web port, not a hard-coded 3000.'
if ($serverSetupBat.Contains('docker compose') -or $serverSetupBat.Contains('-WithDocker')) {
    throw 'setup_server_full.bat must not require Docker after switching to native server mode.'
}

Assert-Contains $nativeBootstrapScript 'DATABASE_URL.txt' 'bootstrap_local_admin.ps1 must read the native PostgreSQL runtime database URL.'
Assert-Contains $nativeBootstrapScript 'bootstrap_admin.sql' 'bootstrap_local_admin.ps1 must apply the existing admin bootstrap SQL.'
Assert-Contains $nativeBootstrapScript 'pbkdf2_sha256' 'bootstrap_local_admin.ps1 must hash the admin password before storing it.'

Assert-Contains $publicReleaseBat 'start_backend.bat' 'setup_public_release.bat must start the backend and API public tunnel.'
Assert-Contains $publicReleaseBat 'api_public_url.txt' 'setup_public_release.bat must wait for the API public URL before building clients.'
Assert-Contains $publicReleaseBat 'REACT_APP_API_URL' 'setup_public_release.bat must build the web admin with the public API URL.'
Assert-Contains $publicReleaseBat 'SETUP_BUILD_APK' 'setup_public_release.bat must allow public web/API setup on laptops without Android Studio.'
Assert-Contains $publicReleaseBat ':skip_apk_build' 'setup_public_release.bat must skip APK build when Android SDK is unavailable.'
Assert-Contains $publicReleaseBat 'EXPO_PUBLIC_API_URL' 'setup_public_release.bat must write the public API URL into the mobile build env.'
Assert-Contains $publicReleaseBat 'gradlew.bat assembleRelease' 'setup_public_release.bat must build the Android release APK.'
Assert-Contains $publicReleaseBat ':app:createBundleReleaseJsAndAssets --rerun-tasks' 'setup_public_release.bat must force the Expo release JS bundle to include the latest public API URL.'
Assert-Contains $publicReleaseBat 'dist\ecoloop-campus-mobile-release.apk' 'setup_public_release.bat must copy the release APK to the shared dist path.'
Assert-Contains $publicReleaseBat 'start_frontend.bat' 'setup_public_release.bat must start the public web tunnel after the web build uses the API URL.'
Assert-Contains $publicReleaseBat 'set "WEB_PORT=3002"' 'setup_public_release.bat must default web to port 3002 before public release.'
Assert-Contains $publicReleaseBat 'subst' 'setup_public_release.bat must build Android through an ASCII subst path for Unicode project folders.'
Assert-Contains $publicReleaseBat 'System.Text.UTF8Encoding]::new($false)' 'setup_public_release.bat must write .env files without UTF-8 BOM so Expo reads the first key.'
Assert-Contains $publicReleaseBat 'PUBLIC_WAIT_SECONDS=900' 'setup_public_release.bat must wait long enough for release builds before timing out public URLs.'
Assert-Contains $publicReleaseBat '%API_PUBLIC_URL%/api/health/db' 'setup_public_release.bat must verify the public API tunnel before building clients.'
Assert-Contains $publicReleaseBat '%WEB_PUBLIC_URL%/' 'setup_public_release.bat must verify the public web tunnel before reporting it.'

Assert-Contains $laptopBat 'start_backend.bat' 'start_laptop_server.bat must launch the public backend script.'
Assert-Contains $laptopBat 'api_public_url.txt' 'start_laptop_server.bat must wait for API public URL before web startup.'
Assert-Contains $laptopBat 'start_frontend.bat' 'start_laptop_server.bat must launch the public frontend script.'
Assert-Contains $laptopBat 'http://127.0.0.1:3002' 'start_laptop_server.bat must print the new web port 3002.'

Assert-Contains $dockerCompose '${WEB_PORT:-3002}:3000' 'docker-compose.yml must expose the web host port as 3002 by default.'
Assert-Contains $dockerEnvExample 'WEB_PORT=3002' '.env.docker.example must default web to port 3002.'
Assert-Contains $dockerEnvExample 'http://127.0.0.1:3002' '.env.docker.example must allow the native web origin on port 3002.'

Assert-Contains $portScript 'Get-NetTCPConnection' 'release_ecoloop_port.ps1 must inspect listeners through Get-NetTCPConnection.'
Assert-Contains $portScript 'Win32_Process' 'release_ecoloop_port.ps1 must inspect process command lines before killing.'
Assert-Contains $portScript 'serve_cra_build.js' 'release_ecoloop_port.ps1 must identify the project web server.'
Assert-Contains $portScript 'uvicorn app:app' 'release_ecoloop_port.ps1 must identify the project backend server.'
Assert-Contains $portScript 'Stop-Process' 'release_ecoloop_port.ps1 must stop stale project processes.'
Assert-Contains $portScript 'belongs to another process' 'release_ecoloop_port.ps1 must fail clearly when another application owns the port.'
Assert-Contains $portScript 'Normalize-ProjectDir' 'release_ecoloop_port.ps1 must normalize project paths passed from .bat launchers.'
Assert-Contains $portScript 'Trim('' "' 'release_ecoloop_port.ps1 must strip quotes that can be appended to trailing-backslash paths on old Windows.'
Assert-Contains $portScript 'GetInvalidPathChars' 'release_ecoloop_port.ps1 must reject still-invalid project paths with a clear error.'

$ensureScript = Read-RepoFile 'scripts\ensure_windows_runtime.ps1'
Assert-Contains $ensureScript 'OpenJS.NodeJS.LTS' 'ensure script must be able to install Node.js LTS via winget.'
Assert-Contains $ensureScript 'Python.Python.3.10' 'ensure script must be able to install Python 3.10 via winget.'
Assert-Contains $ensureScript 'python-3.10.11-amd64.exe' 'ensure script must download Python 3.10 directly when winget is unavailable.'
Assert-Contains $ensureScript 'www.python.org' 'ensure script must use the official Python installer fallback.'
Assert-Contains $ensureScript 'Start-Process -FilePath $pythonInstallerPath' 'ensure script must invoke the downloaded Python installer without relying on py launcher.'
Assert-Contains $ensureScript '$ErrorActionPreference = ''Continue''' 'Test-Python310 must prevent py launcher stderr from aborting setup on old PowerShell.'
Assert-Contains $ensureScript 'PostgreSQL 15' 'ensure script must install native PostgreSQL for old Windows server mode.'
Assert-Contains $ensureScript 'postgresql-15.19-1-windows-x64.exe' 'ensure script must use a stable native PostgreSQL installer fallback.'
Assert-Contains $ensureScript 'postgres_password.txt' 'ensure script must save the PostgreSQL superuser password for init_local_postgres.ps1.'
Assert-Contains $ensureScript '[int]($_.Name -replace' 'ensure script must sort PostgreSQL major version folders without System.Version parse errors.'
Assert-Contains $initPostgresScript '[int]($_.Name -replace' 'init_local_postgres.ps1 must sort PostgreSQL major version folders without System.Version parse errors.'
Assert-Contains $initPostgresScript 'Read-PostgresSuperPassword' 'init_local_postgres.ps1 must recover when postgres_password.txt is missing on machines with existing PostgreSQL.'
Assert-Contains $initPostgresScript 'SETUP_POSTGRES_PASSWORD' 'init_local_postgres.ps1 must accept SETUP_POSTGRES_PASSWORD for unattended setup.'
Assert-Contains $initPostgresScript '-AsSecureString' 'init_local_postgres.ps1 must prompt securely for the existing postgres password when the runtime password file is missing.'
Assert-Contains $initPostgresScript 'postgres_password.txt da duoc tao' 'init_local_postgres.ps1 must save the supplied PostgreSQL superuser password for future runs.'
Assert-Contains $initPostgresScript 'Test-PostgresSuperPassword' 'init_local_postgres.ps1 must validate the postgres password before saving or using it.'
Assert-Contains $initPostgresScript 'Mat khau PostgreSQL user postgres khong dung' 'init_local_postgres.ps1 must report a wrong postgres password clearly.'
Assert-Contains $initPostgresScript 'Invoke-ExternalChecked' 'init_local_postgres.ps1 must stop immediately when psql or createdb fails.'
Assert-Contains $initPostgresScript '$LASTEXITCODE -ne 0' 'init_local_postgres.ps1 must check external command exit codes.'
Assert-Contains $initPostgresScript '$previousPreference = $ErrorActionPreference' 'init_local_postgres.ps1 must preserve ErrorActionPreference around native psql calls.'
Assert-Contains $initPostgresScript '$ErrorActionPreference = "Continue"' 'init_local_postgres.ps1 must allow native psql stderr so password failures become LASTEXITCODE checks.'
Assert-Contains $initPostgresScript '$ErrorActionPreference = $previousPreference' 'init_local_postgres.ps1 must restore ErrorActionPreference after native psql calls.'
Assert-NotContains $initPostgresScript 'File nay duoc tao khi cai PostgreSQL lan dau' 'init_local_postgres.ps1 must not fail immediately when the PostgreSQL password file is missing.'
Assert-Contains $ensureScript 'Docker.DockerDesktop' 'ensure script must be able to install Docker Desktop via winget.'
Assert-Contains $ensureScript 'Docker Desktop Installer.exe' 'ensure script must download Docker Desktop directly when winget is unavailable.'
Assert-Contains $ensureScript 'desktop.docker.com' 'ensure script must use Docker official direct installer fallback.'
Assert-Contains $ensureScript "install', '--user'" 'ensure script must use the documented Docker Desktop per-user installer command.'
Assert-Contains $ensureScript '$process.ExitCode -eq 2' 'ensure script must treat Docker Desktop installer exit code 2 as a follow-up/restart state, not a crash.'
Assert-Contains $ensureScript 'Start-Process -FilePath $dockerInstallerPath' 'ensure script must tell users how to open the downloaded Docker installer if silent install fails.'
Assert-Contains $ensureScript 'commandlinetools-win-15859902_latest.zip' 'ensure script must install Android command-line tools without Android Studio.'
Assert-Contains $ensureScript 'platforms;android-34' 'ensure script must install the Android platform used by the mobile project.'
Assert-Contains $ensureScript 'build-tools;34.0.0' 'ensure script must install the Android build tools used by the mobile project.'
Assert-Contains $ensureScript 'Temurin.17.JDK' 'ensure script must install JDK 17 for Android builds.'
Assert-Contains $ensureScript 'api.adoptium.net' 'ensure script must download JDK 17 directly when winget is unavailable.'
Assert-Contains $ensureScript 'Test-JavaForAndroid' 'ensure script must validate Java without letting java -version stderr abort old PowerShell.'
Assert-Contains $ensureScript '$javaPreference = $ErrorActionPreference' 'ensure script must preserve ErrorActionPreference around java -version.'
Assert-Contains $ensureScript '$ErrorActionPreference = "Continue"' 'ensure script must allow java -version stderr on old PowerShell.'
Assert-Contains $ensureScript 'Invoke-NativeCommandTolerant' 'ensure script must run noisy native tools through a stderr-tolerant helper on old PowerShell.'
Assert-Contains $ensureScript 'Chap nhan Android SDK licenses that bai.' 'ensure script must check sdkmanager license exit code instead of failing on stderr warnings.'
Assert-Contains $ensureScript 'Cai Android SDK packages that bai.' 'ensure script must check sdkmanager package install exit code instead of failing on stderr warnings.'
Assert-Contains $ensureScript 'cmd /c "for /l %i in (1,1,40) do @echo y" | & $sdkManager --licenses' 'ensure script must still pipe license acceptance into sdkmanager.'
Assert-Contains $ensureScript 'cloudflared-windows-amd64.exe' 'ensure script must download cloudflared for Windows x64.'

$rngScripts = @(
    'scripts\ensure_windows_runtime.ps1',
    'scripts\bootstrap_local_admin.ps1',
    'backend\local_db\init_local_postgres.ps1',
    'scripts\docker_bootstrap_admin.ps1'
)
foreach ($rngScript in $rngScripts) {
    $content = Read-RepoFile $rngScript
    if ($content.Contains('RandomNumberGenerator]::Fill')) {
        throw "$rngScript must use RandomNumberGenerator.Create().GetBytes() for old Windows PowerShell/.NET compatibility."
    }
    Assert-Contains $content 'RandomNumberGenerator]::Create()' "$rngScript must use the old-compatible RandomNumberGenerator.Create() API."
}

$tunnelScript = Read-RepoFile 'scripts\run_cloudflared_tunnel.ps1'
Assert-Contains $tunnelScript 'trycloudflare' 'tunnel script must parse quick tunnel public URLs.'
Assert-Contains $tunnelScript 'OutFile' 'tunnel script must write the public URL to a file.'
Assert-Contains $tunnelScript "`$ErrorActionPreference = 'Continue'" 'tunnel script must not fail on cloudflared informational stderr output.'
Assert-Contains $tunnelScript "[string] `$CloudflaredPath = ''" 'tunnel script must not use PSScriptRoot inside param defaults.'
Assert-Contains $tunnelScript '[string]::IsNullOrWhiteSpace($CloudflaredPath)' 'tunnel script must resolve the bundled cloudflared path after param binding.'

Assert-Contains $gitignore '.runtime/' '.gitignore must ignore generated public URL runtime files.'

Write-Host 'startup script checks passed'
