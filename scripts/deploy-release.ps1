# Executar na raiz do pacote release (incluído no bundle exportado).
param(
    [switch]$Recreate,
    [switch]$Migrate
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".env.docker")) {
    Write-Error ".env.docker not found. Copy .env.docker.example to .env.docker and configure."
}

function Read-EnvValue {
    param([string]$Key, [string]$Default = "")
    $line = Get-Content ".env.docker" | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
    if (-not $line) { return $Default }
    return ($line -replace "^$Key=", "").Trim()
}

$version = Read-EnvValue "SIMPA_VERSION" ""
if (-not $version) {
    Write-Error "Set SIMPA_VERSION in .env.docker (must match the image tag in images/*.tar)."
}

$project = Read-EnvValue "COMPOSE_PROJECT_NAME" "simpa"
$apiTar = Join-Path $Root "images/simpa-api-$version.tar"
$webTar = Join-Path $Root "images/simpa-web-$version.tar"
foreach ($tar in @($apiTar, $webTar)) {
    if (-not (Test-Path $tar)) {
        Write-Error "Missing image archive: $tar"
    }
}

Write-Host "==> SIMPA release deploy (no build)"
Write-Host "==> Version: $version"
Write-Host "==> Project: $project"

Write-Host "==> Loading Docker images..."
docker load -i $apiTar
docker load -i $webTar

$env:SIMPA_VERSION = $version
$env:COMPOSE_PROJECT_NAME = $project

$composeArgs = @(
    "compose",
    "-p", $project,
    "--env-file", ".env.docker",
    "-f", "docker-compose.yml",
    "-f", "docker-compose.deploy.yml",
    "up", "-d", "--no-build"
)
if ($Recreate) {
    $composeArgs += @("--force-recreate")
}

& docker @composeArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "docker compose up failed (exit $LASTEXITCODE)."
}

if ($Migrate) {
    Write-Host "==> Applying pending migrations..."
    & powershell -ExecutionPolicy Bypass -File (Join-Path $Root "scripts\apply-migrations.ps1")
    if ($LASTEXITCODE -ne 0) {
        Write-Error "apply-migrations failed (exit $LASTEXITCODE)."
    }
    & docker compose -p $project --env-file .env.docker -f docker-compose.yml -f docker-compose.deploy.yml restart api
}

Write-Host ""
Write-Host "PASS: Stack running from pre-built images."
$webPort = Read-EnvValue "WEB_PORT" "8080"
Write-Host "App: http://localhost:$webPort"
Write-Host "Health: http://localhost:$webPort/api/health"
if (-not $Migrate) {
    Write-Host "Tip: scripts/apply-migrations.ps1   # or redeploy with -Migrate"
}
