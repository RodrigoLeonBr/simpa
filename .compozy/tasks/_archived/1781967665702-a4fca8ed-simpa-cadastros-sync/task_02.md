---
status: completed
title: Python sync_cadastros_mysql.py + tests
type: backend
complexity: high
dependencies:
  - task_01
---

# Task 02: Python sync_cadastros_mysql.py + tests

## Overview

Implement Python ETL script that reads MySQL `prestador` and `procedimento`, upserts PostgreSQL mirror tables, preserves `enriquecimento` JSONB on re-sync, soft-deactivates missing rows, and writes sync audit log. Follows same subprocess JSON contract as `sync_sia_mysql.py`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST read MySQL read-only via `etl_db.mysql_connect()` (ADR-003 pattern)
- MUST upsert `estabelecimentos` by `codigo_externo` without overwriting `enriquecimento`
- MUST upsert `procedimentos` by `codigo_sigtap` with MySQL mirror columns
- MUST derive `perfil` from `CADASTRO_PERFIL_MAP` env JSON
- MUST support `--pg-write` and `--dry-run` CLI flags
- MUST return JSON stdout matching TechSpec Core Interfaces `CadastroSyncResult`
- MUST insert row into `cadastros_sincronizacoes` on `--pg-write`
- MUST set `status=inativo` for PG rows absent from MySQL snapshot
</requirements>

## Subtasks
- [x] 2.1 Extract prestador/procedimento queries reusing SIA env column overrides
- [x] 2.2 Implement profile mapping from `CADASTRO_PERFIL_MAP`
- [x] 2.3 Implement transactional PG upsert + inactivate logic
- [x] 2.4 Add CLI entrypoint and JSON stdout contract
- [x] 2.5 Add pytest coverage for mapping, enrichment preservation, dry-run

## Implementation Details

See TechSpec **Core Interfaces** (Python subprocess), **Data Models** (field mapping), **Integration Points**.

Mirror patterns from `sync_sia_mysql.py` and `etl_db.py`.

### Relevant Files
- `sync_cadastros_mysql.py` — create
- `etl_db.py` — reuse connection helpers
- `sync_sia_mysql.py` — reference env var naming for prestador/procedimento columns
- `tests/test_sync_cadastros_mysql.py` — create
- `producao.sql` — MySQL schema reference

### Dependent Files
- `simpa-backend/src/services/cadastrosSync.js` — spawns this script (task_04)

### Related ADRs
- [ADR-002: Dedicated Python Script for Cadastro Sync](adrs/adr-002.md)
- [ADR-003 SIA MySQL via XAMPP](../simpa/adrs/adr-003.md)

## Deliverables
- Working `sync_cadastros_mysql.py --dry-run` and `--pg-write`
- Pytest suite with mocked MySQL/PG
- `.env.example` entries for `CADASTRO_PERFIL_MAP`

## Tests
- Unit tests:
  - [x] Profile mapping maps known `tipouni` to APS/MAC/Hospitalar; unknown → default
  - [x] Upsert UPDATE excludes `enriquecimento` column
  - [x] Row in PG not in MySQL snapshot → `status=inativo`
  - [x] `--dry-run` returns counts without PG writes
  - [x] MySQL unavailable returns non-zero exit with error JSON
- Integration tests:
  - [x] `--pg-write` against test PG with fixture prestador rows inserts estabelecimentos
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Script completes typical municipal catalog in under 120 seconds
