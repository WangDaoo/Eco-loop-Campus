@echo off
chcp 65001 >nul
setlocal

REM Start Eco-loop Campus web and API in separate terminal windows.
set "SCRIPT_DIR=%~dp0"

echo [INFO] Dang mo backend production window...
start "Eco-loop Campus API" cmd /k ""%SCRIPT_DIR%start_backend_prod.bat""

echo [INFO] Dang mo web production window...
start "Eco-loop Campus Web" cmd /k ""%SCRIPT_DIR%start_web_prod.bat""

echo [OK] Da gui lenh khoi dong.
echo [INFO] Kiem tra local sau khi build xong:
echo        Web: http://127.0.0.1:3000
echo        API: http://127.0.0.1:8000

pause
