# Testes e CI

## Comandos (raiz)

| Comando | Escopo |
|---------|--------|
| `npm test` | Jest (backend) + Vitest (frontend) |
| `npm run test:api` | só `simpa-backend` |
| `npm run test:web` | só `simpa-frontend` |
| `npm run test:py` | pytest |
| `npm run test:e2e` | Playwright |
| `npm run docker:test` | sobe Compose para E2E |
| `npm run docker:smoke` | health endpoints |
| `npm run ci` | `scripts/ci.sh` (bash, pipeline completo) |

## Backend — Jest

- Pasta: `simpa-backend/__tests__/`
- Config: `simpa-backend/jest.config.js`
- Mock de `db.js` comum para services.
- Rodar após mudanças em `services/` e `routes/`.

## Frontend — Vitest

- Colocalizado: `*.test.ts`, `*.test.tsx` em `simpa-frontend/src/`
- Setup: `vitest.config.ts`
- Testing Library para componentes.

## Python — pytest

- Pasta: `tests/` na raiz
- Foco: parse, consolidate, `derive_perfil`, sync helpers
- `npm run test:py` ou `pytest tests/ -v`

## E2E — Playwright

- Config: `playwright.config.ts`
- Testes: `e2e/` ou `tests/e2e/` (ver config)
- **Requer stack rodando** em `http://localhost:8080` (Docker).
- Fluxo típico:

```powershell
npm run docker:test
npm run test:e2e
```

## Smoke Docker

`scripts/smoke-compose.ps1` / `smoke-compose.sh`:

- `GET /api/health`
- `GET /` web

## CI (`scripts/ci.sh`)

Sequência aproximada: install → test:api → test:web → test:py → (opcional e2e).

## Checklist ao implementar feature

1. Teste unitário do service alterado.
2. Teste de rota se validação/auth nova.
3. Teste frontend se hook ou transformação crítica.
4. pytest se alterou script Python.
5. E2E se fluxo UI completo (tasks Compozy costumam exigir).

## Compozy tasks

Cada `task_NN.md` lista `Validation` / `Test Plan` específicos — executar **todos**, não só `npm test` genérico.
