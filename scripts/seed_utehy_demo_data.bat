@echo off
setlocal

set "PROJECT_DIR=%~dp0.."
for %%I in ("%PROJECT_DIR%") do set "PROJECT_DIR=%%~fI"

echo [INFO] Seed demo data UTEHY cho Eco-loop Campus
echo [INFO] Project: %PROJECT_DIR%

cd /d "%PROJECT_DIR%" || (
  echo [ERROR] Khong vao duoc thu muc project.
  exit /b 1
)

echo [INFO] Kiem tra PostgreSQL local va apply schema moi nhat...
powershell -NoProfile -ExecutionPolicy Bypass -File "backend\local_db\init_local_postgres.ps1"
if errorlevel 1 (
  echo [ERROR] PostgreSQL local chua san sang. Hay kiem tra mat khau postgres/native PostgreSQL.
  exit /b 1
)

set "PYTHON_EXE=backend\.venv\Scripts\python.exe"
if exist "%PYTHON_EXE%" (
  "%PYTHON_EXE%" "backend\local_db\seed_utehy_demo_data.py"
  exit /b %ERRORLEVEL%
)

py -3.10 "backend\local_db\seed_utehy_demo_data.py"
exit /b %ERRORLEVEL%
