[CmdletBinding()]
param(
    [string] $DatabaseName = "ecoloop_campus_uat",
    [int] $BackendPort = 8010,
    [int] $WaitSeconds = 300,
    [switch] $SkipBuild,
    [switch] $ResetData
)

$ErrorActionPreference = "Stop"
$ProjectDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$RuntimeDir = Join-Path $ProjectDir ".runtime"
$DistDir = Join-Path $ProjectDir "dist"
$BackendDir = Join-Path $ProjectDir "backend"
$MobileDir = Join-Path $ProjectDir "ecoloop-campus-mobile\ecoloop-campus-mobile"
$AndroidDir = Join-Path $MobileDir "android"
$ToolsDir = Join-Path $PSScriptRoot "tools"
$DatabaseUrlPath = Join-Path $RuntimeDir "UAT_DATABASE_URL.txt"
$AuthSecretPath = Join-Path $RuntimeDir "UAT_AUTH_SECRET.txt"
$DemoPasswordPath = Join-Path $RuntimeDir "UAT_DEMO_PASSWORD.txt"
$AccountsPath = Join-Path $RuntimeDir "uat_accounts.txt"
$PublicUrlPath = Join-Path $RuntimeDir "uat_api_public_url.txt"
$SharedPublicUrlPath = Join-Path $RuntimeDir "api_public_url.txt"
$BackendPidPath = Join-Path $RuntimeDir "uat_backend.pid"
$BackendLauncherPidPath = Join-Path $RuntimeDir "uat_backend_launcher.pid"
$TunnelPidPath = Join-Path $RuntimeDir "uat_tunnel.pid"
$BackendOutLog = Join-Path $RuntimeDir "uat_backend.out.log"
$BackendErrLog = Join-Path $RuntimeDir "uat_backend.err.log"
$TunnelOutLog = Join-Path $RuntimeDir "uat_tunnel.out.log"
$TunnelErrLog = Join-Path $RuntimeDir "uat_tunnel.err.log"
$TunnelServiceLog = Join-Path $RuntimeDir "uat_cloudflared.log"
$SummaryPath = Join-Path $RuntimeDir "uat_summary.txt"
$ApkPath = Join-Path $DistDir "ecoloop-campus-uat.apk"
$HashPath = Join-Path $DistDir "ecoloop-campus-uat.apk.sha256"
. (Join-Path $PSScriptRoot "uat_process_helpers.ps1")

if ($DatabaseName -notmatch '^[A-Za-z0-9_]+_uat$') {
    throw "Database UAT phai co hau to _uat de tranh ghi nham vao du lieu development/production."
}
if ($BackendPort -lt 1024 -or $BackendPort -gt 65535) {
    throw "BackendPort phai nam trong khoang 1024-65535."
}
$SeedMarkerPath = Join-Path $RuntimeDir "uat_seed_${DatabaseName}.txt"

function Write-Step([string] $Message) {
    Write-Host "[UAT] $Message"
}

function New-UatPassword {
    $bytes = New-Object byte[] 18
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return "Uat-" + [Convert]::ToBase64String($bytes).Replace("+", "A").Replace("/", "B").TrimEnd("=")
}

function New-UatAuthSecret {
    $bytes = New-Object byte[] 48
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return [Convert]::ToBase64String($bytes)
}

$EnvironmentNames = @(
    "DATABASE_URL", "ECOLOOP_DEMO_PASSWORD", "AUTH_SECRET", "EXPO_PUBLIC_API_URL",
    "EXPO_PUBLIC_AI_MODE", "ANDROID_HOME", "ANDROID_SDK_ROOT", "JAVA_HOME", "PATH"
)
$PreviousEnvironment = @{}
foreach ($name in $EnvironmentNames) {
    $PreviousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

function Find-FreeDriveLetter {
    foreach ($letter in @("Z", "Y", "X", "W", "V", "U", "T", "S", "R", "Q", "P", "O", "N", "M", "L", "K", "J", "I", "H", "G", "F")) {
        if (-not (Test-Path -LiteralPath "${letter}:\")) { return "${letter}:" }
    }
    throw "Khong con ky tu o dia trong de tao duong dan build Android ngan."
}

function Invoke-AsciiSafeRuntimeBootstrap {
    $runtimeDrive = Find-FreeDriveLetter
    $mapped = $false
    try {
        & subst.exe $runtimeDrive $ProjectDir
        if ($LASTEXITCODE -ne 0) { throw "Khong tao duoc subst $runtimeDrive cho runtime bootstrap." }
        $mapped = $true
        & "$runtimeDrive\scripts\ensure_windows_runtime.ps1" -Mode all -WithAndroid
        if ($LASTEXITCODE -ne 0) { throw "Kiem tra/cai runtime UAT that bai." }
    }
    finally {
        if ($mapped) { & subst.exe $runtimeDrive /D | Out-Null }
    }
}

try {
New-Item -ItemType Directory -Force -Path $RuntimeDir, $DistDir | Out-Null
& (Join-Path $PSScriptRoot "stop_uat.ps1") -Quiet
Remove-Item -LiteralPath $PublicUrlPath, $BackendOutLog, $BackendErrLog, $TunnelOutLog, $TunnelErrLog, $TunnelServiceLog -Force -ErrorAction SilentlyContinue

Write-Step "Kiem tra Python, Node.js, cloudflared, JDK 17 va Android SDK..."
Invoke-AsciiSafeRuntimeBootstrap

$Python = Join-Path $BackendDir ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $Python)) {
    throw "Khong tim thay backend virtualenv: $Python. Hay chay start_backend.bat mot lan de cai dependency."
}

Write-Step "Khoi tao PostgreSQL rieng: $DatabaseName"
& (Join-Path $BackendDir "local_db\init_local_postgres.ps1") `
    -DatabaseName $DatabaseName `
    -DatabaseUrlFileName "UAT_DATABASE_URL.txt"
$DatabaseUrl = (Get-Content -LiteralPath $DatabaseUrlPath -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) { throw "UAT_DATABASE_URL.txt rong." }

$shouldSeed = $ResetData -or -not (Test-Path -LiteralPath $SeedMarkerPath)
if ($ResetData -or -not (Test-Path -LiteralPath $DemoPasswordPath)) {
    $UatPassword = New-UatPassword
    Set-Content -LiteralPath $DemoPasswordPath -Value $UatPassword -Encoding ASCII
}
else {
    $UatPassword = (Get-Content -LiteralPath $DemoPasswordPath -Raw).Trim()
}
if (-not (Test-Path -LiteralPath $AuthSecretPath)) {
    Set-Content -LiteralPath $AuthSecretPath -Value (New-UatAuthSecret) -Encoding ASCII
}
$UatAuthSecret = (Get-Content -LiteralPath $AuthSecretPath -Raw).Trim()

$env:DATABASE_URL = $DatabaseUrl
$env:ECOLOOP_DEMO_PASSWORD = $UatPassword
$env:AUTH_SECRET = $UatAuthSecret
$backendProcess = $null
$backendService = $null
$tunnelProcess = $null
try {
    if ($shouldSeed) {
        Write-Step "Seed/reset du lieu UTEHY va tai khoan theo vai tro..."
        & $Python (Join-Path $BackendDir "local_db\seed_utehy_demo_data.py")
        if ($LASTEXITCODE -ne 0) { throw "Seed UAT that bai." }
        Set-Content -LiteralPath $SeedMarkerPath -Value (Get-Date).ToUniversalTime().ToString("o") -Encoding ASCII
    }
    else {
        Write-Step "Giu nguyen du lieu UAT hien tai. Dung -ResetData neu muon seed lai co chu dich."
    }

    $accountText = @"
Eco-loop Campus UAT - KHONG COMMIT/CHIA SE CONG KHAI
API se duoc ghi sau khi Cloudflare tunnel san sang.

Admin Web:
  Email: admin@utehy.edu.vn
  Password: $UatPassword

Dien thoai 1 - Sinh vien dong gop:
  Email: 10123001@utehy.edu.vn
  Password: $UatPassword

Dien thoai 2 - Tinh nguyen vien:
  Email: nam.tranhai@utehy.edu.vn
  Password: $UatPassword

Tinh nguyen vien thu hai (kiem tra ownership):
  Email: ha.phamthu@utehy.edu.vn
  Password: $UatPassword

Tinh nguyen vien cho duyet:
  Email: minh.leduc@utehy.edu.vn
  Password: $UatPassword

Sinh vien bi khoa:
  Email: 12523088@utehy.edu.vn
  Password: $UatPassword
"@
    [IO.File]::WriteAllText($AccountsPath, $accountText, [System.Text.UTF8Encoding]::new($false))

    Assert-UatPortAvailable -Port $BackendPort
    Write-Step "Khoi dong backend UAT tai 127.0.0.1:$BackendPort..."
    $backendArgs = @("-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "$BackendPort", "--workers", "1")
    $backendProcess = Start-Process -FilePath $Python -ArgumentList $backendArgs -WorkingDirectory $BackendDir `
        -RedirectStandardOutput $BackendOutLog -RedirectStandardError $BackendErrLog -WindowStyle Hidden -PassThru
    Save-UatProcessIdentity -Process $backendProcess -Path $BackendLauncherPidPath -Kind "backend-launcher"
    Wait-UatHealthy -Url "http://127.0.0.1:$BackendPort/api/health/db" -TimeoutSeconds $WaitSeconds `
        -ExpectedDatabase $DatabaseName -Process $backendProcess | Out-Null
    $backendService = Get-UatListenerProcess -Port $BackendPort
    if (-not $backendService) { throw "Backend healthy nhung khong tim thay process dang listen port $BackendPort." }
    Save-UatProcessIdentity -Process $backendService -Path $BackendPidPath -Kind "backend"

    Write-Step "Mo Cloudflare quick tunnel cho hai dien thoai khac mang..."
    $TunnelScript = Join-Path $PSScriptRoot "run_cloudflared_tunnel.ps1"
    $tunnelArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$TunnelScript`" -Name `"EcoLoop UAT API`" -Url `"http://127.0.0.1:$BackendPort`" -OutFile `"$PublicUrlPath`" -PidFile `"$TunnelPidPath`" -LogFile `"$TunnelServiceLog`""
    $tunnelProcess = Start-Process -FilePath "powershell.exe" -ArgumentList $tunnelArgs `
        -RedirectStandardOutput $TunnelOutLog -RedirectStandardError $TunnelErrLog -WindowStyle Hidden -PassThru

    $deadline = (Get-Date).AddSeconds($WaitSeconds)
    while (-not (Test-Path -LiteralPath $PublicUrlPath) -and (Get-Date) -lt $deadline) {
        if ($tunnelProcess.HasExited) { throw "Cloudflare tunnel dung som. Xem $TunnelErrLog" }
        Start-Sleep -Seconds 2
        $tunnelProcess.Refresh()
    }
    if (-not (Test-Path -LiteralPath $PublicUrlPath)) { throw "Cloudflare tunnel chua cap URL trong $WaitSeconds giay." }
    $PublicUrl = (Get-Content -LiteralPath $PublicUrlPath -Raw).Trim().TrimEnd("/")
    Wait-UatHealthy -Url "$PublicUrl/api/health/db" -TimeoutSeconds $WaitSeconds `
        -ExpectedDatabase $DatabaseName -Process $tunnelProcess | Out-Null
    Set-Content -LiteralPath $SharedPublicUrlPath -Value $PublicUrl -Encoding ASCII

    $accountText += "`r`nAPI public tam thoi: $PublicUrl`r`n"
    [IO.File]::WriteAllText($AccountsPath, $accountText, [System.Text.UTF8Encoding]::new($false))

    if (-not $SkipBuild) {
        Write-Step "Build Android UAT doc lap, nhung san API $PublicUrl..."
        $env:EXPO_PUBLIC_API_URL = $PublicUrl
        $env:EXPO_PUBLIC_AI_MODE = "remote"
        $SdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:LOCALAPPDATA "Android\Sdk" }
        $env:ANDROID_HOME = $SdkRoot
        $env:ANDROID_SDK_ROOT = $SdkRoot
        if (-not (Test-Path -LiteralPath (Join-Path $AndroidDir "gradlew.bat"))) { throw "Khong tim thay Android Gradle wrapper." }

        $buildDrive = Find-FreeDriveLetter
        $mapped = $false
        try {
            & subst.exe $buildDrive $ProjectDir
            if ($LASTEXITCODE -ne 0) { throw "Khong tao duoc subst $buildDrive cho project source." }
            $mapped = $true
            $JdkRoot = "$buildDrive\scripts\tools\jdk-17"
            if (Test-Path -LiteralPath (Join-Path $JdkRoot "bin\java.exe")) {
                $env:JAVA_HOME = $JdkRoot
                $env:Path = "$(Join-Path $JdkRoot 'bin');$env:Path"
            }
            Push-Location "$buildDrive\ecoloop-campus-mobile\ecoloop-campus-mobile\android"
            try {
                & .\gradlew.bat :app:createBundleUatJsAndAssets --rerun-tasks
                if ($LASTEXITCODE -ne 0) { throw "Bundle JavaScript UAT that bai." }
                & .\gradlew.bat assembleUat
                if ($LASTEXITCODE -ne 0) { throw "Build APK UAT that bai." }
            }
            finally { Pop-Location }
        }
        finally {
            if ($mapped) { & subst.exe $buildDrive /D | Out-Null }
        }

        $BuiltApk = Join-Path $AndroidDir "app\build\outputs\apk\uat\app-uat.apk"
        if (-not (Test-Path -LiteralPath $BuiltApk)) { throw "Gradle thanh cong nhung khong thay $BuiltApk" }
        Copy-Item -LiteralPath $BuiltApk -Destination $ApkPath -Force
        $ApkHash = (Get-FileHash -LiteralPath $ApkPath -Algorithm SHA256).Hash.ToLowerInvariant()
        Set-Content -LiteralPath $HashPath -Value "$ApkHash  ecoloop-campus-uat.apk" -Encoding ASCII
    }
    else {
        $ApkHash = "SKIPPED"
    }

    $summaryText = @"
Eco-loop Campus UAT ready
Public API: $PublicUrl
Database: $DatabaseName
APK: $ApkPath
SHA-256: $ApkHash
Accounts: $AccountsPath
Backend PID: $($backendService.Id)
Tunnel PID: $((Get-Content -LiteralPath $TunnelPidPath -Raw | ConvertFrom-Json).pid)

IMPORTANT: Keep this computer, backend and Cloudflare tunnel running while testing.
If the tunnel stops, rerun setup_uat.ps1 and reinstall the rebuilt APK because the URL changes.
"@
    [IO.File]::WriteAllText($SummaryPath, $summaryText, [System.Text.UTF8Encoding]::new($false))
    Write-Host ""
    Write-Host "[OK] UAT da san sang."
    Write-Host "[OK] APK: $ApkPath"
    Write-Host "[OK] SHA-256: $ApkHash"
    Write-Host "[OK] Tai khoan: $AccountsPath"
    Write-Host "[OK] API public: $PublicUrl"
    Write-Host "[INFO] Khong tat may hoac chay stop_uat.ps1 trong luc hai dien thoai dang test."
}
catch {
    $originalError = $_
    try { & (Join-Path $PSScriptRoot "stop_uat.ps1") -Quiet } catch { Write-Warning "UAT recorded-process cleanup failed: $($_.Exception.Message)" }
    foreach ($startedProcess in @($tunnelProcess, $backendProcess)) {
        if ($startedProcess) {
            try {
                $startedProcess.Refresh()
                if (-not $startedProcess.HasExited) { Stop-Process -Id $startedProcess.Id -Force }
            }
            catch { Write-Warning "UAT launcher cleanup failed: $($_.Exception.Message)" }
        }
    }
    throw $originalError
}
}
finally {
    foreach ($name in $EnvironmentNames) {
        [Environment]::SetEnvironmentVariable($name, $PreviousEnvironment[$name], "Process")
    }
}
