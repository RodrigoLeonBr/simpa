# Workflow Memory — importacao-sia-producao

## Baseline (2026-06-21)

- `sync_sia_mysql.py` existe: query básica s_prd + prestador + procedimento, sem CAST/COLLATE/rubrica
- Gravação row-by-row em `sia_producao`; chave por `unidade` (nome), sem `estabelecimento_id`
- API: `POST /api/sia/sincronizar`, `GET /sincronizacoes`, `GET /producao` — sem `requirePlanningStaff`
- UI: só `CadastroSyncBanner` (cadastros); **sem botão produção SIA**
- Cadastros forma/cbo/procedimento: **implementados** via `sync_cadastros_mysql.py`
- Schema referência: `consultasia/docs/sia-schema-for-llm.md` (5.9M s_prd, filtro prd_cmp obrigatório)

## Artifacts

- PRD: Accepted 2026-06-21
- TechSpec: Accepted 2026-06-21
- ADR: 001–004
- Tasks: 8 (see _tasks.md)

## Gates per task

```powershell
npm run test:py
npm test --prefix simpa-backend
npm test --prefix simpa-frontend
```

## Field policy (ADR-002)

**Excluded from import:** prd_flh, prd_seq, PRD_ORG, PRD_FL*, PRD_APANUM, PRD_CNSMED, PRD_CNPJ, PRD_NFIS, PRD_CIDSEC, PRD_CIDCAS

**Aggregated grain:** competencia × cnes × procedimento × faixa × sexo × cbo × rubrica

**UI:** seletor ano/mês (YYYY-MM) — uma competência por importação

## Reimport policy (ADR-003/004)

- **Produção s_prd:** UNIQUE(competencia) + DELETE silencioso hoje — falta 409 + ConfirmDialog + DELETE BY competencia
- **Cadastros forma/cbo/procedimento:** UPSERT idempotente ✅ (re-sync atualiza sem duplicar)
- **Rubrica s_rub:** espelhada em `rubricas_sia` via UPSERT idempotente (task_08)

## MySQL env (`.env`)

- `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE=producao`

## Verification baseline (task_07, 2026-06-22)

- `npm run test:py` → falhou por ambiente local (`pytest` fora do PATH no Windows)
- `python -m pytest -m "not integration"` → **106 passed**, **6 skipped**, **32 deselected** (workaround equivalente ao gate Python)
- `npm test --prefix simpa-backend` → **49 suites / 490 tests passed**
- `npm test --prefix simpa-frontend` → **71 files / 363 tests passed** (coverage global ok: branches 78.08%)
- `npm run build --prefix simpa-frontend` → **vite build ok**

## Manual smoke checklist (task_07)

- [x] Cadastros → banner **Importar produção SIA** aparece apenas para planning staff
- [x] Seleção `YYYY-MM` chama `POST /api/sia/sincronizar`
- [x] Competência já importada retorna 409 e abre confirmação de reimportação
- [x] Após sync/reimport, histórico (`/sincronizacoes`) é atualizado
- [x] `GET /api/sia/producao` aceita `estabelecimento_id` e retorna métricas `quantidade_apresentada`/`valor_apresentado`

## Verification baseline (task_08, 2026-06-22)

- `python -m pytest tests/test_migration_011.py tests/test_sync_cadastros_mysql.py` → **48 passed**, **2 skipped**
- `npx jest cadastrosSync.test.js cadastrosSync.routes.test.js --coverage=false` (em `simpa-backend`) → **31 tests passed**
- `npx vitest run CadastroSyncBanner.test.tsx --coverage=false` (em `simpa-frontend`) → **5 tests passed**
