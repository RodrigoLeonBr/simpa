# Smoke test: verify Docker Compose stack and PostgreSQL schema (PowerShell).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Test-Path ".env")) {
    Write-Error ".env not found. Copy .env.example to .env and set PG_PASS."
}

Write-Host "==> Starting stack..."
docker compose up -d --build

Write-Host "==> Service status..."
docker compose ps

Write-Host "==> API health check..."
$health = docker compose exec -T api wget -qO- http://localhost:3001/api/health
if ($health -notmatch '"postgres":"connected"') {
    Write-Error "API health check failed: $health"
}
Write-Host $health

Write-Host "==> Schema tables check..."
$tablesRaw = docker compose exec -T postgres psql -U postgres -d simpa -tAc `
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('esus_cargas','usuarios','unidades_saude') ORDER BY 1;"
$tableList = @($tablesRaw -split '\s+' | Where-Object { $_ -ne '' })
foreach ($t in @("esus_cargas", "unidades_saude", "usuarios")) {
    if ($tableList -notcontains $t) {
        Write-Error "Missing table: $t. Found: $($tableList -join ', ')"
    }
}

Write-Host "==> Web proxy check..."
$proxy = docker compose exec -T web wget -qO- http://127.0.0.1/api/health
if ($proxy -notmatch '"ok":true') {
    Write-Error "Web proxy check failed: $proxy"
}

Write-Host ""
Write-Host "PASS: All smoke checks passed."
