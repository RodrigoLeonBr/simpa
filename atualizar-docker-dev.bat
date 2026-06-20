@echo off
setlocal
cd /d "%~dp0"

set TARGET=%~1
if "%TARGET%"=="" set TARGET=all

powershell -ExecutionPolicy Bypass -File "scripts\docker-dev-refresh.ps1" -Target %TARGET%
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Falha ao atualizar a stack Docker dev.
  pause
  exit /b %EXIT_CODE%
)

echo.
echo Stack Docker dev atualizada com sucesso.
pause
