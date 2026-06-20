---
status: completed
title: Backend equipes FK migration + route deprecation
type: backend
complexity: medium
dependencies:
  - task_03
  - task_05
---

# Task 06: Backend equipes FK migration + route deprecation

## Overview

Switch Teams CRUD to use `estabelecimento_id` instead of `unidade_id`. Add optional backward-compat shim `GET /api/cadastros/unidades` proxying APS establishments for FilterBar until frontend task_09 completes.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST update equipes create/update to require `estabelecimento_id` FK
- MUST join `estabelecimentos` for `unidade_nome` in list queries (replace unidades_saude join)
- MUST validate `estabelecimento_id` references active establishment
- SHOULD provide temporary `GET /api/cadastros/unidades` shim → `estabelecimentos?perfil=APS` mapped to legacy response shape
- MUST keep emendas CRUD unchanged
</requirements>

## Subtasks
- [x] 6.1 Update equipes SQL in cadastroRegistry for estabelecimento_id
- [x] 6.2 Add FK validation on equipes create/update
- [x] 6.3 Implement optional unidades compat shim route
- [x] 6.4 Update equipes integration tests

## Implementation Details

See TechSpec **API Endpoints** — Unchanged manual CRUD and backward-compat shim.

Run task_03 migration script before deploying this task to dev.

### Relevant Files
- `simpa-backend/src/services/cadastroRegistry.js` — equipes entity
- `simpa-backend/src/routes/cadastros.js` — shim route
- `simpa-backend/tests/integration/cadastros.integration.test.js` — update
- `scripts/migrate_cadastros_legacy.sql` — prerequisite (task_03)

### Dependent Files
- `simpa-frontend/src/components/layout/FilterBar.tsx` — task_09 removes shim dependency

### Related ADRs
- [ADR-003: estabelecimentos FK migration](adrs/adr-003.md)

## Deliverables
- Equipes API uses estabelecimento_id
- Compat shim documented as temporary
- Updated integration tests

## Tests
- Unit tests:
  - [x] Create equipe with invalid estabelecimento_id returns 400
  - [x] List equipes returns estabelecimento nome in response
- Integration tests:
  - [x] CRUD round-trip equipe linked to estabelecimento
  - [x] GET /api/cadastros/unidades shim returns APS establishments in legacy shape
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Existing FilterBar continues working via shim until task_09
