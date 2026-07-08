@echo off
setlocal
cd /d "%~dp0"
echo Applying fixed production hard cleanup...
node tools\apply-production-hard-cleanup-fixed.mjs
if errorlevel 1 (
  echo.
  echo Node failed. Make sure Node is installed, then run this again.
  pause
  exit /b 1
)
echo.
echo Fixed production hard cleanup applied.
echo Review GitHub Desktop, then commit and push.
pause
