#!/usr/bin/env bash
# Executar na raiz do pacote release (incluído no bundle exportado).
# Flags: --recreate  --migrate  (ordem livre)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RECREATE=0
MIGRATE=0
for arg in "$@"; do
  case "$arg" in
    --recreate) RECREATE=1 ;;
    --migrate) MIGRATE=1 ;;
    -h|--help)
      echo "Usage: $0 [--recreate] [--migrate]"
      exit 0
      ;;
    *)
      echo "ERROR: unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f .env.docker ]]; then
  echo "ERROR: .env.docker not found. Copy .env.docker.example to .env.docker and configure." >&2
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

VERSION="$(read_env SIMPA_VERSION "")"
if [[ -z "$VERSION" ]]; then
  echo "ERROR: Set SIMPA_VERSION in .env.docker (must match images/*.tar tag)." >&2
  exit 1
fi

PROJECT="$(read_env COMPOSE_PROJECT_NAME simpa)"
API_TAR="images/simpa-api-${VERSION}.tar"
WEB_TAR="images/simpa-web-${VERSION}.tar"
for tar in "$API_TAR" "$WEB_TAR"; do
  if [[ ! -f "$tar" ]]; then
    echo "ERROR: Missing $tar" >&2
    exit 1
  fi
done

echo "==> SIMPA release deploy (no build)"
echo "==> Version: $VERSION"
echo "==> Project: $PROJECT"

echo "==> Loading Docker images..."
docker load -i "$API_TAR"
docker load -i "$WEB_TAR"

export SIMPA_VERSION="$VERSION"
export COMPOSE_PROJECT_NAME="$PROJECT"

UP_ARGS=(compose -p "$PROJECT" --env-file .env.docker -f docker-compose.yml -f docker-compose.deploy.yml up -d --no-build)
if [[ "$RECREATE" -eq 1 ]]; then
  UP_ARGS+=(--force-recreate)
fi

docker "${UP_ARGS[@]}"

if [[ "$MIGRATE" -eq 1 ]]; then
  echo "==> Applying pending migrations..."
  bash "$ROOT/scripts/apply-migrations.sh"
  docker compose -p "$PROJECT" --env-file .env.docker -f docker-compose.yml -f docker-compose.deploy.yml restart api
fi

WEB_PORT="$(read_env WEB_PORT 8080)"

echo ""
echo "PASS: Stack running from pre-built images."
echo "App: http://localhost:${WEB_PORT}"
echo "Health: http://localhost:${WEB_PORT}/api/health"
if [[ "$MIGRATE" -eq 0 ]]; then
  echo "Tip: bash scripts/apply-migrations.sh   # or redeploy with --migrate"
fi
