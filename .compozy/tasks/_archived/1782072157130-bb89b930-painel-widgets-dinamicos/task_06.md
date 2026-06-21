---
status: completed
title: Cadastro painel-widgets API routes and audit
type: backend
complexity: medium
dependencies:
  - task_02
  - task_03
---

# Task 06: Cadastro painel-widgets API routes and audit

## Overview

Add REST routes under `/api/cadastros/painel-widgets` for widget CRUD, reorder, preview, and audit logging for planning staff mutations.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST mount routes in `simpa-backend/src/routes/cadastros.js`
- MUST protect POST/PUT/PATCH/DELETE and preview with `requirePlanningStaff`
- MUST implement GET list, GET :id, POST create, PUT :id, PATCH reorder, DELETE :id (soft)
- MUST implement POST `/painel-widgets/preview` calling `previewWidget`
- MUST call `logAudit` for create/update/reorder/inactivate with actions from TechSpec
- MUST return appropriate 403 for non-planning roles on writes
- SHOULD validate body fields: slug, tipo, titulo, metrica_id, perfil, layout
</requirements>

## Subtasks
- [x] 06.1 Wire GET list and GET detail routes
- [x] 06.2 Wire mutating routes with planning staff guard
- [x] 06.3 Implement PATCH reorder body validation
- [x] 06.4 Implement preview POST route
- [x] 06.5 Audit log integration
- [x] 06.6 Supertest coverage for auth and happy paths

## Implementation Details

See TechSpec **API Endpoints → Cadastro**. Mirror `cadastros.js` patterns for equipes/emendas and audit from `POST /sincronizar`.

### Relevant Files
- `simpa-backend/src/routes/cadastros.js`
- `simpa-backend/src/middleware/requirePlanningStaff.js`
- `simpa-backend/src/services/auditService.js`

### Dependent Files
- `simpa-frontend/src/api/painelWidgets.ts` — task_08
- `docs/agent/backend-api.md` — task_18

### Related ADRs
- [ADR-001: Curated Metric Catalog](../adrs/adr-001.md)

## Deliverables
- Cadastro painel-widgets routes in `cadastros.js`
- `simpa-backend/tests/painelWidgetsRoutes.test.js` **(REQUIRED)**

## Tests
- Unit tests:
  - [x] GET list returns 200 for authenticated user
  - [x] POST create returns 403 for Visualizador JWT fixture
  - [x] POST create returns 201 for Planejamento fixture
  - [x] PATCH reorder with invalid orderedIds returns 400
  - [x] POST preview returns resolved widget fragment
  - [x] DELETE sets inativo and writes audit entry (mock auditService)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- [x] All tests passing
- [x] All TechSpec painel-widgets endpoints reachable via supertest
