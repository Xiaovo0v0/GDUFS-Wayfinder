@echo off
chcp 65001 >nul
title Shangxing - GDUFS Wayfinder
start "" "%~dp0index.html"
echo y | timeout /t 2 >nul
