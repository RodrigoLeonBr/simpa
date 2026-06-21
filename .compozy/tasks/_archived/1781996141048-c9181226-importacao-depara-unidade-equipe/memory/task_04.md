# Task Memory: task_04.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- Extended `consolidate_dashboard.py` + `consolidator.js` for ID-based fetch/write; 17 unit + 1 integration pytest; 7 Jest tests.

## Important Decisions

- `ConsolidationGroup` NamedTuple carries optional `estabelecimento_id`/`equipe_id` through main loop.
- `fetch_groups` UNION: ID-based JOIN path + legacy NULL-ID text path for `--all`.
- `fetch_raw_rows`: FK filter without Todas fallback when IDs provided; legacy keeps text + Todas.
- `write_payload_sql` dual ON CONFLICT (ID partial unique vs text legacy).
- `consolidate_group` resolves display names via `fetch_cadastro_labels` when IDs set.
- CLI: `--competencia` + IDs OR text triple OR `--all`; mutual exclusion enforced.

## Learnings

- `build_payload` exposes unidade/equipe under `filtros_ativos`, not root keys.
- `fetch_groups` filter params duplicated per UNION branch: [id_params..., legacy_params...].

## Files / Surfaces

- `consolidate_dashboard.py`
- `simpa-backend/src/services/consolidator.js`
- `tests/test_consolidate.py`
- `simpa-backend/tests/consolidator.test.js`
- `tests/test_coverage.py` (fetch_raw_rows keyword args)

## Errors / Corrections

- Fixed `test_coverage.py` for new `fetch_raw_rows` signature.

## Ready for Next Run

- task_05: `dashboardService.js` query by `estabelecimento_id`/`equipe_id`.
- task_06: `runConsolidation({ estabelecimentoId, equipeId })` from import routes.
