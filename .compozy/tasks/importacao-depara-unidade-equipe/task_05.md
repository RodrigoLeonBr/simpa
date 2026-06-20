---
status: completed
title: Dashboard API — query dados_consolidados by establishment/team IDs
type: backend
complexity: medium
dependencies:
  - task_04
---

# Task 05: Dashboard API — query dados_consolidados by establishment/team IDs

## Overview

Update `dashboardService.js` and `routes/dashboard.js` to accept optional `estabelecimento_id` and `equipe_id` query parameters, preferring ID match over legacy name strings. Update frontend API in task_09 to consume this contract.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST extend `buildDashboardQuery` to filter by `estabelecimento_id` and `equipe_id` when provided
- MUST retain fallback to `unidade`/`equipe` text params for legacy rows without IDs
- MUST return 404 with filtros payload when no row matches ID query
- MUST update `GET /api/v1/dashboard/planejamento` route to pass new query params
- MUST add Jest tests for ID query path and legacy name fallback
- SHOULD log `dashboard.miss` when ID query returns empty (TechSpec Monitoring)
</requirements>

## Subtasks
- [x] 05.1 Extend `dashboardService.buildDashboardQuery` and `fetchDashboard`
- [x] 05.2 Update `routes/dashboard.js` query param parsing
- [x] 05.3 Add/update `simpa-backend/tests/dashboard.test.js` cases
- [ ] 05.4 Update `docs/agent/backend-api.md` endpoint table (deferred to task_10)

## Implementation Details

See TechSpec **API Endpoints — Dashboard** and **Impact Analysis** dashboardService row.

### Relevant Files
- `simpa-backend/src/services/dashboardService.js`
- `simpa-backend/src/routes/dashboard.js`
- `simpa-frontend/src/hooks/useDashboard.ts` — consumer in task_09
- `simpa-backend/tests/dashboard.test.js` (create if missing)

### Dependent Files
- `simpa-frontend/src/api/dashboard.ts` — task_09

### Related ADRs
- [ADR-002: Cadastro keys on import storage](adrs/adr-002.md)

## Deliverables
- Updated dashboard service and route
- Jest unit tests with 80%+ coverage on changed functions **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Query with `estabelecimento_id=42&equipe_id=7` generates SQL filtering by IDs
  - [x] Query with only `unidade` text still works (legacy fallback)
  - [x] Missing consolidated row returns status 404 with filtros including IDs
  - [x] Invalid competencia still returns 400
- Integration tests:
  - [ ] N/A — task_06 covers import→dashboard path
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on dashboardService changes
- Panel can load data when frontend passes establishment ID matching consolidated row
