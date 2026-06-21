# Workflow Memory

Durable cross-task context only. Workflow **arquivado** em 2026-06-20.

## Current State

- Entrega completa: tasks 01–10, review round 001 (8 issues resolvidos), commit `be60db2`.
- Migration 006: `esus_import_mapeamentos`, FKs em `esus_cargas` / `dados_consolidados`, índice parcial `uq_dados_consolidados_ids`.
- Docker init: `migration_006_import_depara.sql` após 005; `schema_full.sql` espelha colunas FK.

## Shared Decisions

- FKs via blocos DO idempotentes (não `ADD COLUMN REFERENCES` inline) — compatível com `schema_full.sql` greenfield.
- Painel: query por `estabelecimento_id` (+ `equipe_id` opcional); fallback legado por nome cadastro quando miss por ID.
- Preview gate: `pending` bloqueia Process; equipe auto-creatable com `esusEquipeCodigo` → status `resolved`.

## Shared Learnings

- Fixtures de integração não reexecutam `schema_full.sql` em DB Docker existente — migration 006 obrigatória.
- `consolidate_dashboard.fetch_groups`: params do UNION = `id_params + legacy_params` (não intercalados).
- Testes CLI MySQL: usar `mysql_available()` — passam com XAMPP up ou down.

## Open Risks

- UNIQUE legado `(competencia, unidade, equipe)` mantido até backfill Phase 2; dual uniqueness na transição MVP.

## Handoffs

- Spec arquivada: `.compozy/tasks/_archived/1781996141048-c9181226-importacao-depara-unidade-equipe/`.
- Docs agent: `cadastros.md#workflow-importacao-depara`, `backend-api.md`, `frontend.md#importacao`, `database.md`.
- Não executar `compozy tasks run` neste slug — usar spec arquivada como referência.
