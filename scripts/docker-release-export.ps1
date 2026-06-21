# Compila imagens localmente e gera pacote para deploy no servidor remoto (sem build lá).
param(
    [string]$Version = "",
    [string]$OutputDir = "release",
    [switch]$SkipBuild
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
$bundleName = "simpa-$Version"
$bundleRoot = Join-Path (Join-Path $Root $OutputDir) $bundleName

Write-Host "==> SIMPA release export"
Write-Host "==> Version: $Version"
Write-Host "==> Bundle: $bundleRoot"

if (-not $SkipBuild) {
    & docker compose --env-file .env.docker build api web
}

foreach ($img in @("simpa-api:$Version", "simpa-web:$Version")) {
    docker image inspect $img 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Image $img not found. Run without -SkipBuild or run docker-release-build.ps1 first."
    }
}

if (Test-Path $bundleRoot) {
    Remove-Item -Recurse -Force $bundleRoot
}
New-Item -ItemType Directory -Path (Join-Path $bundleRoot "images") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $bundleRoot "scripts") -Force | Out-Null

$copyFiles = @(
    "docker-compose.yml",
    "docker-compose.deploy.yml",
    ".env.docker.example",
    "schema_full.sql",
    "migration_002_auth.sql",
    "migration_003_cadastros_fase2.sql",
    "migration_004_cadastros_sync.sql",
    "migration_005_estabelecimentos_perfil_enrichment.sql",
    "migration_006_import_depara.sql",
    "migration_007_atendimento_domiciliar.sql",
    "migration_008_painel_widgets.sql",
    "migration_009_cadastros_forma_cbo.sql",
    "parse_esus_csv.py",
    "consolidate_dashboard.py",
    "sync_sia_mysql.py",
    "sync_cadastros_mysql.py",
    "etl_contract.py",
    "etl_db.py"
)

foreach ($file in $copyFiles) {
    $src = Join-Path $Root $file
    if (-not (Test-Path $src)) {
        Write-Error "Missing required file: $file"
    }
    Copy-Item $src (Join-Path $bundleRoot $file)
}

Copy-Item "$Root/scripts/deploy-release.ps1" (Join-Path $bundleRoot "scripts/deploy-release.ps1")
Copy-Item "$Root/scripts/deploy-release.sh" (Join-Path $bundleRoot "scripts/deploy-release.sh")

Write-Host "==> Saving Docker images..."
docker save -o (Join-Path $bundleRoot "images/simpa-api-$Version.tar") "simpa-api:$Version"
docker save -o (Join-Path $bundleRoot "images/simpa-web-$Version.tar") "simpa-web:$Version"

$gitHash = ""
try {
    $gitHash = (git -C $Root rev-parse --short HEAD 2>$null).Trim()
} catch { }

$manifest = @"
SIMPA release bundle
Version: $Version
Built: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Git: $gitHash

Deploy no servidor remoto:
  1. Copie esta pasta para o servidor (scp, rsync, pendrive, etc.)
  2. cd simpa-$Version
  3. cp .env.docker.example .env.docker && edite PG_PASS, JWT_SECRET, MySQL...
  4. Defina SIMPA_VERSION=$Version em .env.docker
  5. Linux:   bash scripts/deploy-release.sh
     Windows: powershell -ExecutionPolicy Bypass -File scripts/deploy-release.ps1

Atualizar release existente (preserva dados PG):
  bash scripts/deploy-release.sh --recreate
"@
Set-Content -Path (Join-Path $bundleRoot "MANIFEST.txt") -Value $manifest -Encoding UTF8

$zipPath = Join-Path (Join-Path $Root $OutputDir) "$bundleName.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path $bundleRoot -DestinationPath $zipPath

Write-Host ""
Write-Host "PASS: Release bundle ready."
Write-Host "Folder: $bundleRoot"
Write-Host "Zip:    $zipPath"
Write-Host ""
Write-Host "Transfer to remote server and run scripts/deploy-release.sh (or .ps1)"
