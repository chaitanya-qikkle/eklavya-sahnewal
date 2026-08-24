@echo off
title YMS Server — port 5000
color 0A

set "BACKEND=%~dp0..\Backend"

echo.
echo  ============================================================
echo   YMS — Yard Management System
echo   Binding : 0.0.0.0:5050  (all network interfaces)
echo   URL     : http://127.0.0.1:5000/
echo   API     : http://127.0.0.1:5000/api/docs
echo   Health  : http://127.0.0.1:5000/health
echo   Press Ctrl+C to stop.
echo  ============================================================
echo.

cd /d "%BACKEND%"

call env\Scripts\activate

uvicorn main:app ^
  --host 0.0.0.0 ^
  --port 5000 ^
  --reload ^
  --log-level info ^
  --access-log
