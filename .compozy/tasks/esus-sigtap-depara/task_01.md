---
status: completed
title: Add procedimentos and esus_procedimento_map DDL
type: infra
complexity: low
dependencies: []
---

# Task 01: Add procedimentos and esus_procedimento_map DDL

## Overview

Add the dual-table PostgreSQL schema for SIGTAP master procedures and e-SUS label mappings so later seed, CRUD, export, and consolidator work have a durable store. This is the foundation of the de-para feature and must match Cadastros soft-delete conventions already used by `unidades_saude` / `equipes`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST create table `procedimentos` with fields defined in TechSpec Data Models (`codigo_sigtap` unique, `descricao`, `tipo`, `tabela_referencia` default SIGTAP, `status` default ativo, timestamps).
2. MUST create table `esus_procedimento_map` with `secao`, `descricao_esus`, `procedimento_id` FK, `origem`, `status`, and UNIQUE `(secao, descricao_esus)`.
3. MUST soft-delete via `status` (ativo/inativo), not physical DELETE columns.
4. MUST add DDL to `schema_full.sql` (or additive migration applied with it) so fresh installs include the tables.
5. SHOULD add an index on `esus_procedimento_map(status)` for list filters.
6. MUST be idempotent where practical (`CREATE TABLE IF NOT EXISTS`).
</requirements>

## Subtasks
- [x] 1.1 Add `procedimentos` DDL aligned with TechSpec Data Models
- [x] 1.2 Add `esus_procedimento_map` DDL with FK and unique constraint
- [x] 1.3 Document table placement in schema relative to existing cadastros/SIA tables
- [x] 1.4 Apply DDL to a local Postgres and verify tables/constraints exist
- [x] 1.5 Record a minimal SQL smoke check script or documented verification steps as test evidence

## Implementation Details

See TechSpec sections **Data Models** and **Development Sequencing** step 1. Mirror soft-delete and naming patterns from existing cadastro tables in `schema_full.sql`.

**Note (workspace):** live PG already had a richer `procedimentos` from MySQL sync (extra columns). Task kept that table; added `atualizado_em` if missing and created `esus_procedimento_map`. Fresh installs get TechSpec-shaped `procedimentos` from `schema_full.sql` §5b.

### Relevant Files
- `schema_full.sql` — existing schema; add new tables here
- `estrutura_simpa.md` — planned `procedimentos` master concept
- `tests/sql/smoke_esus_procedimento_ddl.sql` — smoke assertions

### Dependent Files
- `seed_esus_sigtap_depara.sql` (task_02) — requires these tables
- `simpa-backend/src/routes/cadastros.js` (task_03) — CRUD against these tables

### Related ADRs
- [ADR-002: Dual-table persistence](adrs/adr-002.md) — table split and soft-delete

## Deliverables
- Updated `schema_full.sql` (or companion migration) with both tables
- Verified constraints: unique `codigo_sigtap`, unique `(secao, descricao_esus)`, FK to `procedimentos`
- Unit/integration-style SQL checks documenting table creation **(REQUIRED)**
- Test coverage target >=80% for any helper scripts introduced **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Applying DDL twice does not fail when using IF NOT EXISTS (or documented one-shot apply)
  - [x] `procedimentos.codigo_sigtap` rejects duplicate insert
  - [x] `esus_procedimento_map` rejects duplicate `(secao, descricao_esus)`
- Integration tests:
  - [x] Fresh database apply creates both tables with expected columns
  - [x] Insert map row with invalid `procedimento_id` fails FK
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Both tables exist in local PG after applying schema
- TechSpec Data Models fields are present with correct defaults
