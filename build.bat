@echo off
echo Building project...
call npm run build
if errorlevel 1 (
  echo Build failed!
  exit /b 1
)
echo.