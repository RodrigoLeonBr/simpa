---
status: completed
title: "Database migration 005 and enrichment backfill"
type: infra
complexity: medium
dependencies: []
---

# Task 01: Database migration 005 and enrichment backfill

## Overview

Add the `perfil_editado` column and five normalized enrichment tables required by ADR-002 and ADR-003. Wire the migration into Docker Postgres init so fresh and upgraded environments apply schema consistently, and backfill legacy JSONB hospital enrichment into the new tables.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `migration_005_estabelecimentos_perfil_enrichment.sql` with `perfil_editado` and tables `enriquecimento_{aps,mac,hospitalar,misto,outro}` per TechSpec Data Models section
- MUST backfill existing `estabelecimentos.enriquecimento` JSONB into `enriquecimento_hospitalar` for `perfil IN ('Hospitalar','Misto')` where JSONB is non-empty
- MUST mount migration 005 in `docker-compose.yml` after migration 004
- MUST leave legacy `enriquecimento` JSONB column in place (read-only after app deploy)
- SHOULD document manual apply command for non-Docker Postgres in migration file header
</requirements>

## Subtasks
- [x] 01.1 Author migration SQL with all tables, FKs, and backfill INSERT…SELECT from JSONB
- [x] 01.2 Register migration in Docker Compose postgres init volume list
- [x] 01.3 Verify migration is idempotent (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`)
- [x] 01.4 Apply migration locally against existing `pgdata` volume and confirm schema

## Implementation Details

See TechSpec **Data Models** and **Development Sequencing** step 1. No application code changes in this task.

### Relevant Files
- `migration_004_cadastros_sync.sql` — prior estabelecimentos schema reference
- `docker-compose.yml` — postgres init scripts mount order
- `schema_full.sql` — optional consistency check only

### Dependent Files
- `sync_cadastros_mysql.py` — will use `perfil_editado` in task_02
- `simpa-backend/src/services/estabelecimentosService.js` — will query new tables in task_03

### Related ADRs
- [ADR-002: Preserve Manual Perfil via perfil_editado Flag](adrs/adr-002.md)
- [ADR-003: Profile-Specific Enrichment in Four Physical Tables](adrs/adr-003.md)

## Deliverables
- `migration_005_estabelecimentos_perfil_enrichment.sql`
- Updated `docker-compose.yml` init mount for migration 005
- Integration tests with 80%+ coverage **(REQUIRED)** — SQL smoke script or pytest that asserts tables/column exist after migration apply

## Tests
- Unit tests:
  - [x] N/A — schema-only task; use integration verification below
- Integration tests:
  - [x] After applying migration on test DB, `\d estabelecimentos` shows `perfil_editado BOOLEAN NOT NULL DEFAULT false`
  - [x] All five `enriquecimento_*` tables exist with expected PK on `estabelecimento_id`
  - [x] Backfill: seed row with JSONB `{"leitos":{"clinico":10}}` and `perfil='Hospitalar'` results in matching `enriquecimento_hospitalar.leitos`
  - [x] Re-running migration file does not error (idempotent)
- Test coverage target: >=80% on any migration verification script added
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on verification artifacts
- Migration applies cleanly on empty and existing databases
- Docker fresh `docker compose up` includes migration 005 automatically
