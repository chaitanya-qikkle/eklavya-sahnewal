@echo off
setlocal EnableDelayedExpansion
title YMS Enterprise Deployment
color 0A

echo.
echo  ============================================================
echo   YMS - Yard Management System   ^|  Enterprise Deployment
echo  ============================================================
echo.

:: ── Root of this repo ─────────────────────────────────────────────────────────
set "ROOT=%~dp0"
set "BACKEND=%ROOT%Backend"
set "FRONTEND=%ROOT%Frontend"

:: ── 1. Verify tools ───────────────────────────────────────────────────────────
echo [1/5] Checking prerequisites...

python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found. Install Python 3.9+ and add it to PATH.
    goto :fail
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo        %%v

node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js not found. Install Node.js 18+ and add it to PATH.
    goto :fail
)
for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo        Node %%v

echo  [OK] Prerequisites satisfied.
echo.

:: ── 2. Backend dependencies ───────────────────────────────────────────────────
echo [2/5] Installing backend dependencies...
cd /d "%BACKEND%"
pip install -r requirements.txt -q
if errorlevel 1 ( echo  [ERROR] pip install failed. & goto :fail )
echo  [OK] Backend dependencies installed.
echo.

:: ── 3. Frontend build ─────────────────────────────────────────────────────────
echo [3/5] Building React frontend (production)...
cd /d "%FRONTEND%"
call npm install --silent
if errorlevel 1 ( echo  [ERROR] npm install failed. & goto :fail )
call npm run build
if errorlevel 1 ( echo  [ERROR] npm run build failed. & goto :fail )
echo  [OK] Frontend built. Output: Frontend\dist\
echo.

:: ── 4. Read static IP from .env ───────────────────────────────────────────────
echo [4/5] Reading server configuration...
set "STATIC_IP=YOUR_STATIC_IP"
set "PORT=5000"
for /f "tokens=1,2 delims==" %%a in ("%BACKEND%\.env") do (
    if "%%a"=="STATIC_IP" set "STATIC_IP=%%b"
    if "%%a"=="PORT"      set "PORT=%%b"
)
echo  Static IP : %STATIC_IP%
echo  Port      : %PORT%
echo.

:: ── 5. Start server ───────────────────────────────────────────────────────────
echo [5/5] Starting YMS server...
echo  Access URL : http://%STATIC_IP%:%PORT%/
echo  API Docs   : http://%STATIC_IP%:%PORT%/api/docs
echo  Health     : http://%STATIC_IP%:%PORT%/health
echo.
echo  Press Ctrl+C to stop.
echo  ============================================================
echo.

cd /d "%BACKEND%"
uvicorn main:app --host 0.0.0.0 --port %PORT% --workers 4 --log-level info --access-log

goto :eof

:fail
echo.
echo  Deployment failed. Fix the error above and re-run deploy.bat
pause
exit /b 1
