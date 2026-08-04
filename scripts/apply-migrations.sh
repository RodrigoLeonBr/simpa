#!/usr/bin/env bash
# Aplica migration_*.sql pendentes (tracking em simpa_schema_migrations).
# Uso (raiz do pacote release):
#   bash scripts/apply-migrations.sh
#   bash scripts/apply-migrations.sh --baseline 012
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASELINE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --baseline)
      BASELINE="${2:-}"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [--baseline NNN]"
      exit 0
      ;;
    *)
      echo "ERROR: unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f .env.docker ]]; then
  echo "ERROR: .env.docker not found." >&2
  exit 1
fi

read_env() {
  local key="$1" default="${2:-}"
  local line
  line="$(grep -E "^${key}=" .env.docker | head -1 | cut -d= -f2- | tr -d '\r' || true)"
  if [[ -z "$line" ]]; then
    echo "$default"
  else
    echo "$line"
  fi
}

migration_num() {
  # migration_012_foo.sql -> 12
  local base="$1"
  if [[ "$base" =~ ^migration_([0-9]+)_ ]]; then
    echo "$((10#${BASH_REMATCH[1]}))"
  else
    echo ""
  fi
}

list_migrations() {
  local f n
  for f in "$ROOT"/migration_*.sql; do
    [[ -f "$f" ]] || continue
    n="$(migration_num "$(basename "$f")")"
    [[ -n "$n" ]] || continue
    printf '%05d\t%s\n' "$n" "$(basename "$f")"
  done | sort -n | cut -f2-
}

PROJECT="$(read_env COMPOSE_PROJECT_NAME simpa)"
PG_USER="$(read_env PG_USER postgres)"
PG_DB="$(read_env PG_DB simpa)"
COMPOSE=(docker compose -p "$PROJECT" --env-file .env.docker -f docker-compose.yml)

# deploy overlay is optional (present in release bundles)
if [[ -f docker-compose.deploy.yml ]]; then
  COMPOSE+=(-f docker-compose.deploy.yml)
fi

echo "==> SIMPA apply-migrations"
echo "==> Project: $PROJECT  DB: $PG_DB  User: $PG_USER"

if [[ -z "$("${COMPOSE[@]}" ps -q postgres 2>/dev/null || true)" ]]; then
  echo "ERROR: postgres container not running. Deploy the stack first." >&2
  exit 1
fi

psql_q() {
  "${COMPOSE[@]}" exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 "$@"
}

echo "==> Ensuring simpa_schema_migrations"
psql_q -c "CREATE TABLE IF NOT EXISTS simpa_schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);"

if [[ -n "$BASELINE" ]]; then
  THROUGH=$((10#$BASELINE))
  echo "==> Baseline through $THROUGH (mark only, no SQL execute)"
  count=0
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    n="$(migration_num "$f")"
    if [[ -n "$n" && "$n" -le "$THROUGH" ]]; then
      psql_q -c "INSERT INTO simpa_schema_migrations(filename) VALUES ('$f') ON CONFLICT DO NOTHING;"
      echo "  marked: $f"
      count=$((count + 1))
    fi
  done < <(list_migrations)
  echo "PASS: baseline done ($count files)."
  exit 0
fi

declare -A APPLIED_MAP=()
while IFS= read -r line; do
  line="${line//$'\r'/}"
  line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [[ -z "$line" ]] && continue
  APPLIED_MAP["$line"]=1
done < <(psql_q -tAc "SELECT filename FROM simpa_schema_migrations ORDER BY filename;" || true)

PENDING=()
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if [[ -z "${APPLIED_MAP[$f]:-}" ]]; then
    PENDING+=("$f")
  fi
done < <(list_migrations)

if [[ ${#PENDING[@]} -eq 0 ]]; then
  echo "PASS: no pending migrations."
  exit 0
fi

echo "==> Pending: ${#PENDING[@]}"
for f in "${PENDING[@]}"; do
  if [[ ! -f "$ROOT/$f" ]]; then
    echo "ERROR: missing file $f" >&2
    exit 1
  fi
  echo "==> Applying $f"
  "${COMPOSE[@]}" cp "$ROOT/$f" "postgres:/tmp/$f"
  psql_q -f "/tmp/$f"
  psql_q -c "INSERT INTO simpa_schema_migrations(filename) VALUES ('$f');"
  echo "  applied: $f"
done

echo "PASS: migrations applied."
