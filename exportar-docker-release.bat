@echo off
setlocal
cd /d "%~dp0"

if not exist ".env.docker" (
  echo.
  echo Arquivo .env.docker nao encontrado.
  echo Copie .env.docker.example para .env.docker e configure antes de exportar.
  pause
  exit /b 1
)

powershell -ExecutionPolicy Bypass -File "scripts\docker-release-export.ps1" %*
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo Falha ao exportar release Docker.
  pause
  exit /b %EXIT_CODE%
)

echo.
echo Release Docker exportada com sucesso. Veja a pasta release\
pause
