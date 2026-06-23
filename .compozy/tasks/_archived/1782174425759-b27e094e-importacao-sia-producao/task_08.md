---
status: completed
title: Espelho rubricas_sia e reimport cadastros referência
type: backend
complexity: medium
dependencies: []
---

# Task 08: Espelho rubricas_sia e reimport cadastros referência

## Overview

Completar espelho MySQL→PG das dimensões de referência usadas na produção SIA: **forma**, **CBO** e **procedimento** já existem em `sync_cadastros_mysql.py`; adicionar **rubricas** (`s_rub` → `rubricas_sia`) com UPSERT idempotente. Documentar que reexecutar cadastros sync reimporta/atualiza sem duplicar.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create migration_011_rubricas_sia.sql with table rubricas_sia (codigo_rubrica PK, descricao, status, sincronizado_em)
- MUST extend sync_cadastros_mysql.py: build_rubrica_query, extrair_rubricas, sync_rubricas, normalize_rubrica_row
- MUST UPSERT from MySQL s_rub (RUB_ID, RUB_DC) with inactivation guard like forma/cbo
- MUST extend cadastros_sincronizacoes payload with rubricas inserted/updated/inactivated counts
- MUST verify existing forma/cbo/procedimento sync remains idempotent on re-run (no duplicate keys)
- MUST add pytest tests for rubrica query and sync counts
- SHOULD extend CadastroSyncBanner toast to mention rubricas count
</requirements>

## Subtasks

- [x] 8.1 Migration rubricas_sia + docker-compose init
- [x] 8.2 ETL extrair/sync rubricas from s_rub
- [x] 8.3 Backend listRubricas read-only (optional GET /api/cadastros/rubricas) or defer to Phase 2 (defer to Phase 2)
- [x] 8.4 Tests + update docs/agent/cadastros.md

## Implementation Details

Referência MySQL: `consultasia/docs/sia-schema-for-llm.md` §2.6 s_rub.

Padrão: copiar estrutura de `sync_cbos` / `formas_sia`.

### Relevant Files
- `migration_011_rubricas_sia.sql` — new
- `sync_cadastros_mysql.py` — extend
- `schema_full.sql` — rubricas_sia
- `tests/test_sync_cadastros_mysql.py`
- `simpa-backend/src/routes/cadastros.js` — optional list endpoint

### Dependent Files
- `task_02` — join s_rub em produção usa descricao de rubricas_sia quando disponível

### Related ADRs
- [ADR-004](../adrs/adr-004.md)

## Deliverables
- rubricas_sia espelhada + cadastros sync inclui rubricas + testes

## Tests
- Unit tests:
  - [x] build_rubrica_query targets s_rub RUB_ID/RUB_DC
  - [x] sync_rubricas UPSERT idempotent (second run = updated not duplicated)
  - [x] forma/cbo/procedimento re-sync test still passes
- Integration tests:
  - [x] POST cadastros/sincronizar JSON includes rubricas block (covered by backend route tests)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Reimport cadastros atualiza forma, CBO, procedimento e rubrica sem duplicar
