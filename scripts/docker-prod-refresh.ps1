# Rebuild/recreate Docker production services using .env.docker.
param(
    [ValidateSet("all", "api", "web")]
    [string]$Target = "all"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Test-Path "$Root/.env.docker")) {
    Write-Error ".env.docker not found. Copy .env.docker.example to .env.docker and configure the values first."
}

$composeArgs = @(
    "compose",
    "--env-file", ".env.docker",
    "-f", "docker-compose.yml"
)

[string[]]$services = switch ($Target) {
    "api" { "api" }
    "web" { "web" }
    default { "postgres", "api", "web" }
}

$webPort = (Get-Content "$Root/.env.docker" | Where-Object { $_ -match '^WEB_PORT=' } | Select-Object -First 1) -replace '^WEB_PORT=', ''
if (-not $webPort) { $webPort = "8080" }

Write-Host "==> SIMPA Docker prod refresh ($Target)"
Write-Host "==> Services: $($services -join ', ')"
Write-Host "==> WEB_PORT from .env.docker: $webPort"

$dockerArgs = $composeArgs + @("up", "-d", "--build", "--force-recreate") + $services
& docker @dockerArgs

Write-Host ""
Write-Host "PASS: Docker prod stack refreshed."
Write-Host "App: http://localhost:$webPort"
Write-Host "API health: http://localhost:$webPort/api/health"
