# Testes e CI

## Comandos (raiz)

| Comando | Escopo |
|---------|--------|
| `npm test` | Jest (backend) + Vitest (frontend) |
| `npm run test:api` | só `simpa-backend` |
| `npm run test:web` | só `simpa-frontend` |
| `npm run test:py` | pytest unit (`python -m pytest -m "not integration"` se PATH sem pytest) |
| `npm run test:py:integration` | pytest integration (PG em `:5433`) |
| `npm run test:e2e` | Playwright |
| `npm run seed:e2e` | reativa `E2E001–004` (sync pode inativar) |
| `npm run docker:test` | sobe Compose para E2E |
| `npm run docker:smoke` | health endpoints |
| `npm run ci` | `scripts/ci.sh` (bash, pipeline completo) |

## Backend — Jest

- Pasta: `simpa-backend/tests/`
- Config: `jest.config.js` (coverage threshold global 80%)
- Mock de `db.js`; `pool.connect` para testes de transação em `upsertEnrichment`.
- Integração: `tests/integration/cadastros.integration.test.js`

## Frontend — Vitest

- Colocalizado: `*.test.ts`, `*.test.tsx` em `simpa-frontend/src/`
- Setup: `vitest.config.ts`
- ~206 testes (incl. Painel, drawer, `useDashboard`, `dashboardView`).

## Python — pytest

- Pasta: `tests/` na raiz
- Feature perfil-painel: `test_migration_005.py`, `test_sync_cadastros_mysql.py`
- `npm run test:py` ou `python -m pytest tests/ -m "not integration" -v`

## E2E — Playwright

- Config: `simpa-frontend/playwright.config.ts`
- Testes: `simpa-frontend/tests/e2e/`
  - `perfil-painel.spec.ts` — Painel multi-perfil + edição perfil cadastros
  - `painel-widgets.spec.ts` — cadastro widget → título refletido no Layout A (`kpi-card-atendimentos`)
  - `critical-flow.spec.ts` — smoke login/import/cadastros
  - `helpers.ts` — `login`, `openIndicadoresPainel`, `openEstabelecimentos`, `searchEstabelecimentos`

**Requer stack** em `http://localhost:8080` (Docker).

```powershell
npm run docker:test
npm run seed:admin --prefix simpa-backend   # se necessário
npm run seed:e2e
cd simpa-frontend
$env:E2E_BASE_URL="http://localhost:8080"
npm run test:e2e
```

CI (`.github/workflows/ci.yml`): seed admin + seed E2E antes do Playwright.

## Smoke Docker

`scripts/smoke-compose.ps1` / `smoke-compose.sh`:

- `GET /api/health`
- `GET /` web

## CI (`scripts/ci.sh`)

Sequência: docker test stack → seed admin → pytest unit → pytest integration → Jest → Vitest → Playwright E2E.

## Checklist ao implementar feature

1. Teste unitário do service alterado.
2. Teste de rota se validação/auth nova.
3. Teste frontend se hook ou transformação crítica.
4. pytest se alterou script Python.
5. E2E se fluxo UI completo (tasks Compozy costumam exigir).

## Compozy tasks

Cada `task_NN.md` lista `Validation` / `Test Plan` específicos — executar **todos**, não só `npm test` genérico.

Review rounds: `compozy reviews fix <slug>` após `cy-review-round`.
