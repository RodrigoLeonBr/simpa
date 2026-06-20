---
status: completed
title: Importação API
type: backend
complexity: high
dependencies:
  - task_02
  - task_03
  - task_04
---

# Task 06: Importação API

## Overview

Build the e-SUS CSV import API: file upload to `uploads/`, preview without persist, full parse via Python subprocess, automatic consolidation, and CRUD on `esus_cargas` history.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement all importacao routes per TechSpec (preview, upload, cargas, reprocessar, substituir, delete)
- MUST store files under `uploads/esus/{ano}/{mes}/...` per schema comment
- MUST trigger consolidation after successful upload
- MUST enforce JWT on all routes
- MUST handle multer size limits aligned with nginx config
</requirements>

## Subtasks
- [x] 6.1 Implement storage service for upload paths and hash
- [x] 6.2 Parser service spawning parse_esus_csv.py
- [x] 6.3 Import routes with preview and full pipeline
- [x] 6.4 Cargas list/detail/reprocess/delete endpoints

## Implementation Details

See Plano B importacao routes and `estrutura_simpa.md` Section 3.3.

### Relevant Files
- `simpa-backend/src/routes/importacao.js` — create
- `simpa-backend/src/services/parser.js` — create
- `simpa-backend/src/services/storage.js` — create

### Dependent Files
- `SIMPA_ tela/SIMPA.dc.html` — Importação screen reference (Task 15)

### Related ADRs
- [ADR-002: Spec-Driven Stack](../adrs/adr-002.md)

## Deliverables
- End-to-end upload → postgres raw → consolidated dashboard data
- Cargas history API for frontend table
- Integration tests with fixture CSV and mocked subprocess where needed

## Tests
- Unit tests:
  - [x] Storage generates correct path from competencia
  - [x] Preview parses metadata without DB write
- Integration tests:
  - [x] Upload fixture CSV creates esus_cargas row
  - [x] Delete cascades esus_indicadores_raw
  - [x] Reprocess is idempotent (ON CONFLICT)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Import UI (Task 15) can upload repo sample CSV successfully
