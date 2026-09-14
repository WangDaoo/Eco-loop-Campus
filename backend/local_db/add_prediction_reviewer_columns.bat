@echo off
setlocal

echo Adding prediction reviewer columns...

set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%.."
set "PYTHON_EXE=%BACKEND_DIR%\.venv\Scripts\python.exe"

if not exist "%PYTHON_EXE%" (
  set "PYTHON_EXE=python"
)

"%PYTHON_EXE%" "%SCRIPT_DIR%add_prediction_reviewer_columns.py"
if errorlevel 1 (
  echo ERROR: migration failed.
  exit /b %errorlevel%
)

echo Done.
endlocal
