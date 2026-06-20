# Task 10 — Memory (completed)

## Objective Snapshot

Remove deprecated backend routes, frontend dead code, compat shims. Full verification pipeline. Mark task_16 superseded.

## Important Decisions

- Removed `DEPRECATED_ENTITIES` and 410 handlers entirely — legacy paths now 404 via Express.
- Kept `_deprecated_*` PG tables (TechSpec: one release); added `scripts/verify_deprecated_cadastros_fk.sql` for pre-drop verification.
- Health probe updated from `unidades_saude` to `estabelecimentos`.
- Mock `db.json`: removed `prestadores_mac` and `hospitais`; kept `unidades` for dashboard test fixtures.

## Learnings

- Sync→list integration test already existed in `cadastrosSync.routes.test.js`; merged deprecated 404 tests into `cadastros.test.js`.
- Deleted redundant `cadastros.deprecated.routes.test.js`.

## Files / Surfaces

**Backend:**
- `cadastroRegistry.js` — removed DEPRECATED_ENTITIES
- `routes/cadastros.js` — removed deprecated handlers
- `routes/health.js` — estabelecimentos probe
- `tests/cadastros.test.js` — legacy 404 tests
- `tests/integration/cadastros.integration.test.js` — legacy 404 integration test
- `scripts/verify_deprecated_cadastros_fk.sql` — new

**Frontend:**
- `navigation.test.ts` — estabelecimentos sub-route
- `mock/db.json` — removed legacy entity arrays

**Tracking:**
- `simpa/task_16.md` — superseded note
- `simpa/_tasks.md` — task_16 status superseded
- `simpa/task_18.md` — E2E cadastros route clarified

## Errors / Corrections

- None.

## Verification

- Backend Jest: 196 passed
- Frontend Vitest: 137 passed, coverage ≥80% (94% lines)
- Pytest sync_cadastros: 14 passed
