@echo off
setlocal

echo Adding prediction reviewer columns...

where psql >nul 2>nul
if errorlevel 1 (
  echo ERROR: psql not found. Install PostgreSQL client tools or add psql.exe to PATH.
  exit /b 1
)

if "%DATABASE_URL%"=="" (
  echo DATABASE_URL is not set.
  set /p DATABASE_URL=Paste PostgreSQL DATABASE_URL: 
)

if "%DATABASE_URL%"=="" (
  echo ERROR: DATABASE_URL is required.
  exit /b 1
)

psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -c "alter table predictions add column if not exists reviewed_at timestamptz;"
if errorlevel 1 (
  echo ERROR: failed to add reviewed_at.
  exit /b 1
)

psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -c "alter table predictions add column if not exists reviewed_by text references users(id) on delete set null;"
if errorlevel 1 (
  echo ERROR: failed to add reviewed_by.
  exit /b 1
)

psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -c "select column_name, data_type from information_schema.columns where table_name = 'predictions' and column_name in ('reviewed_at', 'reviewed_by') order by column_name;"
if errorlevel 1 (
  echo ERROR: verification query failed.
  exit /b 1
)

echo Done.
endlocal
