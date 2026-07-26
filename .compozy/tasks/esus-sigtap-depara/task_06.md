---
status: completed
title: Consolidator procedimentos_mapeados + schema version bump
type: backend
complexity: medium
dependencies:
  - task_04
---

# Task 06: Consolidator procedimentos_mapeados + schema version bump

## Overview

Enrich `consolidate_dashboard.py` so `dados_consolidados` includes mapped APS procedures for analytical cross-reference, bumping the dashboard contract version. Uses the same resolve semantics as export.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST add `procedimentos_mapeados` array under `modulos.atencao_primaria_esus` in consolidator output (snake_case fields per TechSpec).
2. MUST use shared resolve / identical SQL semantics from task_04.
3. MUST bump `versao_schema` (e.g. 3.1.0 → 3.2.0) consistently in Python constant and any docs/mocks touched.
4. MUST silently omit unmapped labels.
5. MUST update frontend `contrato.ts` and `mock/db.json` so types and mock include the new array (can be empty array until task_08 UI).
6. SHOULD keep existing KPI/turno logic unchanged aside from the new field.
</requirements>

## Subtasks
- [x] 6.1 Call shared resolve inside build_payload / APS module builder
- [x] 6.2 Emit `procedimentos_mapeados` in JSON written to `dados_consolidados`
- [x] 6.3 Bump VERSAO_SCHEMA and align mocks/types
- [x] 6.4 Re-run consolidator against sample competencia and verify payload
- [x] 6.5 Add Python tests for enrichment behavior

## Implementation Details

See TechSpec **Impact Analysis**, **Development Sequencing** step 6, ADR-004. Touch `build_payload` / APS builders in `consolidate_dashboard.py`; backend `consolidador.js` only if version plumbing requires it.

**Delivered:**
- `fetch_procedimentos_mapeados` → `resolve_mapped_procedures` in `consolidate_dashboard.py`
- `VERSAO_SCHEMA = "3.2.0"`; schema default + mock + readme + `contrato.ts`
- Tests: `tests/test_consolidate_procedimentos_mapeados.py` (5), `test/dashboard-procedimentos-mapeados.test.js` (1)

### Relevant Files
- `consolidate_dashboard.py` — primary change
- `simpa-backend/src/services/consolidador.js` — spawns Python
- `simpa-frontend/src/types/contrato.ts` — ModuloAPS type
- `simpa-frontend/mock/db.json` — sample payload

### Dependent Files
- Painel UI (task_08) — displays new array

### Related ADRs
- [ADR-004](adrs/adr-004.md) — consolidado consumption surface

## Deliverables
- Consolidator emits `procedimentos_mapeados`
- Contract version bumped and mocks/types updated
- Python tests **(REQUIRED)**
- Coverage >=80% on new consolidator functions **(REQUIRED)**

## Tests
- Unit tests:
  - [x] build_payload includes `procedimentos_mapeados` key even when empty
  - [x] Mapped fixture rows appear with codigo_sigtap and quantidade
  - [x] Unmapped fixture labels absent from array
- Integration tests:
  - [x] `--pg-write` for a competencia persists JSON containing the new array
  - [x] GET `/api/v1/dashboard/planejamento` returns versao_schema 3.2.0 (or chosen bump) with the field
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Painel types compile with new field
- Export resolve and consolidator counts match for same filters on fixture data
