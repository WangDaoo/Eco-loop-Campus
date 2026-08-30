@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

set "PROJECT_DIR=%~dp0"
set "ENV_FILE=%PROJECT_DIR%.env.docker"
set "ENV_EXAMPLE=%PROJECT_DIR%.env.docker.example"
set "ADMIN_EMAIL=%ADMIN_EMAIL%"
set "ADMIN_NAME=%ADMIN_NAME%"
set "ADMIN_PASSWORD=%ADMIN_PASSWORD%"

if "%ADMIN_EMAIL%"=="" set "ADMIN_EMAIL=admin@school.edu.vn"
if "%ADMIN_NAME%"=="" set "ADMIN_NAME=Eco-loop Admin"
if "%ADMIN_PASSWORD%"=="" set "ADMIN_PASSWORD=123456"

if not exist "%PROJECT_DIR%docker-compose.yml" (
    echo [ERROR] Khong tim thay docker-compose.yml trong:
    echo %PROJECT_DIR%
    pause
    exit /b 1
)

if not exist "%ENV_EXAMPLE%" (
    echo [ERROR] Khong tim thay .env.docker.example.
    pause
    exit /b 1
)

echo [INFO] Eco-loop Campus full server setup
echo [INFO] Project: %PROJECT_DIR%

where docker >nul 2>nul
if errorlevel 1 (
    echo [WARN] Chua cai Docker Desktop hoac docker chua co trong PATH.
    where winget >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Khong co winget de tu cai Docker Desktop.
        echo [FIX] Cai Docker Desktop thu cong: https://www.docker.com/products/docker-desktop/
        pause
        exit /b 1
    )

    if /i not "%SETUP_INSTALL_DOCKER%"=="1" (
        set /p INSTALL_DOCKER=Ban co muon cai Docker Desktop bang winget ngay bay gio? [Y/N]:
        if /i not "!INSTALL_DOCKER!"=="Y" (
            echo [STOP] Chua cai Docker. Cai Docker Desktop roi chay lai file nay.
            pause
            exit /b 1
        )
    )

    echo [INFO] Dang cai Docker Desktop bang winget...
    winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
    if errorlevel 1 (
        echo [ERROR] Cai Docker Desktop that bai.
        pause
        exit /b 1
    )
    echo [NEXT] Mo Docker Desktop, bat WSL2 backend neu duoc hoi, restart terminal neu can, roi chay lai setup_server_full.bat.
    pause
    exit /b 2
)

docker compose version >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Docker Compose chua san sang. Hay cap nhat Docker Desktop.
    pause
    exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
    echo [WARN] Docker daemon chua chay. Dang thu mo Docker Desktop...
    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    )

    for /l %%I in (1,1,40) do (
        docker info >nul 2>nul
        if not errorlevel 1 goto docker_ready
        echo [INFO] Doi Docker Desktop khoi dong... %%I/40
        timeout /t 5 /nobreak >nul
    )

    echo [ERROR] Docker daemon van chua chay.
    echo [FIX] Mo Docker Desktop va doi den khi hien Running, roi chay lai file nay.
    pause
    exit /b 1
)

:docker_ready

set "SERVER_IP=%SETUP_SERVER_IP%"
if "%SERVER_IP%"=="" (
    for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceOperationalStatus -eq 'Up' } | Select-Object -First 1 -ExpandProperty IPAddress"`) do set "SERVER_IP=%%I"
)
if "%SERVER_IP%"=="" set "SERVER_IP=127.0.0.1"

if not exist "%ENV_FILE%" (
    copy "%ENV_EXAMPLE%" "%ENV_FILE%" >nul
    echo [INFO] Da tao .env.docker tu .env.docker.example.
)

echo [INFO] Cau hinh .env.docker cho server IP: %SERVER_IP%
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$path = '%ENV_FILE%';" ^
  "$ip = '%SERVER_IP%';" ^
  "$text = Get-Content -Raw $path;" ^
  "if ($text -match 'AUTH_SECRET=replace-this-with-a-long-random-secret') {" ^
  "  $bytes = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Fill($bytes);" ^
  "  $secret = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_');" ^
  "  $text = $text -replace 'AUTH_SECRET=.*', ('AUTH_SECRET=' + $secret);" ^
  "}" ^
  "$text = $text -replace 'REACT_APP_API_URL=.*', ('REACT_APP_API_URL=http://' + $ip + ':8000');" ^
  "$text = $text -replace 'CORS_ORIGINS=.*', ('CORS_ORIGINS=http://127.0.0.1:3000,http://localhost:3000,http://10.0.2.2:3000,http://' + $ip + ':3000');" ^
  "$text = $text -replace 'BACKEND_PORT=.*', 'BACKEND_PORT=8000';" ^
  "$text = $text -replace 'WEB_PORT=.*', 'WEB_PORT=3000';" ^
  "Set-Content -Encoding UTF8 $path $text"
if errorlevel 1 (
    echo [ERROR] Khong cap nhat duoc .env.docker.
    pause
    exit /b 1
)

net session >nul 2>nul
if errorlevel 1 (
    echo [WARN] File nay khong chay bang quyen Administrator nen chua mo firewall tu dong.
    echo [FIX] Neu may khac khong vao duoc, chay lai bang Run as administrator.
) else (
    echo [INFO] Dang mo firewall cho web/API...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "New-NetFirewallRule -DisplayName 'Eco-loop Campus Backend 8000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -ErrorAction SilentlyContinue | Out-Null;" ^
      "New-NetFirewallRule -DisplayName 'Eco-loop Campus Web 3000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -ErrorAction SilentlyContinue | Out-Null"
)

cd /d "%PROJECT_DIR%"

echo [INFO] Kiem tra cau hinh Docker Compose...
docker compose --env-file "%ENV_FILE%" config >nul
if errorlevel 1 (
    echo [ERROR] docker compose config that bai. Kiem tra .env.docker va docker-compose.yml.
    pause
    exit /b 1
)

echo [INFO] Build va chay full stack o che do server background...
docker compose --env-file "%ENV_FILE%" up -d --build
if errorlevel 1 (
    echo [ERROR] docker compose up that bai.
    echo [TIP] Xem log bang: docker compose --env-file .env.docker logs -f backend
    pause
    exit /b 1
)

echo [INFO] Doi backend PostgreSQL health...
for /l %%I in (1,1,60) do (
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8000/api/health/db' -TimeoutSec 5; if ($r.Content -match 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
    if not errorlevel 1 goto backend_ok
    echo [INFO] Doi backend/CSDL... %%I/60
    timeout /t 3 /nobreak >nul
)

echo [ERROR] Backend hoac PostgreSQL chua healthy.
docker compose --env-file "%ENV_FILE%" ps
echo [TIP] Xem log bang: docker compose --env-file .env.docker logs -f backend
pause
exit /b 1

:backend_ok

echo [INFO] Doi AI queue health...
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8000/predict/queue' -TimeoutSec 10 | Out-Null"
if errorlevel 1 (
    echo [WARN] Backend len nhung /predict/queue chua san sang. Kiem tra log model AI neu can.
)

echo [INFO] Doi web health...
for /l %%I in (1,1,40) do (
    powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000/' -TimeoutSec 5 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>nul
    if not errorlevel 1 goto web_ok
    echo [INFO] Doi web... %%I/40
    timeout /t 3 /nobreak >nul
)

echo [ERROR] Web chua healthy.
docker compose --env-file "%ENV_FILE%" ps
pause
exit /b 1

:web_ok

echo [INFO] Bootstrap admin mac dinh...
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%scripts\docker_bootstrap_admin.ps1" -Email "%ADMIN_EMAIL%" -Name "%ADMIN_NAME%" -Password "%ADMIN_PASSWORD%"
if errorlevel 1 (
    echo [WARN] Bootstrap admin that bai. Co the chay lai lenh nay sau:
    echo powershell -NoProfile -ExecutionPolicy Bypass -File scripts\docker_bootstrap_admin.ps1 -Email "%ADMIN_EMAIL%" -Name "%ADMIN_NAME%" -Password "%ADMIN_PASSWORD%"
)

echo.
echo [OK] Eco-loop Campus server da san sang.
echo [URL] Web local: http://127.0.0.1:3000
echo [URL] Backend local: http://127.0.0.1:8000
echo [URL] Web LAN: http://%SERVER_IP%:3000
echo [URL] Backend LAN: http://%SERVER_IP%:8000
echo [APP] APK trong cung Wi-Fi nen build voi: EXPO_PUBLIC_API_URL=http://%SERVER_IP%:8000
echo [ADMIN] Email: %ADMIN_EMAIL%
echo [ADMIN] Mat khau: %ADMIN_PASSWORD%
echo.
echo [CHECK] docker compose --env-file .env.docker ps
docker compose --env-file "%ENV_FILE%" ps
echo.
pause
