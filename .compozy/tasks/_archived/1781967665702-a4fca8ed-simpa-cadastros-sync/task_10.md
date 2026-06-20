---
status: completed
title: Deprecation cleanup + integration verification
type: refactor
complexity: medium
dependencies:
  - task_09
---

# Task 10: Deprecation cleanup + integration verification

## Overview

Remove deprecated backend routes, frontend dead code, and compat shims after migration complete. Run full verification pipeline and update SIMPA master task list references (Task 16 superseded).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST remove `GET /api/cadastros/unidades` compat shim after task_09 verified
- MUST remove frontend code paths for unidades, prestadores-mac, hospitais entities
- MUST remove or archive deprecated PG tables (`_deprecated_*`) only after FK verification
- MUST update `simpa-backend/tests/cadastros.test.js` to reflect final API surface
- MUST add API integration test for full sync → list establishments flow (mocked subprocess)
- MUST document Task 16 supersession in `.compozy/tasks/simpa/task_16.md` header note
- MUST run frontend + backend full test suites with >=80% coverage on changed modules
</requirements>

## Subtasks
- [x] 10.1 Remove deprecated routes and registry entries
- [x] 10.2 Delete unused frontend components/config for legacy entities
- [x] 10.3 Add end-to-end API integration test for cadastro sync flow
- [x] 10.4 Update vite coverage includes; remove dead test files
- [x] 10.5 Cross-reference Task 17/18 acceptance criteria if cadastro routes mentioned

## Implementation Details

See TechSpec **Impact Analysis** and **Development Sequencing** step 11.

### Relevant Files
- `simpa-backend/src/routes/cadastros.js`
- `simpa-backend/src/services/cadastroRegistry.js`
- `simpa-frontend/src/config/cadastroEntities.ts`
- `simpa-frontend/src/components/cadastros/CadastroCrudPage.tsx`
- `.compozy/tasks/simpa/task_16.md` — add superseded note

### Dependent Files
- `.compozy/tasks/simpa/_tasks.md` — optional status note on task_16

### Related ADRs
- [ADR-001](adrs/adr-001.md), [ADR-002](adrs/adr-002.md), [ADR-003](adrs/adr-003.md)

## Deliverables
- Clean codebase without deprecated cadastro CRUD for synced entities
- Integration test proving sync → read establishments path
- Verification report (npm test + pytest cadastro tests)

## Tests
- Unit tests:
  - [x] Deprecated paths return 404 (unidades, prestadores-mac, hospitais POST)
- Integration tests:
  - [x] POST sincronizar (mocked) → GET estabelecimentos returns rows
  - [x] Full backend jest suite passes
  - [x] Full frontend vitest suite passes with coverage thresholds
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- No references to manual CRUD for MySQL-sourced establishments/procedures in active code
