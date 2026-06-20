#!/usr/bin/env bash
# Smoke test: verify Docker Compose stack and PostgreSQL schema.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "ERROR: .env not found. Copy .env.example to .env and set PG_PASS."
  exit 1
fi

echo "==> Starting stack..."
docker compose up -d --build

echo "==> Waiting for services..."
docker compose ps

echo "==> API health check..."
HEALTH=$(docker compose exec -T api wget -qO- http://localhost:3001/api/health)
echo "$HEALTH" | grep -q '"postgres":"connected"' || {
  echo "FAIL: API health check failed"
  echo "$HEALTH"
  exit 1
}

echo "==> Schema tables check..."
TABLES=$(docker compose exec -T postgres psql -U "${PG_USER:-postgres}" -d "${PG_DB:-simpa}" -tAc \
  "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('esus_cargas','usuarios','unidades_saude') ORDER BY 1;")

for t in esus_cargas unidades_saude usuarios; do
  echo "$TABLES" | grep -q "^${t}$" || {
    echo "FAIL: missing table ${t}"
    echo "Found: $TABLES"
    exit 1
  }
done

echo "==> Web proxy check..."
docker compose exec -T web wget -qO- http://127.0.0.1/api/health | grep -q '"ok":true'

echo ""
echo "PASS: All smoke checks passed."
