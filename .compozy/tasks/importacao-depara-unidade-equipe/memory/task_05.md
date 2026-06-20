# Task Memory: task_05.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- Extended `dashboardService.js` + `routes/dashboard.js` for ID-based `GET /planejamento`; 21 Jest tests; 100% stmt / 83% branch on `dashboardService.js`.

## Important Decisions

- `buildDashboardQuery`: when both IDs present, WHERE uses FK only (no text fallback); SELECT always returns ID columns.
- Partial ID query → 400 "devem ser informados juntos".
- 404 miss with IDs logs `dashboard.miss` via `logDashboardMiss`.
- `docs/agent/backend-api.md` deferred to task_10 per spec.

## Learnings

- Test for legacy path must assert WHERE clause, not full SQL — SELECT includes `estabelecimento_id`/`equipe_id` in both paths.

## Files / Surfaces

- `simpa-backend/src/services/dashboardService.js`
- `simpa-backend/src/routes/dashboard.js`
- `simpa-backend/tests/dashboardService.test.js`
- `simpa-backend/tests/dashboard.test.js`

## Errors / Corrections

- Fixed `dashboardService.test.js` legacy fallback assertion: check WHERE segment, not entire SQL.

## Ready for Next Run

- task_06: import routes trigger consolidation with IDs; preview/upload/mapeamentos CRUD.
- task_09: frontend `useDashboard` / `dashboard.ts` pass `estabelecimento_id` + `equipe_id`.
