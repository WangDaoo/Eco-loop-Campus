$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

function Read-RequiredFile([string]$RelativePath) {
    $path = Join-Path $root $RelativePath
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing required UAT file: $RelativePath"
    }
    return Get-Content -LiteralPath $path -Raw
}

function Assert-Contains([string]$Content, [string]$Needle, [string]$Message) {
    if (-not $Content.Contains($Needle)) {
        throw $Message
    }
}

$gradle = Read-RequiredFile "ecoloop-campus-mobile\ecoloop-campus-mobile\android\app\build.gradle"
$postgresInit = Read-RequiredFile "backend\local_db\init_local_postgres.ps1"
$setup = Read-RequiredFile "scripts\setup_uat.ps1"
$stop = Read-RequiredFile "scripts\stop_uat.ps1"
$processHelpers = Read-RequiredFile "scripts\uat_process_helpers.ps1"
$guide = Read-RequiredFile "docs\testing\UAT_TWO_DEVICE_GUIDE.md"
$gitignore = Read-RequiredFile ".gitignore"

Assert-Contains $gradle "uat {" "Android must define a standalone UAT build type."
Assert-Contains $gradle "initWith release" "UAT must bundle JavaScript like release instead of requiring Metro."
Assert-Contains $gradle 'applicationIdSuffix ".uat"' "UAT must install beside the production app."
Assert-Contains $gradle 'versionNameSuffix "-uat"' "UAT must identify its version clearly."
Assert-Contains $gradle "signingConfig signingConfigs.debug" "UAT must use the local debug key."
Assert-Contains $gradle "minifyEnabled false" "UAT must remain easy to diagnose."

Assert-Contains $postgresInit 'DatabaseUrlFileName = "DATABASE_URL.txt"' "PostgreSQL init must support a separate UAT URL file."
Assert-Contains $postgresInit "GetFileName" "The runtime URL filename must reject path traversal."

Assert-Contains $setup 'ecoloop_campus_uat' "UAT setup must target a dedicated _uat database."
Assert-Contains $setup 'UAT_DATABASE_URL.txt' "UAT credentials must use an isolated ignored runtime file."
Assert-Contains $setup 'run_cloudflared_tunnel.ps1' "Remote devices require a public API tunnel."
Assert-Contains $setup 'EXPO_PUBLIC_API_URL' "The public API URL must be embedded into the UAT APK."
Assert-Contains $setup ':app:createBundleUatJsAndAssets' "UAT setup must force a fresh Expo JavaScript bundle."
Assert-Contains $setup 'assembleUat' "UAT setup must build the UAT Android variant."
Assert-Contains $setup 'ecoloop-campus-uat.apk' "UAT setup must publish a stable artifact filename."
Assert-Contains $setup 'Get-FileHash' "UAT setup must publish a SHA-256 checksum."
Assert-Contains $setup '/api/health/db' "UAT setup must verify database health before building."
Assert-Contains $setup 'seed_utehy_demo_data.py' "UAT setup must seed realistic role accounts."
Assert-Contains $setup 'ECOLOOP_DEMO_PASSWORD' "UAT setup must override the weak demo password."
Assert-Contains $setup 'uat_accounts.txt' "UAT account credentials must be stored only in ignored runtime state."
Assert-Contains $setup 'Invoke-AsciiSafeRuntimeBootstrap' "UAT setup must run Java tooling through an ASCII subst path on Unicode workspaces."
Assert-Contains $setup 'UAT_AUTH_SECRET.txt' "UAT must use an authentication secret isolated from development."
Assert-Contains $setup 'ExpectedDatabase' "Health checks must verify the exact UAT database, not just a 200 response."
Assert-Contains $setup 'Assert-UatPortAvailable' "UAT must refuse to tunnel an already occupied backend port."
Assert-Contains $setup '[switch] $ResetData' "Restarting the tunnel must not reset UAT balances unless explicitly requested."
Assert-Contains $setup 'uat_seed_' "UAT setup must remember that initial seed has completed."
Assert-Contains $setup '-PidFile' "The tunnel launcher must record the actual cloudflared process identity."
Assert-Contains $setup 'Save-UatProcessIdentity' "The backend listener must be recorded with identity metadata."
Assert-Contains $setup 'uat_backend_launcher.pid' "The backend launcher tree must be recorded before health can time out."
Assert-Contains $stop 'Stop-UatRecordedProcess' "UAT stop must validate process identity before stopping it."
Assert-Contains $stop 'Stop-UatRecordedProcessTree' "UAT stop must clean the verified backend launcher tree."
Assert-Contains $gradle 'Eco-loop Campus UAT' "The installed UAT app must have a distinct label."

Assert-Contains $stop 'uat_backend.pid' "UAT stop must target the recorded backend process only."
Assert-Contains $stop 'uat_tunnel.pid' "UAT stop must target the recorded tunnel process only."
Assert-Contains $processHelpers 'Stop-Process' "UAT stop must clean up recorded processes."
Assert-Contains $processHelpers 'startedUtc' "Recorded PIDs must include process start time to prevent PID reuse kills."
Assert-Contains $processHelpers 'executable' "Recorded PIDs must include executable identity."

Assert-Contains $guide "Điện thoại 1" "The guide must include the student device flow."
Assert-Contains $guide "Điện thoại 2" "The guide must include the volunteer device flow."
Assert-Contains $guide "Cloudflare" "The guide must explain temporary tunnel lifetime."
Assert-Contains $guide "SHA-256" "The guide must explain artifact verification."
Assert-Contains $gitignore ".runtime/" "UAT runtime credentials must remain ignored."
Assert-Contains $gitignore "dist/" "Built UAT APKs must remain outside Git history."

& (Join-Path $PSScriptRoot "uat_process_helpers.test.ps1")

Write-Host "UAT setup source contract passed."
