@echo off
chcp 65001 >nul
title Wayfinder
cd /d "%~dp0"
if not exist "%~dp0app\index.html" (
  echo 请先将压缩包完整解压，再运行本文件。
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if errorlevel 1 (
  echo 启动失败。请确认已完整解压；如设备限制运行脚本，请联系作品提供者。
  pause
)
