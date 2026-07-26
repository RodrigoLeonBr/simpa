---
status: completed
title: Export API JSON and CSV
type: backend
complexity: medium
dependencies:
  - task_04
---

# Task 05: Export API JSON and CSV

## Overview

Expose `GET /api/procedimentos/export` so Planning can download mapped e-SUS procedure production as JSON or CSV using the shared resolve service. This is the MVP export artifact (not BPA).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST implement `GET /api/procedimentos/export` with query `competencia` (required), `unidade`, `equipe`, `format=json|csv` (default json).
2. MUST return 400 when `competencia` is missing or invalid.
3. MUST use shared resolve from task_04 (no separate join logic).
4. MUST emit CSV columns exactly: `competencia,unidade,equipe,secao,descricao_esus,codigo_sigtap,descricao_sigtap,quantidade`.
5. MUST set appropriate `Content-Type` and `Content-Disposition` for CSV downloads.
6. SHOULD log competencia, unidade, equipe, row_count, format (TechSpec Monitoring).
7. MUST return empty array/CSV header-only when nothing mapped (not an error).
</requirements>

## Subtasks
- [x] 5.1 Add export route module and mount in app.js
- [x] 5.2 Validate query params and call shared resolve
- [x] 5.3 Serialize JSON response
- [x] 5.4 Serialize CSV with required columns and escaping
- [x] 5.5 Add logging and automated tests

## Implementation Details

See TechSpec **API Endpoints**, **CSV columns**, and ADR-004. Mount outside cadastros as `/api/procedimentos/export`.

**Delivered:**
- `simpa-backend/src/routes/procedimentos.js` — `GET /export` via `resolveMappedProcedures`
- Mount in `app.js` at `/api/procedimentos`
- CSV RFC 4180 escape; filename `procedimentos-mapeados-YYYY-MM.csv`
- Log `[procedimentos/export]` with competencia, unidade, equipe, row_count, format
- Tests: `test/procedimentos-export.test.js` (6 cases)

**Note:** `unidade` e `equipe` são obrigatórios na prática (contrato do resolve task_04); CSV carimba esses filtros em cada linha.

### Relevant Files
- `simpa-backend/src/app.js` — register new router
- `simpa-backend/src/routes/` — new export route file
- Shared resolve from task_04

### Dependent Files
- Frontend export download (task_08)
- Docs (task_09)

### Related ADRs
- [ADR-004](adrs/adr-004.md) — JSON + CSV dual format

## Deliverables
- Working export endpoint (JSON + CSV)
- Request logging fields
- API tests **(REQUIRED)**
- Coverage >=80% on export handler/serializer **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Missing competencia returns 400
  - [x] format=csv produces header line with exact column names in order
  - [x] CSV escapes commas/quotes in descricao fields
- Integration tests:
  - [x] format=json returns array of MappingLookup-shaped objects for fixture carga
  - [x] format=csv downloads with Content-Disposition filename containing competencia
  - [x] Empty mapping set returns `[]` / header-only CSV with 200
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Export matches resolve output row-for-row
- CSV opens correctly in spreadsheet software
