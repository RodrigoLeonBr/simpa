---
status: completed
title: Python ETL suite (consolidate + SIA sync)
type: backend
complexity: high
dependencies:
  - task_01
---

# Task 02: Python ETL suite (consolidate + SIA sync)

## Overview

Implement missing Python pipelines that transform raw e-SUS staging and SIA data into `dados_consolidados` JSONB matching contract v3.1.0, including `indicadores_qualidade[]`. Extend existing `parse_esus_csv.py` with verified `--json-out` / `--pg-write` flags.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement `consolidate_dashboard.py` with `--json-out`, `--pg-write`, `--all` flags
- MUST implement `sync_sia_mysql.py` reading XAMPP MySQL tables (read-only) per ADR-003
- MUST preserve `null` semantics — never coerce missing indicators to zero
- MUST populate `indicadores_qualidade[]` in consolidated payload (auth design spec Section 13)
- MUST add `requirements.txt` and pytest suite
</requirements>

## Subtasks
- [x] 2.1 Verify/extend `parse_esus_csv.py` subprocess JSON interface
- [x] 2.2 Build consolidator: raw EAV → `dados_consolidados.dados_conteudo`
- [x] 2.3 Build SIA sync: MySQL → `sia_producao` + merge into consolidation
- [x] 2.4 Add pytest fixtures using repo sample CSVs and seed SQL

## Implementation Details

See TechSpec **Core Interfaces** (Python subprocess) and PRD Section 5.

### Relevant Files
- `parse_esus_csv.py` — existing parser
- `consolidate_dashboard.py` — create
- `sync_sia_mysql.py` — create
- `seed_esus_2026-05.sql` — test fixture

### Dependent Files
- `simpa-backend/src/services/parser.js` — will spawn these scripts (Task 06)

### Related ADRs
- [ADR-002: Spec-Driven Stack](../adrs/adr-002.md)
- [ADR-003: SIA MySQL via XAMPP Host](../adrs/adr-003.md)
- [ADR-006: Full Test Strategy](../adrs/adr-006.md)

## Deliverables
- Three working Python scripts invocable from CLI
- Consolidated JSON sample matching v3.1.0 contract
- pytest suite with ≥80% coverage on parser/consolidator

## Tests
- Unit tests:
  - [x] Parser detects report type and competencia from sample CSVs
  - [x] ISO-8859-1 encoding handled correctly
  - [x] Consolidator output validates against JSON schema fixture
  - [x] Null indicator values remain null in output
- Integration tests:
  - [x] `--pg-write` round-trip against test postgres (Task 01)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- `consolidate_dashboard.py --all --pg-write` populates dashboard-readable rows
- SIA sync writes to `sia_producao` when MySQL available
