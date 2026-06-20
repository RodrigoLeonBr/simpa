---
status: pending
title: Backend Express foundation
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 03: Backend Express foundation

## Overview

Create the `simpa-backend/` Node.js Express application with PostgreSQL pool, global error handler, CORS, and health endpoint. This is the shell onto which all API routes attach.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create Express app per Plano B structure (`src/app.js`, `services/db.js`)
- MUST expose `GET /api/health` with postgres connectivity check
- MUST load configuration from shared root `.env`
- MUST use CommonJS modules matching Plano B conventions
- SHOULD log structured fields: requestId, durationMs
</requirements>

## Subtasks
- [ ] 3.1 Initialize npm project and install express, pg, dotenv, cors
- [ ] 3.2 Implement pg Pool singleton and query helper
- [ ] 3.3 Wire middleware stack and error handler
- [ ] 3.4 Add health route with PG ping

## Implementation Details

See Plano B Task 1–3 and TechSpec **Component Overview** (api service).

### Relevant Files
- `simpa-backend/src/app.js` — create
- `simpa-backend/src/services/db.js` — create
- `simpa-backend/src/middleware/errorHandler.js` — create

### Dependent Files
- `docker-compose.yml` — api service entrypoint

### Related ADRs
- [ADR-002: Spec-Driven Stack](../adrs/adr-002.md)

## Deliverables
- Running API on port 3001 inside Docker
- Health endpoint returning PG status
- Jest smoke test for health route

## Tests
- Unit tests:
  - [ ] db.query mocked — health returns 200 when PG ok
  - [ ] health returns 503 when PG unreachable
- Integration tests:
  - [ ] supertest GET /api/health against test container
- Test coverage target: >=80% on services/middleware
- All tests must pass

## Success Criteria
- All tests passing
- `curl localhost:3001/api/health` returns JSON with postgres status
