@echo off
chcp 65001 >nul
setlocal

REM Eco-loop Campus - production-like web launcher for laptop server
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_DIR=%%~fI"
set "FRONTEND_DIR=%PROJECT_DIR%\frontend\eco-loop-campus-admin"

if "%WEB_HOST%"=="" set "WEB_HOST=127.0.0.1"
if "%WEB_PORT%"=="" set "WEB_PORT=3000"

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Khong tim thay package.json tai: %FRONTEND_DIR%
    pause
    exit /b 1
)

cd /d "%FRONTEND_DIR%"

if not exist "node_modules" (
    echo [INFO] Chua co node_modules. Dang chay npm install...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install that bai.
        pause
        exit /b 1
    )
)

if "%REACT_APP_API_URL%"=="" (
    echo [WARN] REACT_APP_API_URL chua set trong cua so nay.
    echo [TIP] CRA se doc .env.production.local hoac .env.local neu co.
)

echo [INFO] Dang build web admin...
call npm run build
if errorlevel 1 (
    echo [ERROR] npm run build that bai.
    pause
    exit /b 1
)

cd /d "%PROJECT_DIR%"
echo [INFO] Web host: %WEB_HOST%
echo [INFO] Web port: %WEB_PORT%
echo [INFO] Web local: http://%WEB_HOST%:%WEB_PORT%
echo [INFO] Nhan Ctrl+C de dung server.
node "%PROJECT_DIR%\scripts\serve_cra_build.js"

pause
