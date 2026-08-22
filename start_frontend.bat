@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

REM Eco-loop Campus - public web launcher
set "PROJECT_DIR=%~dp0"
set "FRONTEND_DIR=%PROJECT_DIR%frontend\eco-loop-campus-admin"
set "SCRIPTS_DIR=%PROJECT_DIR%scripts"
set "RUNTIME_DIR=%PROJECT_DIR%.runtime"
set "API_URL_FILE=%RUNTIME_DIR%\api_public_url.txt"

if "%WEB_HOST%"=="" set "WEB_HOST=127.0.0.1"
if "%WEB_PORT%"=="" set "WEB_PORT=3000"

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Khong tim thay package.json tai:
    echo %FRONTEND_DIR%
    pause
    exit /b 1
)

if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"
del "%RUNTIME_DIR%\web_public_url.txt" >nul 2>nul

echo [INFO] Kiem tra va tu cai moi truong frontend/public tunnel neu thieu...
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPTS_DIR%\ensure_windows_runtime.ps1" -Mode frontend
if errorlevel 1 (
    echo [ERROR] Kiem tra/cai moi truong frontend that bai.
    pause
    exit /b 1
)

if "%REACT_APP_API_URL%"=="" (
    if exist "%API_URL_FILE%" (
        set /p REACT_APP_API_URL=<"%API_URL_FILE%"
        echo [INFO] Dang dung API public tu backend: !REACT_APP_API_URL!
    ) else (
        set "REACT_APP_API_URL=http://127.0.0.1:8000"
        echo [WARN] Chua co API public URL. Frontend se build voi API local: !REACT_APP_API_URL!
        echo [TIP] Chay start_backend.bat truoc, doi file .runtime\api_public_url.txt xuat hien, roi chay lai frontend de public dung tu may khac.
    )
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

echo [INFO] Dang build web admin voi REACT_APP_API_URL=%REACT_APP_API_URL%
call npm run build
if errorlevel 1 (
    echo [ERROR] npm run build that bai.
    pause
    exit /b 1
)

cd /d "%PROJECT_DIR%"

echo [INFO] Dang mo web public tunnel...
start "Eco-loop Campus Web Public" powershell -NoExit -ExecutionPolicy Bypass -File "%SCRIPTS_DIR%\run_cloudflared_tunnel.ps1" -Name "Eco-loop Campus Web" -Url "http://%WEB_HOST%:%WEB_PORT%" -OutFile "%RUNTIME_DIR%\web_public_url.txt"

echo [INFO] Web local: http://%WEB_HOST%:%WEB_PORT%
echo [INFO] Web public URL se hien trong cua so "Eco-loop Campus Web Public".
echo [INFO] Nhan Ctrl+C de dung server.
node "%SCRIPTS_DIR%\serve_cra_build.js"

pause
