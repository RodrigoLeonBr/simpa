---
status: completed
title: Database migration 006 — de-para registry and import FKs
type: infra
complexity: medium
dependencies: []
---

# Task 01: Database migration 006 — de-para registry and import FKs

## Overview

Create `migration_006_import_depara.sql` with the `esus_import_mapeamentos` registry table and foreign-key columns on `esus_cargas` and `dados_consolidados`. Register the migration in Docker Compose and mirror changes in `schema_full.sql` so fresh environments match production schema.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `esus_import_mapeamentos` with partial unique indexes for unit-only and team mappings per TechSpec Data Models
- MUST add nullable `estabelecimento_id` and `equipe_id` to `esus_cargas` referencing `estabelecimentos` and `equipes`
- MUST add nullable `estabelecimento_id` and `equipe_id` to `dados_consolidados` with conditional unique index on `(competencia, estabelecimento_id, equipe_id)`
- MUST retain legacy UNIQUE constraints on text columns during MVP transition
- MUST mount migration in `docker-compose.yml` after migration 005
- MUST update `schema_full.sql` for greenfield installs
- SHOULD document manual apply command in migration header
</requirements>

## Subtasks
- [x] 01.1 Author `migration_006_import_depara.sql` with tables, FKs, and indexes
- [x] 01.2 Register migration in `docker-compose.yml` postgres init volume list
- [x] 01.3 Mirror schema changes in `schema_full.sql`
- [x] 01.4 Verify idempotency (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`)

## Implementation Details

See TechSpec **Data Models** and **Development Sequencing** step 1.

### Relevant Files
- `migration_005_estabelecimentos_perfil_enrichment.sql` — prior migration pattern
- `docker-compose.yml` — postgres init scripts mount order
- `schema_full.sql` — `esus_cargas`, `dados_consolidados` baseline
- `migration_004_cadastros_sync.sql` — `equipes.estabelecimento_id` reference

### Dependent Files
- `simpa-backend/src/services/importMappingService.js` — task_02
- `parse_esus_csv.py` — task_03
- `consolidate_dashboard.py` — task_04

### Related ADRs
- [ADR-002: Cadastro keys on import storage](adrs/adr-002.md)

## Deliverables
- `migration_006_import_depara.sql`
- Updated `docker-compose.yml` init mount
- Updated `schema_full.sql` sections for affected tables
- Migration verification tests **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] N/A — schema-only task
- Integration tests:
  - [x] After apply, table `esus_import_mapeamentos` exists with expected columns
  - [x] `esus_cargas` has `estabelecimento_id` and `equipe_id` nullable columns
  - [x] `dados_consolidados` has FK columns and partial unique index `uq_dados_consolidados_ids`
  - [x] Re-running migration file does not error (idempotent)
- Test coverage target: >=80% on verification script (e.g. `tests/test_migration_006.py`)
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on verification artifacts
- Migration applies on empty and existing databases
- Docker fresh `docker compose up` includes migration 006
