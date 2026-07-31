@echo off
chcp 65001 >nul
setlocal

REM Smart Waste Detection - Backend launcher
set "PROJECT_DIR=%~dp0"
set "BACKEND_DIR=%PROJECT_DIR%backend"
set "VENV_PY=%BACKEND_DIR%\.venv\Scripts\python.exe"

REM Fix Unicode path/output issues on Windows paths like NO NO with Vietnamese accents
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

if not exist "%BACKEND_DIR%\app.py" (
    echo [ERROR] Khong tim thay app.py tai:
    echo %BACKEND_DIR%
    pause
    exit /b 1
)

cd /d "%BACKEND_DIR%"

echo [INFO] Dang khoi dong backend...
echo [INFO] Thu muc: %CD%

if not exist "%VENV_PY%" (
    echo [INFO] Chua co virtual environment. Dang tao .venv bang Python 3.10...
    py -3.10 -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Khong tao duoc .venv. Hay cai Python 3.10 roi chay lai.
        echo [INFO] Tai Python 3.10: https://www.python.org/downloads/release/python-31011/
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

echo [INFO] Backend se chay tai: http://localhost:8000
echo [INFO] API docs: http://localhost:8000/docs
echo [INFO] Nhan Ctrl+C de dung server.
"%VENV_PY%" -m uvicorn app:app --reload --host 0.0.0.0 --port 8000

pause
