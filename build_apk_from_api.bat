@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

REM Eco-loop Campus - build APK from a public backend API.
REM Usage:
REM   build_apk_from_api.bat
REM   build_apk_from_api.bat https://your-public-api.example.com

set "PROJECT_DIR=%~dp0"
set "MOBILE_DIR=%PROJECT_DIR%ecoloop-campus-mobile\ecoloop-campus-mobile"
set "MOBILE_ENV=%MOBILE_DIR%\.env"
set "MOBILE_ENV_EXAMPLE=%MOBILE_DIR%\.env.example"
set "DIST_DIR=%PROJECT_DIR%dist"
set "RELEASE_APK=%DIST_DIR%\ecoloop-campus-mobile-release.apk"
set "BUILD_APK_SOURCE=%MOBILE_DIR%\android\app\build\outputs\apk\release\app-release.apk"
set "EXIT_CODE=1"
set "BUILD_DRIVE="
set "MAPPED_SUBST=0"
set "API_URL=%~1"

if /i "%~1"=="--help" goto usage
if /i "%~1"=="-h" goto usage

if not defined API_URL (
    set /p "API_URL=Nhap API backend public: "
)

if not defined API_URL (
    echo [ERROR] Chua nhap API backend public.
    goto finish
)

REM Normalize and validate the URL without putting it into a PowerShell command line.
set "RAW_API_URL=%API_URL%"
set "API_URL="
for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$raw=$env:RAW_API_URL.Trim(); $raw=$raw.Trim('""', ''''); try { $u=[Uri]$raw; if ($u.Scheme -notin @('http','https') -or [string]::IsNullOrWhiteSpace($u.Host)) { exit 2 }; [Console]::WriteLine($u.AbsoluteUri.TrimEnd('/')) } catch { exit 2 }"`) do (
    set "API_URL=%%A"
)

if not defined API_URL (
    echo [ERROR] API URL khong hop le. Hay nhap dang https://...
    goto finish
)

set "CHECK_API_URL=%API_URL%"
echo.
echo [INFO] API backend: %API_URL%
echo [INFO] Kiem tra backend public...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $root=Invoke-WebRequest -UseBasicParsing -Uri ($env:CHECK_API_URL + '/') -TimeoutSec 20; if($root.StatusCode -ne 200 -or $root.Content -notmatch 'Eco-loop Campus Backend Running') { throw 'Dia chi nhap vao khong phai backend FastAPI' }; $db=Invoke-WebRequest -UseBasicParsing -Uri ($env:CHECK_API_URL + '/api/health/db') -TimeoutSec 20; if($db.StatusCode -ne 200) { throw ('HTTP ' + $db.StatusCode + ' at /api/health/db') }; $health=$db.Content | ConvertFrom-Json; if($health.status -ne 'ok') { throw ('Database status: ' + $health.status) }"
if errorlevel 1 (
    echo [ERROR] API public khong tra ve HTTP 200 o / hoac /api/health/db.
    echo [FIX] Kiem tra tunnel/backend dang chay va nhap dung URL goc, khong them /docs.
    goto finish
)
echo [OK] Backend public healthy.

if not exist "%MOBILE_DIR%\android\gradlew.bat" (
    echo [ERROR] Khong tim thay Android Gradle wrapper:
    echo %MOBILE_DIR%\android\gradlew.bat
    goto finish
)

if not exist "%MOBILE_DIR%\package.json" (
    echo [ERROR] Khong tim thay mobile package.json:
    echo %MOBILE_DIR%\package.json
    goto finish
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Chua cai Node.js hoac node khong co trong PATH.
    goto finish
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Chua cai npm hoac npm khong co trong PATH.
    goto finish
)

where java >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Chua cai Java JDK. Can JDK de build APK.
    goto finish
)

java -version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Java khong chay duoc. Kiem tra JAVA_HOME/JDK.
    goto finish
)

set "SDK_FROM_PROPERTIES="
if exist "%MOBILE_DIR%\android\local.properties" (
    set "MOBILE_LOCAL_PROPERTIES=%MOBILE_DIR%\android\local.properties"
    for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command "$line=Get-Content -LiteralPath $env:MOBILE_LOCAL_PROPERTIES -ErrorAction SilentlyContinue | Where-Object { $_ -like 'sdk.dir=*' } | Select-Object -First 1; if($line){[Console]::WriteLine($line.Substring(8))}"`) do (
        set "SDK_FROM_PROPERTIES=%%A"
    )
)

set "ANDROID_SDK_PATH=%SDK_FROM_PROPERTIES%"
if not defined ANDROID_SDK_PATH set "ANDROID_SDK_PATH=%ANDROID_HOME%"
if not defined ANDROID_SDK_PATH set "ANDROID_SDK_PATH=%ANDROID_SDK_ROOT%"
if not defined ANDROID_SDK_PATH if exist "%LOCALAPPDATA%\Android\Sdk" set "ANDROID_SDK_PATH=%LOCALAPPDATA%\Android\Sdk"

if not defined ANDROID_SDK_PATH (
    echo [ERROR] Khong tim thay Android SDK.
    echo [FIX] Cai Android SDK command-line tools va dat ANDROID_HOME, hoac tao android\local.properties.
    goto finish
)

if not exist "%ANDROID_SDK_PATH%\platforms" (
    echo [ERROR] Android SDK khong hop le:
    echo %ANDROID_SDK_PATH%
    goto finish
)

set "ANDROID_HOME=%ANDROID_SDK_PATH%"
set "ANDROID_SDK_ROOT=%ANDROID_SDK_PATH%"
set "TARGET_API_URL=%API_URL%"

echo [OK] Node, npm, Java va Android SDK da san sang.
echo.
echo [1/4] Ghi API public vao mobile .env...
if not exist "%MOBILE_ENV%" (
    if exist "%MOBILE_ENV_EXAMPLE%" (
        copy /y "%MOBILE_ENV_EXAMPLE%" "%MOBILE_ENV%" >nul
    ) else (
        type nul > "%MOBILE_ENV%"
    )
)

set "ENV_HELPER=%TEMP%\ecoloop_write_mobile_env_%RANDOM%.ps1"
> "%ENV_HELPER%" echo $ErrorActionPreference = 'Stop'
>>"%ENV_HELPER%" echo $path = $env:MOBILE_ENV
>>"%ENV_HELPER%" echo $value = $env:TARGET_API_URL
>>"%ENV_HELPER%" echo $text = if (Test-Path -LiteralPath $path) { [IO.File]::ReadAllText($path) } else { '' }
>>"%ENV_HELPER%" echo $lines = $text -split "`r?`n" ^| Where-Object { $_ -notmatch '^EXPO_PUBLIC_API_URL=' }
>>"%ENV_HELPER%" echo $out = (($lines + ("EXPO_PUBLIC_API_URL=" + $value)) -join "`r`n") + "`r`n"
>>"%ENV_HELPER%" echo [IO.File]::WriteAllText($path, $out, [Text.UTF8Encoding]::new($false))
powershell -NoProfile -ExecutionPolicy Bypass -File "%ENV_HELPER%"
set "ENV_HELPER_EXIT=%ERRORLEVEL%"
del /q "%ENV_HELPER%" >nul 2>nul
if not "%ENV_HELPER_EXIT%"=="0" (
    echo [ERROR] Khong ghi duoc mobile .env.
    goto finish
)
set "EXPO_PUBLIC_API_URL=%API_URL%"
echo [OK] EXPO_PUBLIC_API_URL=%API_URL%

echo.
echo [2/4] Cai dependency mobile neu thieu...
cd /d "%MOBILE_DIR%"
if not exist "node_modules" (
    if exist "package-lock.json" (
        call npm ci
    ) else (
        call npm install
    )
    if errorlevel 1 (
        echo [ERROR] Cai dependency mobile that bai.
        goto cleanup
    )
)
echo [OK] Mobile dependencies san sang.

echo.
echo [3/4] Tao duong dan build ASCII va build APK release...
for %%D in (Z Y X W V U T S R Q P O N M L K J I H G F) do (
    if not defined BUILD_DRIVE if not exist "%%D:\" set "BUILD_DRIVE=%%D:"
)

if not defined BUILD_DRIVE (
    echo [ERROR] Khong tim thay drive trong de subst.
    goto cleanup
)

subst %BUILD_DRIVE% "%MOBILE_DIR%"
if errorlevel 1 (
    echo [ERROR] Khong tao duoc subst %BUILD_DRIVE% cho:
    echo %MOBILE_DIR%
    goto cleanup
)
set "MAPPED_SUBST=1"

cd /d "%BUILD_DRIVE%\android"
call gradlew.bat :app:createBundleReleaseJsAndAssets --rerun-tasks --no-daemon
if errorlevel 1 (
    echo [ERROR] Tao JavaScript bundle release that bai.
    goto cleanup
)

call gradlew.bat assembleRelease --no-daemon
if errorlevel 1 (
    echo [ERROR] Build APK release that bai.
    goto cleanup
)

if not exist "%BUILD_APK_SOURCE%" (
    echo [ERROR] Gradle khong tao ra APK:
    echo %BUILD_APK_SOURCE%
    goto cleanup
)

echo.
echo [4/4] Chuyen APK vao dist va tinh SHA256...
if not exist "%DIST_DIR%" mkdir "%DIST_DIR%"
copy /y "%BUILD_APK_SOURCE%" "%RELEASE_APK%" >nul
if errorlevel 1 (
    echo [ERROR] Khong copy duoc APK vao dist.
    goto cleanup
)

set "HASH_FILE=%RELEASE_APK%.sha256"
set "HASH_VALUE="
for /f "tokens=1" %%H in ('certutil.exe -hashfile "%RELEASE_APK%" SHA256') do (
    if not defined HASH_VALUE if /i not "%%H"=="SHA256" if /i not "%%H"=="CertUtil:" set "HASH_VALUE=%%H"
)
if defined HASH_VALUE (
    >"%HASH_FILE%" echo !HASH_VALUE!  ecoloop-campus-mobile-release.apk
)

set "EXIT_CODE=0"
goto cleanup

:cleanup
if "%MAPPED_SUBST%"=="1" subst %BUILD_DRIVE% /d >nul 2>nul
cd /d "%PROJECT_DIR%"

if "%EXIT_CODE%"=="0" (
    echo.
    echo [DONE] Build APK thanh cong.
    echo [API]  %API_URL%
    echo [APK]  %RELEASE_APK%
    if defined HASH_VALUE echo [SHA256] %HASH_VALUE%
    if defined HASH_VALUE echo [SHA256 FILE] %HASH_FILE%
) else (
    echo.
    echo [ERROR] Build APK that bai.
)
goto finish

:usage
echo.
echo Build APK release voi API backend public do ban nhap.
echo.
echo Cach dung:
echo   build_apk_from_api.bat
echo   build_apk_from_api.bat https://ten-tunnel.trycloudflare.com
echo.
echo Yeu cau may:
echo   Node.js, npm, Java JDK, Android SDK va Gradle wrapper.
set "EXIT_CODE=0"

:finish
if not "%BUILD_APK_NO_PAUSE%"=="1" pause
exit /b %EXIT_CODE%
