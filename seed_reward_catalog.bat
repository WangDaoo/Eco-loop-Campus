@echo off
chcp 65001 >nul
setlocal

set "PROJECT_DIR=%~dp0"
set "PYTHON=%PROJECT_DIR%backend\.venv\Scripts\python.exe"
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

if not exist "%PYTHON%" (
    echo [ERROR] Khong tim thay backend\.venv.
    echo [FIX] Chay setup_server_full.bat truoc, sau do chay lai file nay.
    pause
    exit /b 1
)

echo [INFO] Nap danh muc va san pham doi thuong cu...
"%PYTHON%" "%PROJECT_DIR%backend\local_db\seed_reward_catalog.py" %*
if errorlevel 1 (
    echo [ERROR] Nap danh muc/san pham doi thuong that bai.
    pause
    exit /b 1
)

echo [OK] Lenh danh muc/san pham doi thuong da hoan tat.
pause
