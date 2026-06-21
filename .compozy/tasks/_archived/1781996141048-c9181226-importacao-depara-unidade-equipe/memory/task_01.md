# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- Delivered migration 006, docker-compose mount, schema_full mirror, and `tests/test_migration_006.py`.

## Important Decisions

- Migration uses separate DO blocks for FK constraints after bare `ADD COLUMN IF NOT EXISTS` (compatible with schema_full pre-declaring columns without FKs).

## Learnings

- `depara_pg` fixture follows migration_005 pattern: apply 004+005 idempotently on live DB, not full schema_full replay.

## Files / Surfaces

- `migration_006_import_depara.sql` (new)
- `docker-compose.yml`
- `schema_full.sql` (`esus_cargas`, `dados_consolidados`)
- `tests/test_migration_006.py` (new)

## Errors / Corrections

- Initial fixture ran `schema_full.sql` on existing DB → `UndefinedColumn` on index creation; fixed by removing schema_full from fixture.

## Ready for Next Run

- task_02: `importMappingService.js` against `esus_import_mapeamentos`.
