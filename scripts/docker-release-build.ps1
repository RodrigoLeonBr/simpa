# Build local das imagens Docker SIMPA com tag de versão (sem subir a stack).
param(
    [string]$Version = "",
    [ValidateSet("all", "api", "web")]
    [string]$Target = "all"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Test-Path "$Root/.env.docker")) {
    Write-Error ".env.docker not found. Copy .env.docker.example to .env.docker first."
}

if (-not $Version) {
    $Version = (Get-Date -Format "yyyy.MM.dd-HHmm")
}

$env:SIMPA_VERSION = $Version

[string[]]$services = switch ($Target) {
    "api" { @("api") }
    "web" { @("web") }
    default { @("api", "web") }
}

Write-Host "==> SIMPA release build"
Write-Host "==> Version: $Version"
Write-Host "==> Services: $($services -join ', ')"

& docker compose --env-file .env.docker build @services

Write-Host ""
Write-Host "PASS: Images tagged as simpa-api:$Version and/or simpa-web:$Version"
Write-Host "Next: npm run docker:release:export   (cria pacote para o servidor remoto)"
