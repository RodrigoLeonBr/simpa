# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Estender `sync_cadastros_mysql.py` para extrair `forma`/`cbo` do MySQL, normalizar e persistir em `formas_sia`/`cbos_sia` com contadores — concluída.

## Important Decisions

- Env keys seguem padrão SIA: `SIA_TABLE_FORMA`, `SIA_COL_FORMA_*`, `SIA_TABLE_CBO`, `SIA_COL_CBO_*`.
- Normalização: `_canonical_code` pad-left para 6 chars; forma deriva grupo/subgrupo de `codigo_forma` quando ausentes.
- Inativação de forma/cbo replica regra de procedimentos (skip snapshot vazio).
- `insert_sync_audit` ampliado com colunas `forma_*`/`cbo_*` da migration 009.

## Learnings

- Testes existentes precisam mock de `extrair_formas`/`extrair_cbos` após integração no pipeline.
- Fixture `cadastro_pg` deve aplicar `migration_009` para testes de integração forma/cbo.

## Files / Surfaces

- `sync_cadastros_mysql.py` (forma/cbo config, queries, normalização, UPSERT, sync, audit, payload JSON)
- `tests/test_sync_cadastros_mysql.py` (unit + integration novos; mocks/fixture atualizados)

## Errors / Corrections

- Nenhum.

## Ready for Next Run

- Task 03 (backend `cadastrosSync.js`) pode consumir blocos `formas`/`cbos` no payload JSON e colunas de audit já gravadas pelo sync.
