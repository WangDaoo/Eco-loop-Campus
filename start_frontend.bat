@echo off
chcp 65001 >nul
setlocal

REM Eco-loop Campus - Frontend launcher
set "PROJECT_DIR=%~dp0"
set "FRONTEND_DIR=%PROJECT_DIR%frontend\eco-loop-campus-admin"

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Khong tim thay package.json tai:
    echo %FRONTEND_DIR%
    pause
    exit /b 1
)

cd /d "%FRONTEND_DIR%"

echo [INFO] Dang khoi dong frontend...
echo [INFO] Thu muc: %CD%

if not exist "node_modules" (
    echo [INFO] Chua co node_modules. Dang chay npm install...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install that bai.
        pause
        exit /b 1
    )
)

echo [INFO] Frontend se chay tai: http://localhost:3000
echo [INFO] Nhan Ctrl+C de dung server.
call npm start

pause
