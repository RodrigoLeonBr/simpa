# Dev local: API + Vite (sem Docker). Requer Postgres acessível (.env na raiz).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not (Test-Path "$Root/.env")) {
    Write-Error ".env not found. Copy .env.example to .env and configure PG_PASS."
}

Write-Host "SIMPA dev local — API :3001 + Vite :5173"
Write-Host "Pressione Ctrl+C para encerrar ambos."
Write-Host ""

$api = Start-Process -FilePath "npm" -ArgumentList "run", "dev:api" -WorkingDirectory $Root -PassThru -NoNewWindow
$web = Start-Process -FilePath "npm" -ArgumentList "run", "dev:web" -WorkingDirectory $Root -PassThru -NoNewWindow

try {
    Wait-Process -Id $api.Id, $web.Id
}
finally {
    if (-not $api.HasExited) { Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue }
    if (-not $web.HasExited) { Stop-Process -Id $web.Id -Force -ErrorAction SilentlyContinue }
}
