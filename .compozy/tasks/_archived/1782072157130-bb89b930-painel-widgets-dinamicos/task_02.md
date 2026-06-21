---
status: completed
title: Widget configuration CRUD service
type: backend
complexity: medium
dependencies: []
---

# Task 02: Widget configuration CRUD service

## Overview

Implement database access and validation for `painel_widgets`: list, read, create, update, reorder, and soft-delete layout slots scoped by `perfil` and `layout`. Joins catalog metadata for cadastro display.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `simpa-backend/src/services/painelWidgetsService.js` with CRUD exports listed in TechSpec Core Interfaces (excluding resolve — task_03)
- MUST enforce UNIQUE `(perfil, layout, slug)` on create/update
- MUST validate `metrica_id` and `spark_metrica_id` FK exist and are `ativo`
- MUST support `reorderWidgets(perfil, layout, orderedIds)` in a transaction
- MUST soft-delete via `status = 'inativo'` (no hard DELETE)
- MUST JOIN `painel_metricas_catalogo` on list/get for label and sql_preview
- SHOULD update `atualizado_em` on mutations
</requirements>

## Subtasks
- [x] 02.1 Implement `listWidgets` and `getWidgetById` with metric JOIN
- [x] 02.2 Implement `createWidget` / `updateWidget` with JSONB field validation
- [x] 02.3 Implement `reorderWidgets` updating `ordem` sequentially
- [x] 02.4 Implement `inactivateWidget`
- [x] 02.5 Jest tests with mocked `query`

## Implementation Details

See TechSpec **Data Models** (`painel_widgets` table). Mirror patterns from `cadastrosService.js` and `estabelecimentosService.js` transaction usage.

### Relevant Files
- `migration_008_painel_widgets.sql` — schema and seed
- `simpa-backend/src/services/cadastrosService.js` — CRUD patterns
- `simpa-backend/src/services/estabelecimentosService.js` — transaction example

### Dependent Files
- `simpa-backend/src/routes/cadastros.js` — task_06
- `simpa-backend/src/services/painelWidgetsService.js` — resolve extension task_03

### Related ADRs
- [ADR-001: Curated Metric Catalog](../adrs/adr-001.md)

## Deliverables
- `painelWidgetsService.js` CRUD section (same file as task_03 resolver)
- `simpa-backend/tests/painelWidgetsCrud.test.js` **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `listWidgets({ perfil: 'APS', layout: 'A' })` returns 8 seed rows ordered by `ordem`
  - [x] `createWidget` with duplicate slug returns 409 or validation error
  - [x] `updateWidget` with invalid `metrica_id` rejects before UPDATE
  - [x] `reorderWidgets` persists new order atomically (mock transaction)
  - [x] `inactivateWidget` sets status without deleting row
- Integration tests:
  - [ ] N/A unless PG available — optional list against Docker seed
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- [x] All tests passing
- [x] Test coverage >=80% on CRUD functions
- [x] CRUD operations match TechSpec API inputs/outputs shape
