---
status: completed
title: Dashboard painel-layout runtime endpoint
type: backend
complexity: low
dependencies:
  - task_03
---

# Task 05: Dashboard painel-layout runtime endpoint

## Overview

Expose `GET /api/v1/dashboard/painel-layout` as the Painel runtime API, wiring JWT auth and filter query params to `resolvePainelLayout`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add route to `simpa-backend/src/routes/dashboard.js`
- MUST require JWT (inherits from `/api` mount)
- MUST validate `competencia` required YYYY-MM; default `perfil=APS`, `layout=A`
- MUST accept optional `estabelecimento_id`, `equipe_id` query params as integers
- MUST return 200 with `PainelLayoutResponse` JSON on success
- MUST return 400 for invalid competencia; 404 when no active widgets for scope
- MUST NOT modify existing `/planejamento` handler
</requirements>

## Subtasks
- [x] 05.1 Add GET handler calling `resolvePainelLayout`
- [x] 05.2 Map service errors to HTTP status codes
- [x] 05.3 Supertest route tests with mocked service
- [x] 05.4 Document endpoint in `docs/agent/backend-api.md` (or defer snippet to task_18)

## Implementation Details

See TechSpec **API Endpoints → Runtime** and ADR-002. Follow thin route pattern in existing `dashboard.js`.

### Relevant Files
- `simpa-backend/src/routes/dashboard.js`
- `simpa-backend/src/routes/api.js` — mount prefix
- `simpa-backend/tests/dashboardService.test.js` — supertest patterns

### Dependent Files
- `simpa-frontend/src/api/painelWidgets.ts` — task_08

### Related ADRs
- [ADR-002: Dedicated Painel Layout Endpoint](../adrs/adr-002.md)

## Deliverables
- Updated `dashboard.js` with `/painel-layout` route
- `simpa-backend/tests/painelLayoutRoute.test.js` **(REQUIRED)**

## Tests
- Unit tests:
  - [x] GET without competencia returns 400
  - [x] GET with valid params returns 200 and `{ widgets: [] }` when service mocks empty
  - [x] Invalid `estabelecimento_id=abc` returns 400
- Integration tests:
  - [ ] Supertest with mocked JWT middleware and service
- Test coverage target: >=80% on new route handler
- All tests must pass

## Success Criteria
- [x] All tests passing
- [ ] `curl` with JWT returns JSON widgets array for APS/A seed
