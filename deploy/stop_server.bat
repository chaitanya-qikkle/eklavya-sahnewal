@echo off
title Stop YMS Server
echo Stopping YMS server (killing uvicorn processes)...
taskkill /F /IM uvicorn.exe /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq YMS Server*" /T >nul 2>&1
echo Done. YMS server stopped.
pause
