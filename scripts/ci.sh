#!/usr/bin/env bash
# Full CI pipeline: Docker test stack + pytest + Jest/Vitest + Playwright E2E
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose --env-file .env.docker -f docker-compose.yml -f docker-compose.test.yml"

if [ ! -f .env.docker ]; then
  cp .env.docker.example .env.docker
  if grep -q 'change_me_in_production' .env.docker; then
    sed -i.bak 's/change_me_in_production/ci_pg_pass_2026/' .env.docker
    sed -i.bak 's/change_me_use_random_string_at_least_32_chars/test-secret-with-at-least-32-characters-for-ci/' .env.docker
    rm -f .env.docker.bak
  fi
fi

export PG_PASS="${PG_PASS:-ci_pg_pass_2026}"
export JWT_SECRET="${JWT_SECRET:-test-secret-with-at-least-32-characters-for-ci}"
export WEB_PORT="${WEB_PORT:-8080}"
export PG_PUBLISH_PORT="${PG_PUBLISH_PORT:-5433}"

echo "==> Starting test stack..."
$COMPOSE up -d --build --wait

cleanup() {
  echo "==> Stopping test stack..."
  $COMPOSE down -v || true
}
trap cleanup EXIT

echo "==> Seeding admin user..."
$COMPOSE exec -T api node scripts/seed-admin.js

echo "==> Python unit tests..."
pytest -m "not integration"

echo "==> Python integration tests..."
PG_HOST=127.0.0.1 PG_PORT="${PG_PUBLISH_PORT}" PG_PASS="${PG_PASS}" pytest -m integration

echo "==> Backend Jest..."
npm test --prefix simpa-backend

echo "==> Frontend Vitest..."
npm test --prefix simpa-frontend

echo "==> Playwright E2E..."
cd simpa-frontend
if [ ! -d node_modules/@playwright/test ]; then
  npm install
fi
npx playwright install --with-deps chromium
E2E_BASE_URL="http://localhost:${WEB_PORT}" npm run test:e2e

echo ""
echo "PASS: All CI layers completed."
