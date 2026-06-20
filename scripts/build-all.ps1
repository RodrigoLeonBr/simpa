# Build frontend + optional Docker images
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "==> Installing frontend dependencies..."
Set-Location "$Root/simpa-frontend"
if (-not (Test-Path "node_modules")) {
    npm ci
}

Write-Host "==> Building React app (VITE_API_BASE empty = same-origin)..."
$env:VITE_API_BASE = ""
npm run build

Set-Location $Root
Write-Host ""
Write-Host "PASS: Frontend build in simpa-frontend/dist"
Write-Host "Next: docker compose --env-file .env.docker up -d --build   OR   npm run docker:up"
