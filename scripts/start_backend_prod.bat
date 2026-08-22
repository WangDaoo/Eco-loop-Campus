@echo off
chcp 65001 >nul
setlocal

REM Eco-loop Campus - production-like FastAPI launcher for laptop server
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_DIR=%%~fI"
set "BACKEND_DIR=%PROJECT_DIR%\backend"
set "VENV_PY=%BACKEND_DIR%\.venv\Scripts\python.exe"

set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

if "%BACKEND_HOST%"=="" set "BACKEND_HOST=127.0.0.1"
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8000"

if not exist "%BACKEND_DIR%\app.py" (
    echo [ERROR] Khong tim thay app.py tai: %BACKEND_DIR%
    pause
    exit /b 1
)

cd /d "%BACKEND_DIR%"

if not exist "%VENV_PY%" (
    echo [INFO] Chua co virtual environment. Dang tao .venv bang Python 3.10...
    py -3.10 -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Khong tao duoc .venv. Hay cai Python 3.10 roi chay lai.
        pause
        exit /b 1
    )
)

echo [INFO] Dang cai/cap nhat backend dependencies...
"%VENV_PY%" -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Cai dependencies that bai.
    pause
    exit /b 1
)

if "%CORS_ORIGINS%"=="" (
    echo [WARN] CORS_ORIGINS chua cau hinh. Backend se dung CORS mac dinh cho dev.
    echo [TIP] Khi public, set CORS_ORIGINS=https://your-web-domain.example
)

echo [INFO] Backend host: %BACKEND_HOST%
echo [INFO] Backend port: %BACKEND_PORT%
echo [INFO] Docs local: http://%BACKEND_HOST%:%BACKEND_PORT%/docs
echo [INFO] Nhan Ctrl+C de dung server.
"%VENV_PY%" -m uvicorn app:app --host %BACKEND_HOST% --port %BACKEND_PORT% --workers 1

pause
