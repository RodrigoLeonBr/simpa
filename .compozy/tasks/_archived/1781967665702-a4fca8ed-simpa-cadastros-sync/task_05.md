---
status: completed
title: Backend estabelecimentos + procedimentos read-only API
type: backend
complexity: high
dependencies:
  - task_01
  - task_04
---

# Task 05: Backend estabelecimentos + procedimentos read-only API

## Overview

Replace manual CRUD for units/MAC/hospitals with establishments list/detail and enrichment PUT. Make procedures API read-only for MySQL-synced rows. Refactor `cadastroRegistry.js` accordingly.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement `GET /api/cadastros/estabelecimentos` with `perfil`, `status`, `q` query params
- MUST implement `GET /api/cadastros/estabelecimentos/:id`
- MUST implement `PUT /api/cadastros/estabelecimentos/:id/enriquecimento` accepting JSONB subset only
- MUST reject PUT attempts to modify synced scalar fields (nome, codigo_externo, etc.)
- MUST remove POST/PUT/DELETE on `/api/cadastros/procedimentos` for sync-sourced rows
- MUST keep GET `/api/cadastros/procedimentos` with search/pagination
- MUST remove `unidades`, `prestadores-mac`, `hospitais` from generic CRUD registry
</requirements>

## Subtasks
- [x] 5.1 Add estabelecimentos service with list/filter/search
- [x] 5.2 Add enrichment validation and update handler
- [x] 5.3 Refactor procedimentos routes to read-only
- [x] 5.4 Remove deprecated entity registrations from cadastroRegistry
- [x] 5.5 Update existing cadastros tests for new surface

## Implementation Details

See TechSpec **API Endpoints** — Establishments and Procedures sections.

Current registry at `simpa-backend/src/services/cadastroRegistry.js` registers six manual entities — three must be removed.

### Relevant Files
- `simpa-backend/src/services/cadastroRegistry.js` — refactor
- `simpa-backend/src/services/estabelecimentosService.js` — create
- `simpa-backend/src/routes/cadastros.js` — new routes
- `simpa-backend/tests/estabelecimentos.test.js` — create
- `simpa-backend/tests/cadastros.test.js` — update

### Dependent Files
- `simpa-frontend/src/pages/Cadastros/*` — consumes new API (task_08)
- `simpa-frontend/src/components/layout/FilterBar.tsx` — may use shim until task_09

### Related ADRs
- [ADR-001: Unified Establishment Mirror](adrs/adr-001.md)
- [ADR-003: estabelecimentos table](adrs/adr-003.md)

## Deliverables
- Establishments read + enrichment API
- Read-only procedures API
- Deprecated routes removed or return 410 with migration hint

## Tests
- Unit tests:
  - [x] Enrichment PUT with `{ leitos: { clinico: 10 } }` persists JSONB
  - [x] Enrichment PUT with `{ nome: "hack" }` returns 400
  - [x] List filter `perfil=Hospitalar` returns only matching rows
- Integration tests:
  - [x] GET estabelecimentos after sync returns seeded rows
  - [x] POST /api/cadastros/procedimentos returns 405 or 404
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- No remaining create/update/delete routes for synced establishment identity fields
