---
status: completed
title: Backend cadastro sync API (subprocess + routes)
type: backend
complexity: medium
dependencies:
  - task_02
---

# Task 04: Backend cadastro sync API (subprocess + routes)

## Overview

Expose manual cadastro sync to the frontend by spawning `sync_cadastros_mysql.py` from Express, mirroring the existing SIA sync service pattern. Includes sync history read endpoints and audit log entry.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement `POST /api/cadastros/sincronizar` spawning script with `--pg-write`
- MUST implement `GET /api/cadastros/sincronizacoes` and `GET /api/cadastros/sincronizacoes/ultima`
- MUST parse subprocess JSON stdout into API response (TechSpec Core Interfaces)
- MUST return HTTP 502 on non-zero script exit with stderr snippet
- MUST write `audit_log` entry `acao=cadastros_sincronizar` on success
- MUST protect all routes with existing JWT middleware
</requirements>

## Subtasks
- [x] 4.1 Create `cadastrosSync.js` service (mirror `sia.js` spawn pattern)
- [x] 4.2 Add sync routes to cadastros router
- [x] 4.3 Add sync history query service against `cadastros_sincronizacoes`
- [x] 4.4 Add supertest tests with mocked subprocess

## Implementation Details

See TechSpec **API Endpoints** — Cadastro sync; mirror `simpa-backend/src/services/sia.js`.

### Relevant Files
- `simpa-backend/src/services/cadastrosSync.js` — create
- `simpa-backend/src/routes/cadastros.js` — add sync routes
- `simpa-backend/src/services/sia.js` — spawn pattern reference
- `simpa-backend/tests/cadastrosSync.test.js` — create

### Dependent Files
- `simpa-frontend/src/api/cadastros.ts` — will call sync endpoint (task_07)

### Related ADRs
- [ADR-002: Dedicated Python Script](adrs/adr-002.md)

## Deliverables
- Sync API endpoints functional with mocked Python in tests
- `.env.example` `CADASTRO_SYNC_SCRIPT` override optional

## Tests
- Unit tests:
  - [x] `parseSyncOutput` handles single object and empty stdout error
  - [x] Non-zero exit code maps to 502 with message
- Integration tests:
  - [x] `POST /api/cadastros/sincronizar` with mocked spawn returns 200 + counts
  - [x] Unauthenticated request returns 401
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Manual curl with running API triggers script and returns JSON summary
