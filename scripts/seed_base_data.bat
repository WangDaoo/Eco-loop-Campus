@echo off
setlocal

set "PROJECT_DIR=%~dp0.."
for %%I in ("%PROJECT_DIR%") do set "PROJECT_DIR=%%~fI"

echo [INFO] Seed lai du lieu nen Eco-loop Campus
echo [INFO] Project: %PROJECT_DIR%

cd /d "%PROJECT_DIR%" || (
  echo [ERROR] Khong vao duoc thu muc project.
  exit /b 1
)

set "PYTHON_EXE=backend\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=py -3.10"

echo.
echo [1/5] Kiem tra PostgreSQL local va apply schema moi nhat...
powershell -NoProfile -ExecutionPolicy Bypass -File "backend\local_db\init_local_postgres.ps1"
if errorlevel 1 (
  echo [ERROR] PostgreSQL local chua san sang.
  exit /b 1
)

echo.
echo [2/5] Cleanup data test/E2E/demo va sua mojibake truoc khi seed lai...
%PYTHON_EXE% "backend\local_db\cleanup_test_data_and_mojibake.py" --apply
if errorlevel 1 (
  echo [ERROR] Cleanup/sua mojibake that bai.
  exit /b 1
)

echo.
echo [3/5] Seed loai rac va nhiem vu tuan...
%PYTHON_EXE% "backend\local_db\seed_waste_types_and_missions.py"
if errorlevel 1 (
  echo [ERROR] Seed loai rac/nhiem vu that bai.
  exit /b 1
)

echo.
echo [4/5] Seed quy tac diem...
%PYTHON_EXE% "backend\local_db\seed_point_rules.py"
if errorlevel 1 (
  echo [ERROR] Seed quy tac diem that bai.
  exit /b 1
)

echo.
echo [5/5] Seed danh muc va san pham doi thuong cu...
%PYTHON_EXE% "backend\local_db\seed_reward_catalog.py"
if errorlevel 1 (
  echo [ERROR] Seed danh muc/san pham doi thuong that bai.
  exit /b 1
)

echo.
echo [OK] Da seed lai du lieu nen:
echo - Loai rac + nhiem vu tuan
echo - Quy tac diem
echo - Danh muc + san pham doi thuong cu
echo - Mojibake da duoc sua truoc khi seed
exit /b 0
