# Importa imagens de um pacote release e sobe a stack sem build (servidor remoto ou teste local).
param(
    [string]$BundlePath = "",
    [switch]$Recreate
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not $BundlePath) {
    $releaseRoot = Join-Path $RepoRoot "release"
    if (-not (Test-Path $releaseRoot)) {
        Write-Error "No -BundlePath given and release/ folder not found. Run npm run docker:release:export first."
    }
    $latest = Get-ChildItem $releaseRoot -Directory -Filter "simpa-*" |
        Sort-Object Name -Descending |
        Select-Object -First 1
    if (-not $latest) {
        Write-Error "No release bundle in release/. Run npm run docker:release:export first."
    }
    $BundlePath = $latest.FullName
    Write-Host "==> Using latest bundle: $BundlePath"
}

$bundlePathResolved = Resolve-Path $BundlePath
$bundleRoot = if ((Get-Item $bundlePathResolved).PSIsContainer) {
    $bundlePathResolved.Path
} else {
    throw "BundlePath must be a directory (unzip the release folder first)."
}

Set-Location $bundleRoot

if (-not (Test-Path ".env.docker")) {
    Write-Error ".env.docker not found in $bundleRoot. Copy .env.docker.example to .env.docker and configure."
}

$versionLine = Get-Content ".env.docker" | Where-Object { $_ -match '^SIMPA_VERSION=' } | Select-Object -First 1
$version = if ($versionLine) { ($versionLine -replace '^SIMPA_VERSION=', '').Trim() } else { "" }
if (-not $version) {
    Write-Error "Set SIMPA_VERSION in .env.docker (must match the image tag in images/*.tar)."
}

$apiTar = Join-Path $bundleRoot "images/simpa-api-$version.tar"
$webTar = Join-Path $bundleRoot "images/simpa-web-$version.tar"
foreach ($tar in @($apiTar, $webTar)) {
    if (-not (Test-Path $tar)) {
        Write-Error "Missing image archive: $tar"
    }
}

Write-Host "==> SIMPA release deploy (no build)"
Write-Host "==> Bundle: $bundleRoot"
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
