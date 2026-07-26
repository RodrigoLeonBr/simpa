---
status: completed
title: Cadastros API CRUD for procedimentos and maps
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 03: Cadastros API CRUD for procedimentos and maps

## Overview

Expose REST CRUD for `procedimentos` and `esus_procedimento_map` under `/api/cadastros`, matching existing Unidades/Equipes patterns so Planning/billing can maintain the de-para without SQL. Soft-delete and clear validation errors (including 409 on unique violations) are required.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST implement endpoints listed in TechSpec API Endpoints for `/api/cadastros/procedimentos` and `/api/cadastros/esus-procedimento-map` (GET/POST/PUT/DELETE).
2. MUST soft-inactivate on DELETE (`status='inativo'`), returning `{inativado:true, id}`.
3. MUST return 400 for missing required fields and 404 when id not found.
4. MUST return 409 on unique constraint violations with a clear Portuguese or English error message.
5. MUST list maps joined to SIGTAP fields (`codigo_sigtap`, `descricao_sigtap`) and support filters `secao`, `q`, `status`.
6. SHOULD allow POST map with either `procedimento_id` or `codigo_sigtap` (resolve/create master as specified in TechSpec).
7. MUST default list endpoints to exclude `status='inativo'` unless `status` query overrides.
</requirements>

## Subtasks
- [x] 3.1 Add procedimentos CRUD routes
- [x] 3.2 Add esus-procedimento-map CRUD routes with join and filters
- [x] 3.3 Wire unique-violation handling to HTTP 409
- [x] 3.4 Ensure mount remains under `/api/cadastros` in app.js
- [x] 3.5 Add automated API tests for happy path and error cases

## Implementation Details

See TechSpec **API Endpoints** and existing patterns in `cadastros.js` for Unidades/Equipes. Do not invent auth beyond current open Cadastros access.

**Delivered:** routes in `cadastros.js`; PG `23505` → 409 in `errorHandler.js`; `app.js` listens only when main; tests in `test/cadastros-procedimentos.test.js`.

### Relevant Files
- `simpa-backend/src/routes/cadastros.js` — extend with new resources
- `simpa-backend/src/app.js` — mount confirmation
- `simpa-backend/src/middleware/errorHandler.js` — error shape
- `simpa-backend/src/services/db.js` — query helper

### Dependent Files
- Frontend Cadastros page (task_07) — consumes these endpoints

### Related ADRs
- [ADR-002](adrs/adr-002.md) — dual-table CRUD surface

## Deliverables
- Working CRUD for both resources
- Filterable joined map list
- API tests (Node test runner introduced if missing) **(REQUIRED)**
- Coverage >=80% on new route handlers **(REQUIRED)**

## Tests
- Unit tests:
  - [x] POST procedimentos without `codigo_sigtap` returns 400
  - [x] POST duplicate `codigo_sigtap` returns 409
  - [x] DELETE map sets status inativo and subsequent default GET omits it
- Integration tests:
  - [x] POST map with `codigo_sigtap` resolves to procedimento and returns joined row
  - [x] GET map `?secao=Procedimentos - Teste rápido&q=HIV` returns matching rows
  - [x] PUT map changing `procedimento_id` persists and GET reflects change
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Manual curl/Postman checklist for all 8 CRUD endpoints succeeds
- Behavior matches Unidades soft-delete conventions
