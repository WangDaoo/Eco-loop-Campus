@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

REM Eco-loop Campus - native Windows server setup.
REM No Docker/WSL required. Runs PostgreSQL native + FastAPI + React web.

set "PROJECT_DIR=%~dp0"
set "SCRIPTS_DIR=%PROJECT_DIR%scripts"
set "RUNTIME_DIR=%PROJECT_DIR%.runtime"
set "API_URL_FILE=%RUNTIME_DIR%\api_public_url.txt"
set "WEB_URL_FILE=%RUNTIME_DIR%\web_public_url.txt"
set "ADMIN_EMAIL=%ADMIN_EMAIL%"
set "ADMIN_NAME=%ADMIN_NAME%"
set "ADMIN_PASSWORD=%ADMIN_PASSWORD%"
set "WAIT_SECONDS=900"

if "%ADMIN_EMAIL%"=="" set "ADMIN_EMAIL=admin@school.edu.vn"
if "%ADMIN_NAME%"=="" set "ADMIN_NAME=Eco-loop Admin"
if "%ADMIN_PASSWORD%"=="" set "ADMIN_PASSWORD=123456"
if "%BACKEND_HOST%"=="" set "BACKEND_HOST=127.0.0.1"
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8000"
if "%WEB_HOST%"=="" set "WEB_HOST=127.0.0.1"
if "%WEB_PORT%"=="" set "WEB_PORT=3002"

if not exist "!PROJECT_DIR!start_backend.bat" (
    echo [ERROR] Khong tim thay start_backend.bat trong:
    echo !PROJECT_DIR!
    pause
    exit /b 1
)

if not exist "!PROJECT_DIR!start_frontend.bat" (
    echo [ERROR] Khong tim thay start_frontend.bat trong:
    echo !PROJECT_DIR!
    pause
    exit /b 1
)

if not exist "!RUNTIME_DIR!" mkdir "!RUNTIME_DIR!"
del "!API_URL_FILE!" >nul 2>nul
del "!WEB_URL_FILE!" >nul 2>nul

echo [INFO] Eco-loop Campus native full server setup
echo [INFO] Project: !PROJECT_DIR!
echo [INFO] Khong dung Docker/WSL. Dung PostgreSQL native tren Windows.
echo.

echo [1/6] Kiem tra/cai Python, Node, PostgreSQL native va cloudflared...
powershell -NoProfile -ExecutionPolicy Bypass -File "!SCRIPTS_DIR!\ensure_windows_runtime.ps1" -Mode all -WithPostgres
if errorlevel 1 (
    echo [ERROR] Cai/kiem tra moi truong native that bai.
    echo [FIX] Neu dang cai PostgreSQL, hay chay CMD bang Run as administrator.
    pause
    exit /b 1
)

echo.
echo [2/6] Lay IP LAN cua laptop server...
set "SERVER_IP=%SETUP_SERVER_IP%"
if "!SERVER_IP!"=="" (
    for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceOperationalStatus -eq 'Up' } | Select-Object -First 1 -ExpandProperty IPAddress"`) do set "SERVER_IP=%%I"
)
if "!SERVER_IP!"=="" set "SERVER_IP=127.0.0.1"
echo [INFO] Server IP: !SERVER_IP!

net session >nul 2>nul
if errorlevel 1 (
    echo [WARN] File nay khong chay bang Administrator nen chua mo firewall tu dong.
    echo [FIX] Neu may khac khong vao duoc web/API, chay lai file nay bang Run as administrator.
) else (
    echo [INFO] Dang mo firewall cho backend/web...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "New-NetFirewallRule -DisplayName 'Eco-loop Campus Backend 8000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -ErrorAction SilentlyContinue | Out-Null;" ^
      "New-NetFirewallRule -DisplayName 'Eco-loop Campus Web %WEB_PORT%' -Direction Inbound -Action Allow -Protocol TCP -LocalPort %WEB_PORT% -ErrorAction SilentlyContinue | Out-Null"
)

echo.
echo [3/6] Khoi dong backend FastAPI + PostgreSQL native...
powershell -NoProfile -ExecutionPolicy Bypass -File "!SCRIPTS_DIR!\release_ecoloop_port.ps1" -Port %BACKEND_PORT% -Name "Eco-loop Campus Backend" -ProjectDir "!PROJECT_DIR!"
if errorlevel 1 (
    echo [ERROR] Khong giai phong duoc port backend %BACKEND_PORT%.
    pause
    exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "!SCRIPTS_DIR!\release_ecoloop_port.ps1" -Port %WEB_PORT% -Name "Eco-loop Campus Web" -ProjectDir "!PROJECT_DIR!"
if errorlevel 1 (
    echo [ERROR] Khong giai phong duoc port web %WEB_PORT%.
    pause
    exit /b 1
)
start "Eco-loop Campus Backend Native" cmd /k call "!PROJECT_DIR!start_backend.bat"

echo [INFO] Doi backend va PostgreSQL health...
for /l %%I in (1,1,!WAIT_SECONDS!) do (
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:%BACKEND_PORT%/api/health/db' -TimeoutSec 5; if ($r.Content -match 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
    if not errorlevel 1 goto backend_ok
    timeout /t 1 /nobreak >nul
)

echo [ERROR] Backend hoac PostgreSQL native chua healthy sau !WAIT_SECONDS! giay.
echo [FIX] Xem cua so "Eco-loop Campus Backend Native" de lay loi chi tiet.
pause
exit /b 1

:backend_ok
echo [OK] Backend local healthy: http://127.0.0.1:%BACKEND_PORT%

echo.
echo [4/6] Bootstrap admin mac dinh vao PostgreSQL native...
powershell -NoProfile -ExecutionPolicy Bypass -File "!SCRIPTS_DIR!\bootstrap_local_admin.ps1" -Email "!ADMIN_EMAIL!" -Name "!ADMIN_NAME!" -Password "!ADMIN_PASSWORD!"
if errorlevel 1 (
    echo [WARN] Bootstrap admin that bai. Backend van dang chay.
    echo [FIX] Co the chay lai sau:
    echo powershell -NoProfile -ExecutionPolicy Bypass -File scripts\bootstrap_local_admin.ps1 -Email "!ADMIN_EMAIL!" -Name "!ADMIN_NAME!" -Password "!ADMIN_PASSWORD!"
)

echo.
echo [5/6] Doi API public tunnel neu co...
for /l %%I in (1,1,120) do (
    if exist "!API_URL_FILE!" goto api_public_ready
    timeout /t 1 /nobreak >nul
)
echo [WARN] Chua co API public URL. Web van chay local/LAN.
goto start_web

:api_public_ready
set /p API_PUBLIC_URL=<"!API_URL_FILE!"
echo [OK] API public: !API_PUBLIC_URL!

:start_web
echo.
echo [6/6] Khoi dong web admin production...
start "Eco-loop Campus Web Native" cmd /k call "!PROJECT_DIR!start_frontend.bat"

echo [INFO] Doi web health...
for /l %%I in (1,1,!WAIT_SECONDS!) do (
    powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:%WEB_PORT%/' -TimeoutSec 5 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
    if not errorlevel 1 goto web_ok
    timeout /t 1 /nobreak >nul
)

echo [WARN] Web chua healthy sau !WAIT_SECONDS! giay.
echo [FIX] Xem cua so "Eco-loop Campus Web Native" de lay loi chi tiet.
goto summary

:web_ok
echo [OK] Web local healthy: http://127.0.0.1:%WEB_PORT%

for /l %%I in (1,1,120) do (
    if exist "!WEB_URL_FILE!" goto web_public_ready
    timeout /t 1 /nobreak >nul
)
goto summary

:web_public_ready
set /p WEB_PUBLIC_URL=<"!WEB_URL_FILE!"
echo [OK] Web public: !WEB_PUBLIC_URL!

:summary
echo.
echo [DONE] Eco-loop Campus native server da khoi dong.
echo [LOCAL] Backend: http://127.0.0.1:%BACKEND_PORT%
echo [LOCAL] Web:     http://127.0.0.1:%WEB_PORT%
echo [LAN] Backend:   http://!SERVER_IP!:%BACKEND_PORT%
echo [LAN] Web:       http://!SERVER_IP!:%WEB_PORT%
if defined API_PUBLIC_URL echo [PUBLIC] API:    !API_PUBLIC_URL!
if defined WEB_PUBLIC_URL echo [PUBLIC] Web:    !WEB_PUBLIC_URL!
echo [ADMIN] Email:   !ADMIN_EMAIL!
echo [ADMIN] Mat khau: !ADMIN_PASSWORD!
echo.
echo [NOTE] Giu 2 cua so Backend Native va Web Native dang mo de server tiep tuc chay.
echo [NOTE] Khong can Docker, khong can WSL2.
echo.
pause
