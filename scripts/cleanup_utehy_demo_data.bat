@echo off
setlocal

set "PROJECT_DIR=%~dp0.."
for %%I in ("%PROJECT_DIR%") do set "PROJECT_DIR=%%~fI"

echo [INFO] Xoa demo data UTEHY da seed cho Eco-loop Campus
echo [INFO] Project: %PROJECT_DIR%

cd /d "%PROJECT_DIR%" || (
  echo [ERROR] Khong vao duoc thu muc project.
  exit /b 1
)

if not exist ".runtime\DATABASE_URL.txt" (
  echo [ERROR] Chua co .runtime\DATABASE_URL.txt. Hay chay setup/start backend truoc.
  exit /b 1
)

set "PYTHON_EXE=backend\.venv\Scripts\python.exe"
if exist "%PYTHON_EXE%" (
  "%PYTHON_EXE%" "backend\local_db\cleanup_utehy_demo_data.py"
  exit /b %ERRORLEVEL%
)

py -3.10 "backend\local_db\cleanup_utehy_demo_data.py"
exit /b %ERRORLEVEL%
