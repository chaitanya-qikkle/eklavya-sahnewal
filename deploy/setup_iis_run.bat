@echo off
:: Self-elevating launcher for setup_iis.ps1
:: Double-click this file — it will ask for admin, then run automatically.

net session >nul 2>&1
if errorlevel 1 (
    echo Requesting administrator access...
    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d ""%~dp0"" && powershell -ExecutionPolicy Bypass -File setup_iis.ps1 & pause' -Verb RunAs"
    exit /b
)

powershell -ExecutionPolicy Bypass -File "%~dp0setup_iis.ps1"
pause
