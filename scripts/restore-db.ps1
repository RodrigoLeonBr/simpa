# Restaura um dump .sql em banco VAZIO (drop + create + restore) via container postgres.
# UTF-8 seguro no Windows: usa docker cp + psql -f (nunca Get-Content | docker exec).
# Uso (raiz do pacote release):
#   powershell -ExecutionPolicy Bypass -File scripts/restore-db.ps1 -Backup C:\path\backup.sql
param(
    [Parameter(Mandatory = $true)][string]$Backup
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path $Backup)) {
    Write-Error "Backup file not found: $Backup"
}
if (-not (Test-Path ".env.docker")) {
    Write-Error ".env.docker not found."
}

function Read-EnvValue {
    param([string]$Key, [string]$Default = "")
    $line = Get-Content ".env.docker" | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
    if (-not $line) { return $Default }
    return ($line -replace "^$Key=", "").Trim()
}

$project = Read-EnvValue "COMPOSE_PROJECT_NAME" "simpa"
$pgUser = Read-EnvValue "PG_USER" "postgres"
$pgDb = Read-EnvValue "PG_DB" "simpa"

$composeArgs = @(
    "compose", "-p", $project,
    "--env-file", ".env.docker",
    "-f", "docker-compose.yml"
)
if (Test-Path "docker-compose.deploy.yml") {
    $composeArgs += @("-f", "docker-compose.deploy.yml")
}

$pgId = & docker @composeArgs ps -q postgres
if (-not $pgId) {
    Write-Error "postgres container not running. Deploy the stack first."
}

Write-Host "==> SIMPA restore-db"
Write-Host "==> Project: $project  DB: $pgDb  User: $pgUser"
Write-Host "==> Backup: $Backup"
Write-Host ""
Write-Warning "This DROPS database '$pgDb' and restores from the backup. All current data is lost."
$confirm = Read-Host "Type RESTAURAR to continue"
if ($confirm -ne "RESTAURAR") {
    Write-Host "Aborted."
    exit 1
}

function Invoke-PsqlAdmin {
    param([string]$Sql)
    & docker @composeArgs exec -T postgres psql -U $pgUser -d postgres -v ON_ERROR_STOP=1 -c $Sql
    if ($LASTEXITCODE -ne 0) { Write-Error "psql failed: $Sql" }
}

Write-Host "==> Terminating connections to $pgDb"
Invoke-PsqlAdmin "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$pgDb' AND pid <> pg_backend_pid();"

Write-Host "==> Dropping and recreating $pgDb"
Invoke-PsqlAdmin "DROP DATABASE IF EXISTS $pgDb;"
Invoke-PsqlAdmin "CREATE DATABASE $pgDb OWNER $pgUser;"

Write-Host "==> Copying backup into container"
& docker @composeArgs cp $Backup "postgres:/tmp/restore.sql"
if ($LASTEXITCODE -ne 0) { Write-Error "docker cp failed" }

Write-Host "==> Restoring (psql -f)"
& docker @composeArgs exec -T postgres psql -U $pgUser -d $pgDb -v ON_ERROR_STOP=1 -f /tmp/restore.sql
if ($LASTEXITCODE -ne 0) { Write-Error "restore failed (exit $LASTEXITCODE)" }

Write-Host ""
Write-Host "PASS: restore done. Next: scripts/apply-migrations.ps1 (see restore-backup-e-release-docker.md)."
