@echo off
setlocal

set "PROJECT_DIR=%~dp0.."
for %%I in ("%PROJECT_DIR%") do set "PROJECT_DIR=%%~fI"

echo [INFO] Cleanup du lieu test/E2E/demo va sua mojibake Eco-loop Campus
echo [INFO] Project: %PROJECT_DIR%

cd /d "%PROJECT_DIR%" || (
  echo [ERROR] Khong vao duoc thu muc project.
  exit /b 1
)

echo [INFO] Kiem tra PostgreSQL local va apply schema moi nhat...
powershell -NoProfile -ExecutionPolicy Bypass -File "backend\local_db\init_local_postgres.ps1"
if errorlevel 1 (
  echo [ERROR] PostgreSQL local chua san sang.
  exit /b 1
)

set "PYTHON_EXE=backend\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=py -3.10"

echo.
echo [1/2] Dry-run: chi dem du lieu se bi xoa/sua, chua ghi DB.
%PYTHON_EXE% "backend\local_db\cleanup_test_data_and_mojibake.py" --dry-run
if errorlevel 1 (
  echo [ERROR] Dry-run that bai.
  exit /b 1
)

echo.
echo Neu danh sach tren dung, go APPLY-CLEANUP de thuc thi.
set /p CONFIRM=Nhap xac nhan: 
for /f "tokens=* delims= " %%A in ("%CONFIRM%") do set "CONFIRM=%%A"
:trim_confirm_tail
if defined CONFIRM if "%CONFIRM:~-1%"==" " (
  set "CONFIRM=%CONFIRM:~0,-1%"
  goto trim_confirm_tail
)
if /I not "%CONFIRM%"=="APPLY-CLEANUP" (
  echo [INFO] Da huy. Database chua bi thay doi.
  exit /b 0
)

echo.
echo [2/2] Dang xoa data test va sua mojibake...
%PYTHON_EXE% "backend\local_db\cleanup_test_data_and_mojibake.py" --apply
if errorlevel 1 (
  echo [ERROR] Cleanup/sua mojibake that bai.
  exit /b 1
)

echo [OK] Hoan tat.
exit /b 0
