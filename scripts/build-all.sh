#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/simpa-frontend"

echo "==> Installing frontend dependencies..."
if [[ ! -d node_modules ]]; then
  npm ci
fi

echo "==> Building React app (same-origin API)..."
export VITE_API_BASE=
npm run build

echo ""
echo "PASS: Frontend build in simpa-frontend/dist"
echo "Next: docker compose --env-file .env.docker up -d --build"
