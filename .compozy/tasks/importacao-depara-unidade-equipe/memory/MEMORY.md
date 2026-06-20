# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- Migration 006 applied: `esus_import_mapeamentos`, FK columns on `esus_cargas` / `dados_consolidados`, partial unique `uq_dados_consolidados_ids`.
- Docker init mounts migration 006 after 005; `schema_full.sql` mirrors FK columns and indexes on affected tables.

## Shared Decisions

- FK constraints on `esus_cargas` / `dados_consolidados` added via idempotent DO blocks (not inline `ADD COLUMN REFERENCES`) so `schema_full.sql` can pre-declare bare BIGINT columns without breaking migration on greenfield.

## Shared Learnings

- Integration test fixtures must not re-run `schema_full.sql` on existing Docker DBs — tables exist without new columns until migration runs; indexes in updated `schema_full.sql` fail on old table shape.

## Open Risks

- Legacy UNIQUE on text columns `(competencia, unidade, equipe)` retained until Phase 2 backfill; dual uniqueness during MVP transition.

## Handoffs

- task_02+ can assume `esus_import_mapeamentos` registry and nullable FK columns exist; enforce NOT NULL on new writes in application layer.
- Feature **importacao-depara-unidade-equipe** concluída (tasks 01–10); docs em `docs/agent/` + workflow em `cadastros.md#workflow-importacao-depara`.
