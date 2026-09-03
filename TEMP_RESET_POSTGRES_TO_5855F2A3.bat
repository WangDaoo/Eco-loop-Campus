@echo off
setlocal

rem TEMP reset helper for Eco-loop Campus.
rem Safety markers for review/test:
rem - Creates a pg_dump backup before resetting.
rem - Requires typing RESET ECOLOOP DB before destructive action.
rem - Re-applies backend\local_db\schema.sql via init_local_postgres.ps1.
rem - Optionally calls scripts\bootstrap_local_admin.ps1 after reset.

set "PROJECT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%scripts\temp_reset_postgres_to_5855f2a3.ps1" %*
if errorlevel 2 (
  echo [CANCEL] Khong reset PostgreSQL.
  exit /b 0
)
if errorlevel 1 (
  echo [ERROR] Reset PostgreSQL ve checkpoint 5855f2a3 that bai.
  pause
  exit /b 1
)

echo [OK] Da reset PostgreSQL theo schema cua commit 5855f2a3.
pause
