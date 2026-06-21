# Executar na raiz do pacote release (incluído no bundle exportado).
param(
    [switch]$Recreate
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".env.docker")) {
    Write-Error ".env.docker not found. Copy .env.docker.example to .env.docker and configure."
}

$versionLine = Get-Content ".env.docker" | Where-Object { $_ -match '^SIMPA_VERSION=' } | Select-Object -First 1
$version = if ($versionLine) { ($versionLine -replace '^SIMPA_VERSION=', '').Trim() } else { "" }
if (-not $version) {
    Write-Error "Set SIMPA_VERSION in .env.docker (must match the image tag in images/*.tar)."
}

$apiTar = Join-Path $Root "images/simpa-api-$version.tar"
$webTar = Join-Path $Root "images/simpa-web-$version.tar"
foreach ($tar in @($apiTar, $webTar)) {
    if (-not (Test-Path $tar)) {
        Write-Error "Missing image archive: $tar"
    }
}

Write-Host "==> SIMPA release deploy (no build)"
Write-Host "==> Version: $version"

Write-Host "==> Loading Docker images..."
docker load -i $apiTar
docker load -i $webTar

$env:SIMPA_VERSION = $version
$composeArgs = @(
    "compose",
    "--env-file", ".env.docker",
    "-f", "docker-compose.yml",
    "-f", "docker-compose.deploy.yml",
    "up", "-d", "--no-build"
)
if ($Recreate) {
    $composeArgs += @("--force-recreate")
}

& docker @composeArgs

Write-Host ""
Write-Host "PASS: Stack running from pre-built images."
$webPort = (Get-Content ".env.docker" | Where-Object { $_ -match '^WEB_PORT=' } | Select-Object -First 1) -replace '^WEB_PORT=', ''
if (-not $webPort) { $webPort = "8080" }
Write-Host "App: http://localhost:$webPort"
Write-Host "Health: http://localhost:$webPort/api/health"
