---
status: completed
title: "Database migration: populacao_cadastrada"
type: infra
complexity: low
dependencies: []
---

# Task 01: Database migration: populacao_cadastrada

## Overview

Creates `migration_012_populacao_cadastrada.sql` — a new table `populacao_cadastrada` for structured population snapshots and an updated `esus_cargas` CHECK constraint that accepts `cadastro_individual` as a valid `tipo_relatorio`. Also synchronizes `schema_full.sql` and `docker-compose.yml` to reflect the new schema. This is the foundation that all other tasks in this feature depend on.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC "Data Models" section for the exact DDL — do not invent columns
- FOCUS ON "WHAT" — the schema to create, not implementation choices (already decided in ADR-001)
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST create `migration_012_populacao_cadastrada.sql` in the project root following the naming convention of existing migrations (migration_012_populacao_cadastrada.sql).
2. MUST alter `esus_cargas.tipo_relatorio` CHECK to add `'cadastro_individual'` to the allowed values list — preserving all 6 existing values.
3. MUST create table `populacao_cadastrada` with columns: id, carga_id (FK → esus_cargas ON DELETE CASCADE), estabelecimento_id (FK → estabelecimentos), competencia (DATE), cidadaos_ativos (INT), saidas (INT), sexo_masculino (INT nullable), sexo_feminino (INT nullable), faixa_etaria (JSONB DEFAULT '[]'), condicoes_saude (JSONB DEFAULT '{}'), raca_cor (JSONB DEFAULT '{}'), sociodemografico (JSONB DEFAULT '{}'), extras (JSONB DEFAULT '{}'), importado_em (TIMESTAMP DEFAULT now()).
4. MUST add UNIQUE constraints: `(carga_id)` and `(competencia, estabelecimento_id)`.
5. MUST add indexes: `idx_pop_cad_competencia ON (competencia, estabelecimento_id)` and GIN index `idx_pop_cad_condicoes_gin ON (condicoes_saude)`.
6. MUST update `schema_full.sql` to reflect the same changes (reference for fresh installs).
7. MUST add migration_012 volume mount to `docker-compose.yml` following the existing `NN-migration_NNN_<name>.sql` pattern (next ordinal: 12).
8. MUST be idempotent — use `IF NOT EXISTS` and `DROP CONSTRAINT IF EXISTS` guards.
</requirements>

## Subtasks

- [x] 1.1 Write `migration_012_populacao_cadastrada.sql`: DROP/ADD CHECK on `esus_cargas`, CREATE TABLE `populacao_cadastrada` with all constraints and indexes.
- [x] 1.2 Update `schema_full.sql`: apply the same CHECK alteration and add `populacao_cadastrada` DDL block (after `esus_indicadores_raw` block).
- [x] 1.3 Add the migration_012 volume line to `docker-compose.yml` postgres init block.
- [x] 1.4 Apply migration manually to local dev DB (via Docker exec) and verified `\d populacao_cadastrada` output.
- [x] 1.5 All 490 backend tests pass; DB smoke tests via psql confirmed all constraints and indexes.

## Implementation Details

See TechSpec "Data Models — migration_012_populacao_cadastrada.sql" section for exact DDL. The `docker-compose.yml` init block uses this pattern:

```
- ./migration_012_populacao_cadastrada.sql:/docker-entrypoint-initdb.d/12-migration_012_populacao_cadastrada.sql:ro
```

The CHECK constraint alter pattern: `DROP CONSTRAINT IF EXISTS esus_cargas_tipo_relatorio_check` then `ADD CONSTRAINT esus_cargas_tipo_relatorio_check CHECK (tipo_relatorio IN (..., 'cadastro_individual'))`.

### Relevant Files

- `migration_011_rubricas_sia.sql` — previous migration (reference for format and style)
- `schema_full.sql` — reference schema to keep in sync
- `docker-compose.yml` — postgres init volumes block (lines ~20-35)

### Dependent Files

- `parse_esus_csv.py` — task_02 writes to `populacao_cadastrada`; needs table to exist
- `consolidate_dashboard.py` — task_04 queries `populacao_cadastrada`
- `simpa-backend/src/services/populacaoService.js` — task_05 queries `populacao_cadastrada`

### Related ADRs

- [ADR-001: Dedicated Population Table for Cadastro Individual Data](../adrs/adr-001.md) — Justifies this table over EAV reuse

## Deliverables

- `migration_012_populacao_cadastrada.sql` (project root)
- Updated `schema_full.sql`
- Updated `docker-compose.yml`
- Smoke test asserting table + columns exist
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for schema correctness **(REQUIRED)**

## Tests

- Unit tests:
  - [ ] Migration SQL is valid (no syntax errors) — run `psql --set ON_ERROR_STOP=1 -f migration_012...sql` against test DB; expect exit 0
  - [ ] `populacao_cadastrada` table exists after migration with columns: id, carga_id, estabelecimento_id, competencia, cidadaos_ativos, saidas, faixa_etaria, condicoes_saude, raca_cor, sociodemografico, extras, importado_em
  - [ ] `esus_cargas` INSERT with `tipo_relatorio = 'cadastro_individual'` succeeds (no constraint violation)
  - [ ] `esus_cargas` INSERT with `tipo_relatorio = 'unknown_type'` fails with CHECK violation
  - [ ] UNIQUE constraint `(competencia, estabelecimento_id)` rejects duplicate row
  - [ ] ON DELETE CASCADE: deleting an `esus_cargas` row removes the linked `populacao_cadastrada` row
- Integration tests:
  - [ ] Fresh Docker Compose `up --build` with migration_012 in init sequence completes without errors
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `psql -c "\d populacao_cadastrada"` shows all expected columns and constraints
- `esus_cargas` accepts `tipo_relatorio = 'cadastro_individual'` without error
- `docker-compose up --build` completes cleanly with migration_012 applied
