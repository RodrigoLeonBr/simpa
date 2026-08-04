# Importa imagens de um pacote release e sobe a stack sem build (servidor remoto ou teste local).
param(
    [string]$BundlePath = "",
    [switch]$Recreate,
    [switch]$Migrate
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

$deploy = Join-Path $bundleRoot "scripts\deploy-release.ps1"
if (-not (Test-Path $deploy)) {
    Write-Error "Missing $deploy"
}

$deployArgs = @()
if ($Recreate) { $deployArgs += "-Recreate" }
if ($Migrate) { $deployArgs += "-Migrate" }

& powershell -ExecutionPolicy Bypass -File $deploy @deployArgs
