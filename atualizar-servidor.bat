@echo off
rem ============================================================================
rem SIMPA - Atualizar servidor a partir do ULTIMO release (sem apagar o banco)
rem ----------------------------------------------------------------------------
rem Coloque este .bat na pasta do servidor que CONTEM os bundles simpa-<versao>\
rem (ex.: C:\simpa\ com simpa-2026.08.16\, simpa-2026.09.01\, ...).
rem Ele escolhe o release mais recente, carrega as imagens e recria a stack
rem aplicando migrations pendentes. O volume PostgreSQL NAO e apagado.
rem
rem Pre-requisito: o bundle escolhido precisa ter o .env.docker ja configurado
rem (copie de .env.docker.example e ajuste PG_PASS/JWT_SECRET/MYSQL_*/SIMPA_VERSION).
rem ============================================================================
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$b = Get-ChildItem -Directory -Filter 'simpa-*' | Where-Object { Test-Path (Join-Path $_.FullName 'scripts\deploy-release.ps1') } | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if (-not $b) { Write-Error 'Nenhum release simpa-* encontrado nesta pasta.'; exit 1 }; if (-not (Test-Path (Join-Path $b.FullName '.env.docker'))) { Write-Error ('.env.docker ausente em ' + $b.Name + ' - copie o .env.docker configurado para dentro dessa pasta antes de atualizar.'); exit 1 }; Write-Host ('==> Ultimo release: ' + $b.Name); & (Join-Path $b.FullName 'scripts\deploy-release.ps1') -Recreate -Migrate; exit $LASTEXITCODE"

set EXIT_CODE=%ERRORLEVEL%
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Falha ao atualizar a stack a partir do release.
  pause
  exit /b %EXIT_CODE%
)

echo.
echo Servidor atualizado a partir do ultimo release. Banco PostgreSQL preservado.
pause
