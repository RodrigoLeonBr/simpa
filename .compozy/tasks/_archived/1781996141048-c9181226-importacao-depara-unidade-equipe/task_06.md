---
status: completed
title: Importacao API — preview gate, upload resolucoes, mapeamentos CRUD
type: backend
complexity: high
dependencies:
  - task_02
  - task_03
  - task_04
---

# Task 06: Importacao API — preview gate, upload resolucoes, mapeamentos CRUD

## Overview

Wire `importMappingService` into `routes/importacao.js`: enriched preview responses, upload with `resolucoes` JSON, mapeamentos CRUD with `requirePlanningStaff`, and orchestrated parser/consolidator calls with resolved IDs. Include backend integration test for preview→upload→dashboard path.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST enrich `POST /preview` with mapping fields per TechSpec `PreviewCargaEnriquecida` contract
- MUST handle per-file parser errors without failing entire batch (return row-level `error`)
- MUST accept `POST /upload` multipart with `resolucoes` JSON array matching preview filenames
- MUST validate all files resolved before processing; return 409 on Todas conflict without confirmation flag
- MUST implement GET/POST/PUT/DELETE `/api/importacao/mapeamentos` with planning-staff gate on mutations
- MUST call `processar` and `runConsolidation` with resolved IDs after mapping
- MUST extend GET `/cargas` with JOIN to cadastro names and FK columns
- MUST upsert registry when `salvar_mapeamento: true` in resolucao
</requirements>

## Subtasks
- [x] 06.1 Refactor preview loop to use `enrichPreviewItem`
- [x] 06.2 Implement upload orchestration with resolucoes validation and Todas purge
- [x] 06.3 Add mapeamentos CRUD routes
- [x] 06.4 Update `cargaExists` to consider ID tuple where applicable
- [x] 06.5 Extend `importacao.test.js` and `importacao.integration.test.js`

## Implementation Details

See TechSpec **API Endpoints — Importação** and **Data flow — Upload**.

### Relevant Files
- `simpa-backend/src/routes/importacao.js`
- `simpa-backend/src/services/importMappingService.js`
- `simpa-backend/src/middleware/requirePlanningStaff.js`
- `simpa-backend/tests/importacao.test.js`
- `simpa-backend/tests/integration/importacao.integration.test.js`

### Dependent Files
- `simpa-frontend/src/api/importacao.ts` — task_07

### Related ADRs
- [ADR-001: Mapping Registry with Preview Gate](adrs/adr-001.md)
- [ADR-003: Node orchestration layer](adrs/adr-003.md)

## Deliverables
- Updated importacao routes and helpers
- Extended Jest unit and integration tests
- Integration test: preview → upload → `esus_cargas.estabelecimento_id NOT NULL` → dashboard GET by ID 200 **(REQUIRED)**

## Tests
- Unit tests:
  - [x] POST /preview returns `mapeamento_status: pending` for unknown e-SUS unit label
  - [x] POST /preview returns resolved mapping when registry hit
  - [x] POST /upload without resolucoes returns 400
  - [x] POST /upload with Todas conflict without confirm returns 409
  - [x] POST /mapeamentos without planning role returns 403
  - [x] GET /cargas includes estabelecimento_id and cadastro nome fields
- Integration tests:
  - [x] Full flow: upload CSV with resolucao → carga has non-null FKs → consolidator runs → GET dashboard by estabelecimento_id returns 200
  - [x] Re-upload same file upserts without duplicate violation
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on importacao route changes
- CAFI fixture import succeeds with mapping and populates Panel-queryable consolidated row
