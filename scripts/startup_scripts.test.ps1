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

Assert-Contains $gitignore '.runtime/' '.gitignore must ignore generated public URL runtime files.'

Write-Host 'startup script checks passed'
