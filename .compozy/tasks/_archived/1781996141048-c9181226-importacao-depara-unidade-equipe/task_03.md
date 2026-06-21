---
status: completed
title: Parser ETL — write estabelecimento_id and equipe_id to esus_cargas
type: backend
complexity: high
dependencies:
  - task_01
---

# Task 03: Parser ETL — write estabelecimento_id and equipe_id to esus_cargas

## Overview

Extend `parse_esus_csv.py` and `parser.js` to accept `--estabelecimento-id` and `--equipe-id` CLI flags and persist FK columns on `esus_cargas` INSERT/UPSERT. Retain e-SUS text fields for audit.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add CLI args `--estabelecimento-id` and `--equipe-id` to `parse_esus_csv.py`
- MUST include FK columns in `write_to_pg` INSERT and explicit `carga_params` dict
- MUST use ON CONFLICT on `(tipo_relatorio, competencia, estabelecimento_id, equipe_id)` when IDs provided
- MUST reject `--pg-write` when establishment ID missing (application layer enforces before spawn)
- MUST update `parser.js` `runParser` to forward ID args to Python spawn
- MUST retain existing `--json-out` preview behavior unchanged
</requirements>

## Subtasks
- [x] 03.1 Add CLI argument parsing for establishment and team IDs
- [x] 03.2 Update `write_to_pg` INSERT/ON CONFLICT for ID-based uniqueness
- [x] 03.3 Extend `parser.js` spawn signature; update `preview`/`processar` exports
- [x] 03.4 Add pytest cases for FK write path
- [x] 03.5 Update `simpa-backend/tests/parser.test.js` for new spawn args

## Implementation Details

See TechSpec **Parser / consolidator write changes** and ADR-002.

### Relevant Files
- `parse_esus_csv.py` — `write_to_pg`, `carga_params`
- `simpa-backend/src/services/parser.js` — spawn wrapper
- `tests/test_parse_esus_csv.py` — existing parser tests
- `simpa-backend/tests/parser.test.js`

### Dependent Files
- `consolidate_dashboard.py` — task_04 reads cargas by ID
- `simpa-backend/src/routes/importacao.js` — task_06 calls processar with IDs

### Related ADRs
- [ADR-002: Cadastro keys on import storage](adrs/adr-002.md)
- [ADR-003: Node orchestration layer](adrs/adr-003.md)

## Deliverables
- Updated `parse_esus_csv.py` and `parser.js`
- Updated pytest and Jest parser tests
- Unit tests with 80%+ coverage on changed Python paths **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `write_to_pg` INSERT includes `estabelecimento_id` and `equipe_id` when args passed
  - [x] ON CONFLICT upsert targets ID tuple not text-only tuple when IDs present
  - [x] `parser.js processar` passes `--estabelecimento-id` and `--equipe-id` to spawn
  - [x] Preview `--json-out` still works without ID args
- Integration tests:
  - [ ] N/A — task_06 covers end-to-end
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on modified parser modules
- Manual CLI: `python parse_esus_csv.py file.csv --pg-write --estabelecimento-id N --equipe-id M` writes FKs
