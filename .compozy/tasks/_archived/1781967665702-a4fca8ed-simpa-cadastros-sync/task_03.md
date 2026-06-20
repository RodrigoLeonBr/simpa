---
status: completed
title: Legacy cadastro data migration script
type: infra
complexity: medium
dependencies:
  - task_01
---

# Task 03: Legacy cadastro data migration script

## Overview

One-time migration from deprecated PostgreSQL tables (`unidades_saude`, `prestadores_mac`, `hospitais`) to `estabelecimentos` FK model. Maps existing `equipes.unidade_id` to `estabelecimento_id` after MySQL-authoritative sync populates establishments.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST provide SQL or Python migration script runnable after first cadastro sync
- MUST map `equipes.unidade_id` → `estabelecimento_id` by matching `unidades_saude.codigo` or `cnes` to `estabelecimentos.codigo_externo`
- MUST map `metas_financiamento.unidade_id` → `estabelecimento_id` with same logic
- MUST produce migration report listing unmatched equipes rows
- MUST rename legacy tables to `_deprecated_unidades_saude` etc. (not hard drop in MVP)
- MUST NOT insert legacy-only rows into estabelecimentos without MySQL match
</requirements>

## Subtasks
- [x] 3.1 Author `scripts/migrate_cadastros_legacy.sql` with FK backfill
- [x] 3.2 Add verification queries for orphan equipes
- [x] 3.3 Document run order: task_01 schema → task_02 sync → this script
- [x] 3.4 Test against seed data from `schema_full.sql` / migration 003

## Implementation Details

See TechSpec **Data Models** — One-time migration from legacy tables.

### Relevant Files
- `scripts/migrate_cadastros_legacy.sql` — create
- `migration_003_cadastros_fase2.sql` — legacy table shapes
- `schema_full.sql` — `unidades_saude`, `equipes` seed reference

### Dependent Files
- `simpa-backend/src/services/cadastroRegistry.js` — equipes queries switch to `estabelecimento_id` (task_06)

### Related ADRs
- [ADR-003: Single estabelecimentos Table](adrs/adr-003.md)

## Deliverables
- Runnable migration script with README comment block
- Verification SQL for zero orphan active equipes after migration
- Migration report query (unmatched counts)

## Tests
- Unit tests:
  - [x] Match logic: codigo exact match maps equipe to estabelecimento
  - [x] No match leaves `estabelecimento_id` NULL and appears in report
- Integration tests:
  - [x] Seed unidades + equipes + estabelecimentos; run script; equipes FK populated
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- All active equipes in dev seed have valid `estabelecimento_id` or documented exception
