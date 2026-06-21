#!/usr/bin/env bash
# Executar na raiz do pacote release (incluído no bundle exportado).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RECREATE=""
if [[ "${1:-}" == "--recreate" ]]; then
  RECREATE="--recreate"
fi

if [[ ! -f .env.docker ]]; then
  echo "ERROR: .env.docker not found. Copy .env.docker.example to .env.docker and configure." >&2
  exit 1
fi

VERSION="$(grep -E '^SIMPA_VERSION=' .env.docker | head -1 | cut -d= -f2- | tr -d '\r' || true)"
if [[ -z "$VERSION" ]]; then
  echo "ERROR: Set SIMPA_VERSION in .env.docker (must match images/*.tar tag)." >&2
  exit 1
fi

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

echo "==> Loading Docker images..."
docker load -i "$API_TAR"
docker load -i "$WEB_TAR"

export SIMPA_VERSION="$VERSION"
UP_ARGS=(compose --env-file .env.docker -f docker-compose.yml -f docker-compose.deploy.yml up -d --no-build)
if [[ -n "$RECREATE" ]]; then
  UP_ARGS+=(--force-recreate)
fi

docker "${UP_ARGS[@]}"

WEB_PORT="$(grep -E '^WEB_PORT=' .env.docker | head -1 | cut -d= -f2- | tr -d '\r' || true)"
WEB_PORT="${WEB_PORT:-8080}"

echo ""
echo "PASS: Stack running from pre-built images."
echo "App: http://localhost:${WEB_PORT}"
echo "Health: http://localhost:${WEB_PORT}/api/health"
