@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

set "PROJECT_DIR=%~dp0"
set "ENV_FILE=%PROJECT_DIR%.env.docker"
set "ENV_EXAMPLE=%PROJECT_DIR%.env.docker.example"

where docker >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Chua cai Docker Desktop hoac docker chua co trong PATH.
    echo [FIX] Cai Docker Desktop: https://www.docker.com/products/docker-desktop/
    echo [FIX] Bat WSL2 backend trong Docker Desktop, mo lai terminal, roi chay start_docker.bat.
    pause
    exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Docker Compose chua san sang. Hay cap nhat Docker Desktop ban moi.
    pause
    exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Docker daemon chua chay.
    echo [FIX] Mo Docker Desktop va doi den khi hien trang thai Running.
    pause
    exit /b 1
)

if not exist "%ENV_FILE%" (
    if not exist "%ENV_EXAMPLE%" (
        echo [ERROR] Khong tim thay .env.docker.example.
        pause
        exit /b 1
    )
    copy "%ENV_EXAMPLE%" "%ENV_FILE%" >nul
    powershell -NoProfile -ExecutionPolicy Bypass -Command "$path = '%ENV_FILE%'; $bytes = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Fill($bytes); $secret = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_'); (Get-Content -Raw $path) -replace 'AUTH_SECRET=.*', ('AUTH_SECRET=' + $secret) | Set-Content -Encoding UTF8 $path"
    echo [INFO] Da tao .env.docker tu file mau va sinh AUTH_SECRET moi.
)

cd /d "%PROJECT_DIR%"

echo [INFO] Kiem tra cau hinh Docker Compose...
docker compose --env-file "%ENV_FILE%" config >nul
if errorlevel 1 (
    echo [ERROR] docker compose config that bai. Kiem tra .env.docker va docker-compose.yml.
    pause
    exit /b 1
)

echo [INFO] Dang build va chay Eco-loop Campus bang Docker...
echo [INFO] Backend: http://127.0.0.1:8000
echo [INFO] Web: http://127.0.0.1:3000
echo [INFO] PostgreSQL: 127.0.0.1:5432
echo [INFO] APK Android Studio Emulator goi backend qua http://10.0.2.2:8000
docker compose --env-file "%ENV_FILE%" up --build

pause
