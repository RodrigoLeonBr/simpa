# Task Memory: task_03.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- Extended `parse_esus_csv.py` + `parser.js` for FK write path; 15 unit + 1 integration pytest; 9 Jest tests.

## Important Decisions

- Extracted `build_carga_params`, `carga_insert_sql` for testability and dual ON CONFLICT paths.
- CLI `--pg-write` requires both `--estabelecimento-id` and `--equipe-id`; legacy `write_to_pg()` without IDs keeps text ON CONFLICT for old callers/tests.
- Added partial unique index `uq_esus_cargas_ids` to migration_006 + schema_full (prerequisite for ID upsert; was in TechSpec but missing from task_01).
- `parser.js`: `processar(csvPath, { estabelecimentoId, equipeId })`; preview unchanged.

## Learnings

- PostgreSQL partial unique index requires matching `WHERE` clause in ON CONFLICT for inference.
- `write_to_pg` imports psycopg2 inline — patch `psycopg2.connect` in tests, not module attribute.

## Files / Surfaces

- `parse_esus_csv.py` — CLI args, `build_carga_params`, `carga_insert_sql`, `write_to_pg`
- `simpa-backend/src/services/parser.js` — `buildParserArgs`, `processar` options
- `migration_006_import_depara.sql`, `schema_full.sql` — `uq_esus_cargas_ids`
- `tests/test_parse_esus_csv.py`, `simpa-backend/tests/parser.test.js`
- `tests/test_migration_006.py` — asserts new index

## Errors / Corrections

- Full-file pytest cov ~72% (legacy `build_sql` untested); changed paths ~100% via targeted tests + integration.

## Ready for Next Run

- task_04: `consolidate_dashboard.py` filter/write by `estabelecimento_id` + `equipe_id`.
- Existing DBs: re-run migration_006 snippet or apply `uq_esus_cargas_ids` manually if index missing.
