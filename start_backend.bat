@echo off
chcp 65001 >nul
setlocal

REM Eco-loop Campus - public FastAPI launcher
set "PROJECT_DIR=%~dp0"
set "BACKEND_DIR=%PROJECT_DIR%backend"
set "SCRIPTS_DIR=%PROJECT_DIR%scripts"
set "RUNTIME_DIR=%PROJECT_DIR%.runtime"
set "VENV_PY=%BACKEND_DIR%\.venv\Scripts\python.exe"

set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
if "%BACKEND_HOST%"=="" set "BACKEND_HOST=127.0.0.1"
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8000"

if not exist "%BACKEND_DIR%\app.py" (
    echo [ERROR] Khong tim thay app.py tai:
    echo %BACKEND_DIR%
    pause
    exit /b 1
)

if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"
del "%RUNTIME_DIR%\api_public_url.txt" >nul 2>nul

echo [INFO] Kiem tra va tu cai moi truong backend/public tunnel neu thieu...
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPTS_DIR%\ensure_windows_runtime.ps1" -Mode backend
if errorlevel 1 (
    echo [ERROR] Kiem tra/cai moi truong backend that bai.
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
    echo [TIP] Neu loi TensorFlow, kiem tra Python 3.10 va ket noi mang.
    pause
    exit /b 1
)

echo [INFO] Dang kiem tra PostgreSQL local va apply schema neu can...
powershell -NoProfile -ExecutionPolicy Bypass -File "%BACKEND_DIR%\local_db\init_local_postgres.ps1"
if errorlevel 1 (
    echo [ERROR] PostgreSQL local chua san sang.
    echo [TIP] Kiem tra PostgreSQL service, .runtime\postgres_password.txt, hoac chay backend\local_db\init_local_postgres.ps1 thu cong.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPTS_DIR%\release_ecoloop_port.ps1" -Port %BACKEND_PORT% -Name "Eco-loop Campus Backend" -ProjectDir "%PROJECT_DIR%"
if errorlevel 1 (
    echo [ERROR] Port backend %BACKEND_PORT% dang bi chiem.
    pause
    exit /b 1
)

echo [INFO] Dang mo API public tunnel...
start "Eco-loop Campus API Public" powershell -NoExit -ExecutionPolicy Bypass -File "%SCRIPTS_DIR%\run_cloudflared_tunnel.ps1" -Name "Eco-loop Campus API" -Url "http://%BACKEND_HOST%:%BACKEND_PORT%" -OutFile "%RUNTIME_DIR%\api_public_url.txt"

echo [INFO] Backend local: http://%BACKEND_HOST%:%BACKEND_PORT%
echo [INFO] API docs local: http://%BACKEND_HOST%:%BACKEND_PORT%/docs
echo [INFO] PostgreSQL health: http://%BACKEND_HOST%:%BACKEND_PORT%/api/health/db
echo [INFO] API public URL se hien trong cua so "Eco-loop Campus API Public".
echo [INFO] Nhan Ctrl+C de dung server.
"%VENV_PY%" -m uvicorn app:app --host %BACKEND_HOST% --port %BACKEND_PORT% --workers 1

pause
