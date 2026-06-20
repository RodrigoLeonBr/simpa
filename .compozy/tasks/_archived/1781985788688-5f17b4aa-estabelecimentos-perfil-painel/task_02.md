---
status: completed
title: "Conditional perfil preservation in MySQL sync"
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 02: Conditional perfil preservation in MySQL sync

## Overview

Update the Python cadastro sync so re-import from MySQL no longer overwrites user-edited `perfil`. New inserts still derive perfil from `tipouni`; updates respect `perfil_editado=true` on existing rows.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST change `UPSERT_ESTABELECIMENTO_SQL` in `sync_cadastros_mysql.py` to conditional `perfil` update per TechSpec Sync UPSERT section
- MUST set `perfil_editado=false` on INSERT of new establishments
- MUST NOT modify any `enriquecimento_*` tables during sync
- SHOULD optionally add `perfil_preserved_count` to sync result JSON for observability
- MUST extend existing pytest coverage in `tests/test_sync_cadastros_mysql.py`
</requirements>

## Subtasks
- [x] 02.1 Update UPSERT SQL with CASE on `perfil_editado`
- [x] 02.2 Ensure INSERT path sets `perfil_editado=false`
- [x] 02.3 Add pytest: manual perfil survives re-sync when flag true
- [x] 02.4 Add pytest: new row still derives perfil from tipouni mapping

## Implementation Details

See TechSpec **Integration Points** (MySQL prestador) and ADR-002. Depends on `perfil_editado` column from task_01.

### Relevant Files
- `sync_cadastros_mysql.py` — `UPSERT_ESTABELECIMENTO_SQL`, `sync_estabelecimentos`
- `tests/test_sync_cadastros_mysql.py` — existing `test_pg_write_preserves_enriquecimento` pattern

### Dependent Files
- `simpa-backend/src/services/cadastrosSync.js` — spawn contract unchanged; may surface new count field

### Related ADRs
- [ADR-002: Preserve Manual Perfil via perfil_editado Flag](adrs/adr-002.md)

## Deliverables
- Updated `sync_cadastros_mysql.py`
- New/updated tests in `tests/test_sync_cadastros_mysql.py`
- Unit tests with 80%+ coverage on changed Python modules **(REQUIRED)**
- Integration tests for PG write path **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `derive_perfil` unchanged behavior for tipouni 1/2/3 and default Outro
  - [x] `normalize_prestador_row` includes derived perfil on new rows
- Integration tests:
  - [x] PG write: row with `perfil_editado=true` and `perfil='MAC'` keeps MAC after sync when tipouni maps to APS
  - [x] PG write: new codigo_externo gets derived perfil and `perfil_editado=false`
  - [x] PG write: `enriquecimento_hospitalar` row unchanged after sync
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on `sync_cadastros_mysql.py` changed lines
- `pytest tests/test_sync_cadastros_mysql.py` green
- Sync JSON documents preserved perfil count when applicable
