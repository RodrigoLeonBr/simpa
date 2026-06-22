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
- **Rubrica s_rub:** não espelhada em PG — task_08 cria `rubricas_sia`

## MySQL env (`.env`)

- `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE=producao`
