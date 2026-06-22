---
status: pending
title: Consolidador e siaProducaoService por estabelecimento_id
type: backend
complexity: medium
dependencies:
  - task_03
---

# Task 06: Consolidador e siaProducaoService por estabelecimento_id

## Overview

Atualizar `consolidate_dashboard.py` e `siaProducaoService.js` para preferir `estabelecimento_id` e CNES na leitura de produção, incluir métricas apresentado na API GET /producao quando disponíveis.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST update fetch_sia_rows to filter by estabelecimento_id when dashboard uses ID scope
- MUST fallback to unidade name match for legacy rows
- MUST extend listProducao query param estabelecimento_id
- MUST include quantidade_apresentada, valor_apresentado in API response when columns populated
- MUST update tests/test_consolidate.py and siaProducao.test.js
</requirements>

## Subtasks

- [ ] 6.1 consolidate_dashboard fetch_sia_rows by estabelecimento_id
- [ ] 6.2 siaProducaoService filter and SELECT new columns
- [ ] 6.3 Update dashboard contract builder if needed for glosa fields
- [ ] 6.4 pytest + Jest coverage

## Implementation Details

### Relevant Files
- `consolidate_dashboard.py` — fetch_sia_rows
- `simpa-backend/src/services/siaProducaoService.js`
- `simpa-backend/tests/siaProducao.test.js`
- `tests/test_consolidate.py`

### Dependent Files
- `migration_010_sia_producao_cnes.sql`

## Deliverables
- Consolidador + API produção alinhados ao CNES/FK

## Tests
- Unit tests:
  - [ ] fetch_sia_rows prefers estabelecimento_id
  - [ ] listProducao filters by estabelecimento_id
  - [ ] Returns apresentado columns when present
- Integration tests:
  - [ ] consolidate includes sia rows after sync fixture
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Painel mostra ambulatorial_sia após sync + consolidar
