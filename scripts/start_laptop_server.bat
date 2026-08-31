@echo off
chcp 65001 >nul
setlocal

REM Start Eco-loop Campus API and web with public Cloudflare quick tunnels.
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_DIR=%%~fI"
set "RUNTIME_DIR=%PROJECT_DIR%\.runtime"
set "API_URL_FILE=%RUNTIME_DIR%\api_public_url.txt"

if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"
del "%API_URL_FILE%" >nul 2>nul
del "%RUNTIME_DIR%\web_public_url.txt" >nul 2>nul

echo [INFO] Dang mo backend public window...
start "Eco-loop Campus API" cmd /k ""%PROJECT_DIR%\start_backend.bat""

echo [INFO] Dang doi API public URL de build frontend dung endpoint...
for /l %%I in (1,1,120) do (
    if exist "%API_URL_FILE%" goto api_ready
    timeout /t 1 /nobreak >nul
)

echo [WARN] Qua 120 giay chua thay api_public_url.txt.
echo [WARN] Van mo frontend, nhung neu REACT_APP_API_URL chua co thi web public se dung API local.
goto start_web

:api_ready
set /p API_PUBLIC_URL=<"%API_URL_FILE%"
echo [OK] API public: %API_PUBLIC_URL%

:start_web
echo [INFO] Dang mo frontend public window...
start "Eco-loop Campus Web" cmd /k ""%PROJECT_DIR%\start_frontend.bat""

echo [OK] Da gui lenh khoi dong public server.
echo [INFO] Local:
echo        API: http://127.0.0.1:8000
echo        Web: http://127.0.0.1:3002
echo [INFO] Public URL se nam trong:
echo        %RUNTIME_DIR%\api_public_url.txt
echo        %RUNTIME_DIR%\web_public_url.txt

pause
