---
status: completed
title: Consolidator ETL — consolidate and store dashboard by cadastro IDs
type: backend
complexity: high
dependencies:
  - task_03
---

# Task 04: Consolidator ETL — consolidate and store dashboard by cadastro IDs

## Overview

Extend `consolidate_dashboard.py` and `consolidator.js` to accept `--estabelecimento-id` and `--equipe-id`, fetch raw rows by FK, and write `dados_consolidados` with cadastro IDs plus display names from JOINs.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add CLI args `--estabelecimento-id` and `--equipe-id` to `consolidate_dashboard.py`
- MUST update `fetch_raw_rows` to filter by `estabelecimento_id` and `equipe_id` when provided
- MUST update `write_payload` to INSERT FK columns and populate `unidade`/`equipe` text from cadastro names
- MUST use ON CONFLICT on ID unique index when IDs present
- MUST update `consolidator.js` to forward ID args
- MUST update `fetch_groups` for `--all` mode to use non-null establishment IDs where applicable
</requirements>

## Subtasks
- [x] 04.1 Add CLI args and wire through `consolidate_group`
- [x] 04.2 Refactor SQL fetch/write for ID-based dimensions
- [x] 04.3 Extend `consolidator.js` spawn args
- [x] 04.4 Add pytest in `tests/test_consolidate.py` for ID write path
- [x] 04.5 Update consolidator Jest tests if present

## Implementation Details

See TechSpec **Parser / consolidator write changes** and **Development Sequencing** step 5.

### Relevant Files
- `consolidate_dashboard.py` — `fetch_raw_rows`, `write_payload`, `fetch_groups`
- `simpa-backend/src/services/consolidator.js`
- `tests/test_consolidate.py`
- `etl_contract.py` — payload builder unchanged

### Dependent Files
- `simpa-backend/src/services/dashboardService.js` — task_05 queries consolidated rows
- `simpa-backend/src/routes/importacao.js` — task_06 triggers consolidation with IDs

### Related ADRs
- [ADR-002: Cadastro keys on import storage](adrs/adr-002.md)

## Deliverables
- Updated `consolidate_dashboard.py` and `consolidator.js`
- Updated pytest consolidate tests
- Unit tests with 80%+ coverage **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `write_payload` sets `estabelecimento_id` and `equipe_id` on INSERT
  - [x] `fetch_raw_rows` with IDs does not rely on text `unidade` match alone
  - [x] `consolidator.js` passes ID flags to Python spawn
  - [x] Legacy name-only CLI path still works for unmigrated rows
- Integration tests:
  - [ ] N/A — task_06 end-to-end
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on changed consolidator code
- Consolidation after import produces `dados_consolidados` row queryable by FK
