@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

REM Eco-loop Campus - one-click public release setup.
REM This starts backend + API tunnel, builds web/mobile with that public API,
REM copies the APK to dist, then starts the public web tunnel.

set "PROJECT_DIR=%~dp0"
set "SCRIPTS_DIR=%PROJECT_DIR%scripts"
set "TOOLS_DIR=%SCRIPTS_DIR%\tools"
set "RUNTIME_DIR=%PROJECT_DIR%.runtime"
set "DIST_DIR=%PROJECT_DIR%dist"
set "API_URL_FILE=%RUNTIME_DIR%\api_public_url.txt"
set "WEB_URL_FILE=%RUNTIME_DIR%\web_public_url.txt"
set "APK_URL_FILE=%RUNTIME_DIR%\apk_api_url.txt"
set "PUBLIC_WAIT_SECONDS=900"

set "FRONTEND_DIR=%PROJECT_DIR%frontend\eco-loop-campus-admin"
set "FRONTEND_ENV=%FRONTEND_DIR%\.env.local"

set "MOBILE_DIR=%PROJECT_DIR%ecoloop-campus-mobile\ecoloop-campus-mobile"
set "MOBILE_ENV=%MOBILE_DIR%\.env"
set "MOBILE_ENV_EXAMPLE=%MOBILE_DIR%\.env.example"
set "RELEASE_APK=%PROJECT_DIR%dist\ecoloop-campus-mobile-release.apk"
set "BUILD_APK_MODE=%SETUP_BUILD_APK%"
set "APK_BUILT=0"
set "APK_SKIP_REASON="

if "%BACKEND_HOST%"=="" set "BACKEND_HOST=127.0.0.1"
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8000"
if "%WEB_HOST%"=="" set "WEB_HOST=127.0.0.1"
if "%WEB_PORT%"=="" set "WEB_PORT=3000"
if "%BUILD_APK_MODE%"=="" set "BUILD_APK_MODE=auto"

if not exist "%PROJECT_DIR%start_backend.bat" (
    echo [ERROR] Khong tim thay start_backend.bat trong root project.
    pause
    exit /b 1
)

if not exist "%PROJECT_DIR%start_frontend.bat" (
    echo [ERROR] Khong tim thay start_frontend.bat trong root project.
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Khong tim thay frontend package.json:
    echo %FRONTEND_DIR%
    pause
    exit /b 1
)

if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"
if not exist "%DIST_DIR%" mkdir "%DIST_DIR%"

del "%API_URL_FILE%" >nul 2>nul
del "%WEB_URL_FILE%" >nul 2>nul
del "%APK_URL_FILE%" >nul 2>nul

echo [INFO] Eco-loop Campus public setup + APK release build
echo [INFO] Project: %PROJECT_DIR%
echo.

echo [1/7] Kiem tra runtime Windows, Node, Python, cloudflared...
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPTS_DIR%\ensure_windows_runtime.ps1" -Mode all
if errorlevel 1 (
    echo [ERROR] Runtime chua san sang.
    pause
    exit /b 1
)

echo.
echo [2/7] Khoi dong backend va API public tunnel...
start "Eco-loop Campus Backend + API Tunnel" cmd /k ""%PROJECT_DIR%start_backend.bat""

echo [INFO] Dang doi API public URL trong .runtime\api_public_url.txt...
for /l %%I in (1,1,%PUBLIC_WAIT_SECONDS%) do (
    if exist "%API_URL_FILE%" goto api_ready
    timeout /t 1 /nobreak >nul
)

echo [ERROR] Qua %PUBLIC_WAIT_SECONDS% giay chua co API public URL.
echo [FIX] Xem cua so "Eco-loop Campus Backend + API Tunnel" de kiem tra backend/cloudflared.
pause
exit /b 1

:api_ready
set /p API_PUBLIC_URL=<"%API_URL_FILE%"
echo [OK] API public: %API_PUBLIC_URL%

echo [INFO] Doi backend local + PostgreSQL healthy...
for /l %%I in (1,1,%PUBLIC_WAIT_SECONDS%) do (
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8000/api/health/db' -TimeoutSec 10; if ($r.Content -match 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }"
    if not errorlevel 1 goto backend_local_ok
    timeout /t 1 /nobreak >nul
)

echo [ERROR] Backend hoac PostgreSQL chua healthy sau %PUBLIC_WAIT_SECONDS% giay.
pause
exit /b 1

:backend_local_ok
echo [OK] Backend local + PostgreSQL healthy.

echo [INFO] Doi backend public health...
for /l %%I in (1,1,%PUBLIC_WAIT_SECONDS%) do (
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%API_PUBLIC_URL%/api/health/db' -TimeoutSec 20; if ($r.StatusCode -eq 200 -and $r.Content -match 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }"
    if not errorlevel 1 goto backend_public_ok
    timeout /t 1 /nobreak >nul
)

echo [ERROR] API public chua truy cap duoc tu tunnel sau %PUBLIC_WAIT_SECONDS% giay.
pause
exit /b 1

:backend_public_ok
echo [OK] Backend public healthy.

echo.
echo [3/7] Ghi cau hinh public API cho web va mobile...
if not exist "%MOBILE_ENV%" (
    if exist "%MOBILE_ENV_EXAMPLE%" (
        copy "%MOBILE_ENV_EXAMPLE%" "%MOBILE_ENV%" >nul
    ) else (
        type nul > "%MOBILE_ENV%"
    )
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$api = '%API_PUBLIC_URL%';" ^
  "$frontendEnv = '%FRONTEND_ENV%';" ^
  "$mobileEnv = '%MOBILE_ENV%';" ^
  "function Set-EnvValue([string]$path, [string]$key, [string]$value) {" ^
  "  if (Test-Path -LiteralPath $path) { $text = Get-Content -LiteralPath $path -Raw } else { $text = '' }" ^
  "  if ($text -match ('(?m)^' + [regex]::Escape($key) + '=')) { $text = [regex]::Replace($text, ('(?m)^' + [regex]::Escape($key) + '=.*$'), ($key + '=' + $value)) }" ^
  "  else { if ($text.Length -gt 0 -and -not $text.EndsWith(\"`n\")) { $text += \"`r`n\" }; $text += ($key + '=' + $value + \"`r`n\") }" ^
  "  [IO.File]::WriteAllText($path, $text, [System.Text.UTF8Encoding]::new($false))" ^
  "}" ^
  "Set-EnvValue $frontendEnv 'REACT_APP_API_URL' $api;" ^
  "Set-EnvValue $mobileEnv 'EXPO_PUBLIC_API_URL' $api;"
if errorlevel 1 (
    echo [ERROR] Khong ghi duoc .env web/mobile.
    pause
    exit /b 1
)

set "REACT_APP_API_URL=%API_PUBLIC_URL%"
set "EXPO_PUBLIC_API_URL=%API_PUBLIC_URL%"
echo %API_PUBLIC_URL%>"%APK_URL_FILE%"

if /i "%BUILD_APK_MODE%"=="0" (
    set "APK_SKIP_REASON=SETUP_BUILD_APK=0"
    goto skip_apk_build
)

if /i not "%BUILD_APK_MODE%"=="auto" if /i not "%BUILD_APK_MODE%"=="1" (
    echo [ERROR] SETUP_BUILD_APK chi nhan: auto, 1, hoac 0.
    pause
    exit /b 1
)

if not exist "%MOBILE_DIR%\android\gradlew.bat" (
    if /i "%BUILD_APK_MODE%"=="1" (
        echo [ERROR] Khong tim thay Android Gradle wrapper:
        echo %MOBILE_DIR%\android\gradlew.bat
        pause
        exit /b 1
    )
    set "APK_SKIP_REASON=Khong co Android Gradle wrapper trong source"
    goto skip_apk_build
)

set "ANDROID_SDK_PATH=%ANDROID_HOME%"
if "%ANDROID_SDK_PATH%"=="" set "ANDROID_SDK_PATH=%ANDROID_SDK_ROOT%"
if "%ANDROID_SDK_PATH%"=="" if exist "%LOCALAPPDATA%\Android\Sdk" set "ANDROID_SDK_PATH=%LOCALAPPDATA%\Android\Sdk"

if "%ANDROID_SDK_PATH%"=="" (
    echo [INFO] Khong tim thay Android SDK. Dang cai Android SDK command-line tools...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPTS_DIR%\ensure_windows_runtime.ps1" -Mode frontend -WithAndroid
    if errorlevel 1 (
        echo [ERROR] Cai Android SDK/JDK that bai.
        pause
        exit /b 1
    )
    set "ANDROID_SDK_PATH=%LOCALAPPDATA%\Android\Sdk"
    if not "%ANDROID_HOME%"=="" set "ANDROID_SDK_PATH=%ANDROID_HOME%"
    if exist "%TOOLS_DIR%\jdk-17\bin\java.exe" (
        set "JAVA_HOME=%TOOLS_DIR%\jdk-17"
        set "PATH=%TOOLS_DIR%\jdk-17\bin;%PATH%"
    )
    if "%ANDROID_SDK_PATH%"=="" (
        set "APK_SKIP_REASON=May server khong co Android SDK"
        goto skip_apk_build
    )
)

where java >nul 2>nul
if errorlevel 1 (
    echo [INFO] Khong tim thay Java/JDK. Dang cai JDK 17 va Android SDK...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPTS_DIR%\ensure_windows_runtime.ps1" -Mode frontend -WithAndroid
    if errorlevel 1 (
        echo [ERROR] Cai JDK 17/Android SDK that bai.
        pause
        exit /b 1
    )
    if exist "%TOOLS_DIR%\jdk-17\bin\java.exe" (
        set "JAVA_HOME=%TOOLS_DIR%\jdk-17"
        set "PATH=%TOOLS_DIR%\jdk-17\bin;%PATH%"
    )
    where java >nul 2>nul
    if errorlevel 1 (
        set "APK_SKIP_REASON=May server khong co Java/JDK"
        goto skip_apk_build
    )
)

set "ANDROID_HOME=%ANDROID_SDK_PATH%"
set "ANDROID_SDK_ROOT=%ANDROID_SDK_PATH%"

echo.
echo [4/7] Cai dependency mobile neu thieu...
cd /d "%MOBILE_DIR%"
if not exist "node_modules" (
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install mobile that bai.
        pause
        exit /b 1
    )
)

echo.
echo [5/7] Build APK release voi EXPO_PUBLIC_API_URL=%EXPO_PUBLIC_API_URL%
set "BUILD_DRIVE="
set "MAPPED_SUBST=0"
for %%D in (Z Y X W V U T S R Q P O N M L K J I H G F) do (
    if not exist "%%D:\" (
        set "BUILD_DRIVE=%%D:"
        goto build_drive_found
    )
)

echo [ERROR] Khong tim thay o dia trong de subst build Android.
pause
exit /b 1

:build_drive_found
subst %BUILD_DRIVE% "%MOBILE_DIR%"
if errorlevel 1 (
    echo [ERROR] Khong tao duoc subst %BUILD_DRIVE% cho:
    echo %MOBILE_DIR%
    pause
    exit /b 1
)
set "MAPPED_SUBST=1"

cd /d "%BUILD_DRIVE%\android"
call gradlew.bat :app:createBundleReleaseJsAndAssets --rerun-tasks
if errorlevel 1 (
    set "GRADLE_EXIT=!ERRORLEVEL!"
    cd /d "%PROJECT_DIR%"
    if "%MAPPED_SUBST%"=="1" subst %BUILD_DRIVE% /d
    echo [ERROR] Build JS bundle release that bai.
    pause
    exit /b !GRADLE_EXIT!
)
call gradlew.bat assembleRelease
set "GRADLE_EXIT=%ERRORLEVEL%"
cd /d "%PROJECT_DIR%"
if "%MAPPED_SUBST%"=="1" subst %BUILD_DRIVE% /d

if not "%GRADLE_EXIT%"=="0" (
    echo [ERROR] Build APK release that bai.
    pause
    exit /b %GRADLE_EXIT%
)

copy "%MOBILE_DIR%\android\app\build\outputs\apk\release\app-release.apk" "%RELEASE_APK%" >nul
if errorlevel 1 (
    echo [ERROR] Khong copy duoc APK release vao dist.
    pause
    exit /b 1
)
set "APK_BUILT=1"
echo [OK] APK release: %RELEASE_APK%

echo.
echo [6/7] Cai APK vao thiet bi ADB neu dang cam/gia lap...
where adb >nul 2>nul
if errorlevel 1 (
    if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
        set "ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
    ) else (
        set "ADB="
    )
) else (
    set "ADB=adb"
)

if "%ADB%"=="" (
    echo [WARN] Khong tim thay adb, bo qua buoc cai APK.
) else (
    for /f "skip=1 tokens=1,2" %%A in ('"%ADB%" devices') do (
        if "%%B"=="device" (
            echo [INFO] Dang cai APK vao %%A...
            "%ADB%" -s %%A install --no-streaming -r "%RELEASE_APK%"
        )
    )
)

goto after_apk_build

:skip_apk_build
echo.
echo [WARN] Bo qua build/cai APK: %APK_SKIP_REASON%.
echo [FIX] May server khong co Android Studio van public duoc backend/web.
echo [FIX] Build APK tren may dev co Android Studio, hoac cai Android SDK + JDK roi chay: set SETUP_BUILD_APK=1

:after_apk_build
echo.
echo [7/7] Khoi dong web build + web public tunnel...
start "Eco-loop Campus Web Public" cmd /k ""%PROJECT_DIR%start_frontend.bat""

echo [INFO] Dang doi web public URL trong .runtime\web_public_url.txt...
for /l %%I in (1,1,%PUBLIC_WAIT_SECONDS%) do (
    if exist "%WEB_URL_FILE%" goto web_ready
    timeout /t 1 /nobreak >nul
)

echo [WARN] Qua %PUBLIC_WAIT_SECONDS% giay chua co web public URL.
echo [WARN] Xem cua so "Eco-loop Campus Web Public" de kiem tra frontend/cloudflared.
goto summary

:web_ready
set /p WEB_PUBLIC_URL=<"%WEB_URL_FILE%"
echo [OK] Web public: %WEB_PUBLIC_URL%
echo [INFO] Kiem tra web public HTTP 200...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%WEB_PUBLIC_URL%/' -TimeoutSec 20; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
    echo [WARN] Web public da co URL nhung chua tra HTTP 200. Cho them 60 giay...
    for /l %%I in (1,1,60) do (
        powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%WEB_PUBLIC_URL%/' -TimeoutSec 10; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
        if not errorlevel 1 goto web_public_ok
        timeout /t 1 /nobreak >nul
    )
    echo [WARN] Web public van chua tra HTTP 200. Xem cua so "Eco-loop Campus Web Public".
    goto summary
)

:web_public_ok
echo [OK] Web public HTTP 200.

:summary
echo.
echo [DONE] Setup public release da gui lenh hoan tat.
echo [LOCAL] Backend: http://127.0.0.1:8000
echo [LOCAL] Web:     http://127.0.0.1:3000
echo [PUBLIC] API:    %API_PUBLIC_URL%
if defined WEB_PUBLIC_URL echo [PUBLIC] Web:    %WEB_PUBLIC_URL%
if "%APK_BUILT%"=="1" (
    echo [APK] %RELEASE_APK%
) else (
    echo [APK] Chua build tren may nay: %APK_SKIP_REASON%
)
echo.
echo [NOTE] Link trycloudflare la tunnel tam. Neu tat cua so tunnel hoac restart, URL se doi va can build lai web/APK.
echo [NOTE] Muon on dinh cho thiet bi bat ky, dung Cloudflare named tunnel/domain co dinh.
echo.
pause
