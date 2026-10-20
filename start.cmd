@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   尚行 - 广外校园向导  内网服务
echo   ------------------------------------
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*
if errorlevel 1 pause
