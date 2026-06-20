@echo off
setlocal
cd /d "%~dp0"

set TARGET=%~1
if "%TARGET%"=="" set TARGET=all

powershell -ExecutionPolicy Bypass -File "scripts\docker-prod-refresh.ps1" -Target %TARGET%
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Falha ao atualizar a stack Docker prod.
  pause
  exit /b %EXIT_CODE%
)

echo.
echo Stack Docker prod atualizada com sucesso.
pause
