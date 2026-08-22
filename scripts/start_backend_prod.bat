@echo off
chcp 65001 >nul
setlocal

REM Backward-compatible wrapper. The root launcher now starts backend public by default.
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_DIR=%%~fI"
call "%PROJECT_DIR%\start_backend.bat"
