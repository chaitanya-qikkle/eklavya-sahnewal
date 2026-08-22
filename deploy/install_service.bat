@echo off
setlocal EnableDelayedExpansion
title YMS — Install Windows Service
color 0E

:: ── Must run as Administrator ─────────────────────────────────────────────────
net session >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] This script must be run as Administrator.
    echo  Right-click install_service.bat and choose "Run as administrator".
    pause
    exit /b 1
)

set "ROOT=%~dp0"
set "BACKEND=%ROOT%Backend"
set "SERVICE_NAME=YMS_Server"
set "PORT=5000"

:: Read PORT from .env
for /f "tokens=1,2 delims==" %%a in ("%BACKEND%\.env") do (
    if "%%a"=="PORT" set "PORT=%%b"
)

:: ── Find Python and uvicorn ───────────────────────────────────────────────────
for /f "tokens=*" %%p in ('python -c "import sys; print(sys.executable)" 2^>nul') do set "PYTHON_EXE=%%p"
if not defined PYTHON_EXE (
    echo  [ERROR] Python not found.
    goto :fail
)

for /f "tokens=*" %%u in ('python -c "import uvicorn, os; print(os.path.dirname(uvicorn.__file__))" 2^>nul') do set "UVICORN_CHECK=%%u"
if not defined UVICORN_CHECK (
    echo  [ERROR] uvicorn not installed. Run:  pip install uvicorn
    goto :fail
)

:: ── Locate uvicorn.exe ────────────────────────────────────────────────────────
for /f "tokens=*" %%u in ('where uvicorn 2^>nul') do (
    set "UVICORN_EXE=%%u"
    goto :found_uvicorn
)
:: Fallback: Scripts folder next to Python
set "UVICORN_EXE=%PYTHON_EXE:python.exe=%Scripts\uvicorn.exe"
:found_uvicorn

echo.
echo  ============================================================
echo   YMS — Windows Service Installer
echo  ============================================================
echo  Service name : %SERVICE_NAME%
echo  Port         : %PORT%
echo  Backend dir  : %BACKEND%
echo  Python       : %PYTHON_EXE%
echo  Uvicorn      : %UVICORN_EXE%
echo  ============================================================
echo.

:: ── Check if NSSM is available ───────────────────────────────────────────────
where nssm >nul 2>&1
if not errorlevel 1 (
    echo  NSSM found — using NSSM for robust service management.
    goto :install_nssm
)

echo  NSSM not found — using sc.exe (basic Windows service).
echo  TIP: Download NSSM from https://nssm.cc for better auto-restart control.
echo.
goto :install_sc

:: ─────────────────────────────────────────────────────────────────────────────
:install_nssm
:: Remove existing service if present
nssm status %SERVICE_NAME% >nul 2>&1
if not errorlevel 1 (
    echo  Removing existing service...
    nssm stop   %SERVICE_NAME% >nul 2>&1
    nssm remove %SERVICE_NAME% confirm >nul 2>&1
)

nssm install %SERVICE_NAME% "%UVICORN_EXE%"
nssm set %SERVICE_NAME% AppDirectory    "%BACKEND%"
nssm set %SERVICE_NAME% AppParameters  "main:app --host 0.0.0.0 --port %PORT% --workers 4 --log-level info --access-log"
nssm set %SERVICE_NAME% DisplayName     "YMS Yard Management System"
nssm set %SERVICE_NAME% Description     "YMS Enterprise Backend — FastAPI on port %PORT%"
nssm set %SERVICE_NAME% Start           SERVICE_AUTO_START
nssm set %SERVICE_NAME% AppStdout       "%BACKEND%\logs\service_stdout.log"
nssm set %SERVICE_NAME% AppStderr       "%BACKEND%\logs\service_stderr.log"
nssm set %SERVICE_NAME% AppRotateFiles  1
nssm set %SERVICE_NAME% AppRotateBytes  10485760
:: Auto-restart after 5 s if it crashes
nssm set %SERVICE_NAME% AppExit Default Restart
nssm set %SERVICE_NAME% AppRestartDelay 5000

echo  Starting service...
nssm start %SERVICE_NAME%
goto :done

:: ─────────────────────────────────────────────────────────────────────────────
:install_sc
:: Create a wrapper batch that sc.exe will call
set "WRAPPER=%BACKEND%\service_wrapper.bat"
(
echo @echo off
echo cd /d "%BACKEND%"
echo "%UVICORN_EXE%" main:app --host 0.0.0.0 --port %PORT% --workers 4 --log-level info
) > "%WRAPPER%"

sc stop   %SERVICE_NAME% >nul 2>&1
sc delete %SERVICE_NAME% >nul 2>&1
timeout /t 2 >nul

sc create %SERVICE_NAME% ^
    binPath= "cmd.exe /c \"%WRAPPER%\"" ^
    DisplayName= "YMS Yard Management System" ^
    start= auto ^
    obj= LocalSystem
sc description %SERVICE_NAME% "YMS Enterprise Backend — FastAPI on port %PORT%"
sc failure %SERVICE_NAME% reset= 60 actions= restart/5000/restart/10000/restart/30000
sc start %SERVICE_NAME%
goto :done

:: ─────────────────────────────────────────────────────────────────────────────
:done
echo.
echo  ============================================================
echo   Service installed and started successfully!
echo.
echo   URL        : http://YOUR_STATIC_IP:%PORT%/
echo   API Docs   : http://YOUR_STATIC_IP:%PORT%/api/docs
echo   Health     : http://YOUR_STATIC_IP:%PORT%/health
echo.
echo   Manage with:
echo     sc start   %SERVICE_NAME%
echo     sc stop    %SERVICE_NAME%
echo     sc query   %SERVICE_NAME%
echo  ============================================================
echo.
pause
exit /b 0

:fail
echo.
echo  Service installation failed.
pause
exit /b 1
