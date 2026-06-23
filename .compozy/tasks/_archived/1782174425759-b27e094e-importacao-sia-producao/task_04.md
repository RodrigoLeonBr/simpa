---
status: completed
title: API SIA auth planning staff e resposta enriquecida
type: backend
complexity: medium
dependencies:
  - task_03
---

# Task 04: API SIA auth planning staff e resposta enriquecida

## Overview

Proteger `POST /api/sia/sincronizar` com `requirePlanningStaff`, propagar campos estendidos do sync Python na resposta HTTP, e validar competência e erros MySQL indisponível com status codes consistentes.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST apply requirePlanningStaff to POST /sincronizar
- MUST add GET /sincronizacoes/existe?competencia=YYYY-MM
- MUST return 409 SIA_COMPETENCIA_JA_IMPORTADA when competencia already ok/parcial and reimportar !== true
- MUST pass reimportar=true to Python spawn when confirmed
- MUST return orphan_cnes and estabelecimentos_resolvidos in 201 response
- MUST preserve consolidator trigger on ok/parcial status
- MUST update sia.routes.test.js and sia.test.js
</requirements>

## Subtasks

- [x] 4.1 Middleware + GET existe endpoint
- [x] 4.2 409 gate + reimportar body passthrough to sync_sia_mysql.py
- [x] 4.3 Document endpoints in docs/agent/backend-api.md

## Implementation Details

### Relevant Files
- `simpa-backend/src/routes/sia.js`
- `simpa-backend/src/services/sia.js`
- `simpa-backend/tests/sia.routes.test.js`
- `simpa-backend/tests/sia.test.js`

### Dependent Files
- `sync_sia_mysql.py` — JSON output shape

## Deliverables
- Rotas protegidas + testes Jest + doc backend-api

## Tests
- Unit tests:
  - [x] POST sincronizar 403 for non-planning role
  - [x] POST sincronizar 409 when competencia exists without reimportar
  - [x] POST sincronizar 201 with reimportar:true after prior import
  - [x] GET existe returns exists:true for imported competencia
  - [x] Invalid competencia → 400
- Integration tests:
  - [x] sia.integration.test.js still passes
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Apenas planejamento/admin disparam sync produção
