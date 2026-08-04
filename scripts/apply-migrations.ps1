# Aplica migration_*.sql pendentes (tracking em simpa_schema_migrations).
# Uso (raiz do pacote release):
#   powershell -File scripts/apply-migrations.ps1
#   powershell -File scripts/apply-migrations.ps1 -Baseline 012
param(
    [string]$Baseline = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path ".env.docker")) {
    Write-Error ".env.docker not found."
}

function Read-EnvValue {
    param([string]$Key, [string]$Default = "")
    $line = Get-Content ".env.docker" | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
    if (-not $line) { return $Default }
    return ($line -replace "^$Key=", "").Trim()
}

function Get-MigrationNumber {
    param([string]$Name)
    if ($Name -match '^migration_(\d+)_') {
        return [int]$Matches[1]
    }
    return $null
}

function Get-MigrationFiles {
    Get-ChildItem -Path $Root -Filter "migration_*.sql" -File |
        ForEach-Object {
            $n = Get-MigrationNumber $_.Name
            if ($null -ne $n) {
                [PSCustomObject]@{ Num = $n; Name = $_.Name; Path = $_.FullName }
            }
        } |
        Sort-Object Num, Name
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

Write-Host "==> SIMPA apply-migrations"
Write-Host "==> Project: $project  DB: $pgDb  User: $pgUser"

$pgId = & docker @composeArgs ps -q postgres
if (-not $pgId) {
    Write-Error "postgres container not running. Deploy the stack first."
}

function Invoke-Psql {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$SqlArgs)
    & docker @composeArgs exec -T postgres psql -U $pgUser -d $pgDb -v ON_ERROR_STOP=1 @SqlArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Error "psql failed (exit $LASTEXITCODE)"
    }
}

Write-Host "==> Ensuring simpa_schema_migrations"
Invoke-Psql -c @"
CREATE TABLE IF NOT EXISTS simpa_schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"@

$files = @(Get-MigrationFiles)

if ($Baseline -ne "") {
    $through = [int]$Baseline
    Write-Host "==> Baseline through $through (mark only, no SQL execute)"
    $count = 0
    foreach ($item in $files) {
        if ($item.Num -le $through) {
            Invoke-Psql -c "INSERT INTO simpa_schema_migrations(filename) VALUES ('$($item.Name)') ON CONFLICT DO NOTHING;"
            Write-Host "  marked: $($item.Name)"
            $count++
        }
    }
    Write-Host "PASS: baseline done ($count files)."
    exit 0
}

$appliedRaw = & docker @composeArgs exec -T postgres psql -U $pgUser -d $pgDb -tAc "SELECT filename FROM simpa_schema_migrations ORDER BY filename;"
if ($LASTEXITCODE -ne 0) {
    Write-Error "failed to list applied migrations"
}
$applied = @{}
foreach ($line in @($appliedRaw)) {
    $name = ("$line").Trim()
    if ($name) { $applied[$name] = $true }
}

$pending = @($files | Where-Object { -not $applied.ContainsKey($_.Name) })
if ($pending.Count -eq 0) {
    Write-Host "PASS: no pending migrations."
    exit 0
}

Write-Host "==> Pending: $($pending.Count)"
foreach ($item in $pending) {
    Write-Host "==> Applying $($item.Name)"
    & docker @composeArgs cp $item.Path "postgres:/tmp/$($item.Name)"
    if ($LASTEXITCODE -ne 0) { Write-Error "docker cp failed for $($item.Name)" }
    Invoke-Psql -f "/tmp/$($item.Name)"
    Invoke-Psql -c "INSERT INTO simpa_schema_migrations(filename) VALUES ('$($item.Name)');"
    Write-Host "  applied: $($item.Name)"
}

Write-Host "PASS: migrations applied."
