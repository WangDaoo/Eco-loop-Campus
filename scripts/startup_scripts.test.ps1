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

$backendBat = Read-RepoFile 'start_backend.bat'
$frontendBat = Read-RepoFile 'start_frontend.bat'
$serverSetupBat = Read-RepoFile 'setup_server_full.bat'
$publicReleaseBat = Read-RepoFile 'setup_public_release.bat'
$laptopBat = Read-RepoFile 'scripts\start_laptop_server.bat'
$gitignore = Read-RepoFile '.gitignore'

Assert-Contains $backendBat 'ensure_windows_runtime.ps1' 'start_backend.bat must verify/install runtime dependencies.'
Assert-Contains $backendBat 'init_local_postgres.ps1' 'start_backend.bat must initialize/check local PostgreSQL before serving.'
Assert-Contains $backendBat '/api/health/db' 'start_backend.bat must expose the PostgreSQL health check URL.'
Assert-Contains $backendBat 'run_cloudflared_tunnel.ps1' 'start_backend.bat must open a public Cloudflare tunnel.'
Assert-Contains $backendBat 'api_public_url.txt' 'start_backend.bat must publish the API tunnel URL for frontend builds.'

Assert-Contains $frontendBat 'ensure_windows_runtime.ps1' 'start_frontend.bat must verify/install Node and cloudflared.'
Assert-Contains $frontendBat 'api_public_url.txt' 'start_frontend.bat must read the backend public URL when available.'
Assert-Contains $frontendBat 'web_public_url.txt' 'start_frontend.bat must write the web public URL.'
Assert-Contains $frontendBat 'npm run build' 'start_frontend.bat must build the production web before serving public.'
Assert-Contains $frontendBat 'serve_cra_build.js' 'start_frontend.bat must serve the production build.'

Assert-Contains $serverSetupBat 'Docker.DockerDesktop' 'setup_server_full.bat must be able to install Docker Desktop via winget.'
Assert-Contains $serverSetupBat 'ensure_windows_runtime.ps1' 'setup_server_full.bat must verify Node/npm before building the APK.'
Assert-Contains $serverSetupBat '.env.docker.example' 'setup_server_full.bat must create Docker env from the committed template.'
Assert-Contains $serverSetupBat 'docker compose --env-file "%ENV_FILE%" up -d --build' 'setup_server_full.bat must start the full stack in detached server mode.'
Assert-Contains $serverSetupBat 'New-NetFirewallRule' 'setup_server_full.bat must open backend/web firewall ports when run as admin.'
Assert-Contains $serverSetupBat 'docker_bootstrap_admin.ps1' 'setup_server_full.bat must bootstrap the backend admin account.'
Assert-Contains $serverSetupBat '/api/health/db' 'setup_server_full.bat must verify backend database health.'
Assert-Contains $serverSetupBat 'Get-NetIPAddress' 'setup_server_full.bat must print LAN IPs for mobile/web clients.'
Assert-Contains $serverSetupBat 'EXPO_PUBLIC_API_URL' 'setup_server_full.bat must write the backend URL into the mobile APK build environment.'
Assert-Contains $serverSetupBat ':app:createBundleReleaseJsAndAssets --rerun-tasks' 'setup_server_full.bat must rebuild the Expo release JS bundle after writing the backend URL.'
Assert-Contains $serverSetupBat 'gradlew.bat assembleRelease' 'setup_server_full.bat must build the Android release APK after server setup.'
Assert-Contains $serverSetupBat 'dist\ecoloop-campus-mobile-release.apk' 'setup_server_full.bat must copy the rebuilt APK to the shared dist path.'
Assert-Contains $serverSetupBat 'subst' 'setup_server_full.bat must build Android through an ASCII subst path for Unicode project folders.'

Assert-Contains $publicReleaseBat 'start_backend.bat' 'setup_public_release.bat must start the backend and API public tunnel.'
Assert-Contains $publicReleaseBat 'api_public_url.txt' 'setup_public_release.bat must wait for the API public URL before building clients.'
Assert-Contains $publicReleaseBat 'REACT_APP_API_URL' 'setup_public_release.bat must build the web admin with the public API URL.'
Assert-Contains $publicReleaseBat 'EXPO_PUBLIC_API_URL' 'setup_public_release.bat must write the public API URL into the mobile build env.'
Assert-Contains $publicReleaseBat 'gradlew.bat assembleRelease' 'setup_public_release.bat must build the Android release APK.'
Assert-Contains $publicReleaseBat ':app:createBundleReleaseJsAndAssets --rerun-tasks' 'setup_public_release.bat must force the Expo release JS bundle to include the latest public API URL.'
Assert-Contains $publicReleaseBat 'dist\ecoloop-campus-mobile-release.apk' 'setup_public_release.bat must copy the release APK to the shared dist path.'
Assert-Contains $publicReleaseBat 'start_frontend.bat' 'setup_public_release.bat must start the public web tunnel after the web build uses the API URL.'
Assert-Contains $publicReleaseBat 'subst' 'setup_public_release.bat must build Android through an ASCII subst path for Unicode project folders.'
Assert-Contains $publicReleaseBat 'System.Text.UTF8Encoding]::new($false)' 'setup_public_release.bat must write .env files without UTF-8 BOM so Expo reads the first key.'
Assert-Contains $publicReleaseBat 'PUBLIC_WAIT_SECONDS=900' 'setup_public_release.bat must wait long enough for release builds before timing out public URLs.'
Assert-Contains $publicReleaseBat '%API_PUBLIC_URL%/api/health/db' 'setup_public_release.bat must verify the public API tunnel before building clients.'
Assert-Contains $publicReleaseBat '%WEB_PUBLIC_URL%/' 'setup_public_release.bat must verify the public web tunnel before reporting it.'

Assert-Contains $laptopBat 'start_backend.bat' 'start_laptop_server.bat must launch the public backend script.'
Assert-Contains $laptopBat 'api_public_url.txt' 'start_laptop_server.bat must wait for API public URL before web startup.'
Assert-Contains $laptopBat 'start_frontend.bat' 'start_laptop_server.bat must launch the public frontend script.'

$ensureScript = Read-RepoFile 'scripts\ensure_windows_runtime.ps1'
Assert-Contains $ensureScript 'OpenJS.NodeJS.LTS' 'ensure script must be able to install Node.js LTS via winget.'
Assert-Contains $ensureScript 'Python.Python.3.10' 'ensure script must be able to install Python 3.10 via winget.'
Assert-Contains $ensureScript 'cloudflared-windows-amd64.exe' 'ensure script must download cloudflared for Windows x64.'

$tunnelScript = Read-RepoFile 'scripts\run_cloudflared_tunnel.ps1'
Assert-Contains $tunnelScript 'trycloudflare' 'tunnel script must parse quick tunnel public URLs.'
Assert-Contains $tunnelScript 'OutFile' 'tunnel script must write the public URL to a file.'
Assert-Contains $tunnelScript "`$ErrorActionPreference = 'Continue'" 'tunnel script must not fail on cloudflared informational stderr output.'
Assert-Contains $tunnelScript "[string] `$CloudflaredPath = ''" 'tunnel script must not use PSScriptRoot inside param defaults.'
Assert-Contains $tunnelScript '[string]::IsNullOrWhiteSpace($CloudflaredPath)' 'tunnel script must resolve the bundled cloudflared path after param binding.'

Assert-Contains $gitignore '.runtime/' '.gitignore must ignore generated public URL runtime files.'

Write-Host 'startup script checks passed'
