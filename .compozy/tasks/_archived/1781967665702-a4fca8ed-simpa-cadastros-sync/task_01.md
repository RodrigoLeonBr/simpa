---
status: completed
title: PostgreSQL migration 004 (estabelecimentos schema)
type: infra
complexity: medium
dependencies: []
---

# Task 01: PostgreSQL migration 004 (estabelecimentos schema)

## Overview

Add PostgreSQL schema for unified establishments mirror and cadastro sync audit log. Extends `procedimentos` with MySQL mirror columns and prepares FK columns on `equipes` and `metas_financiamento`. Foundation for all sync and API work.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `estabelecimentos` table per TechSpec Data Models section
- MUST create `cadastros_sincronizacoes` audit table
- MUST add mirror columns to `procedimentos` (`pa_total`, `rubrica`, `pa_id`, `financiamento`, `sincronizado_em`, `fonte`)
- MUST add nullable `estabelecimento_id` FK columns on `equipes` and `metas_financiamento`
- MUST apply migration on Docker postgres init alongside existing migrations 002/003
- SHOULD include indexes on `estabelecimentos(perfil, status)` and `estabelecimentos(codigo_externo)`
</requirements>

## Subtasks
- [x] 1.1 Author `migration_004_cadastros_sync.sql` with tables and ALTER statements
- [x] 1.2 Wire migration into postgres init / compose startup sequence
- [x] 1.3 Verify fresh `docker compose up` applies schema without errors
- [x] 1.4 Document new tables in schema comments

## Implementation Details

See TechSpec **Data Models** and **Development Sequencing** step 1.

### Relevant Files
- `migration_004_cadastros_sync.sql` — create
- `migration_003_cadastros_fase2.sql` — reference existing cadastro tables
- `schema_full.sql` — align comments if project convention requires
- `docker-compose.yml` — confirm init mount includes new migration

### Dependent Files
- `sync_cadastros_mysql.py` — depends on this schema (task_02)
- `simpa-backend/src/services/cadastroRegistry.js` — will query new tables (task_05)

### Related ADRs
- [ADR-003: Single estabelecimentos Table with JSONB Enrichment](adrs/adr-003.md)

## Deliverables
- `migration_004_cadastros_sync.sql` applied on clean DB
- Init script order documented
- Smoke verification script or test that asserts tables exist

## Tests
- Unit tests:
  - [x] SQL file parses without syntax errors against PostgreSQL 15+
  - [x] Idempotent `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` where applicable
- Integration tests:
  - [x] Fresh postgres container init creates `estabelecimentos` and `cadastros_sincronizacoes`
  - [x] `equipes.estabelecimento_id` FK references `estabelecimentos(id)`
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Migration applies on empty and existing dev databases without manual steps
