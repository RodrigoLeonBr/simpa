---
status: pending
title: Production nginx + Playwright E2E + CI
type: infra
complexity: high
dependencies:
  - task_03
  - task_04
  - task_05
  - task_06
  - task_07
  - task_08
  - task_10
  - task_11
  - task_12
  - task_13
  - task_14
  - task_15
  - task_16
  - task_17
---

# Task 18: Production nginx + Playwright E2E + CI

## Overview

Finalize production deployment: nginx serves React build and proxies API, swap frontend from json-server to real API, implement Playwright E2E suite for critical flows, and add CI pipeline running Python pytest, Jest/supertest, and Playwright.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST configure nginx.conf: static dist/, proxy /api and /auth to api:3001
- MUST set VITE_API_BASE for production build (relative or same-origin)
- MUST implement Playwright E2E: login → painel → filters → import → cadastros → dark mode → logout
- MUST add GitHub Actions workflow (or local ci.sh) running all three test layers
- MUST add data-testid attributes on critical UI elements for stable E2E
- MUST document production deploy steps in readme
</requirements>

## Subtasks
- [ ] 18.1 Finalize nginx + docker-compose prod profile
- [ ] 18.2 Frontend production build integrated in web container
- [ ] 18.3 Playwright test suite in tests/e2e/
- [ ] 18.4 CI workflow orchestrating pytest + jest + playwright against compose test profile

## Implementation Details

See TechSpec **Testing Approach** and ADR-006.

### Relevant Files
- `nginx.conf` — create
- `docker-compose.test.yml` — create
- `simpa-frontend/tests/e2e/` — create
- `.github/workflows/ci.yml` — create

### Related ADRs
- [ADR-001: Docker Compose](../adrs/adr-001.md)
- [ADR-006: Full Test Strategy](../adrs/adr-006.md)

## Deliverables
- Single `docker compose up` serves full app on port 80
- Playwright suite green against test stack
- CI badge-ready workflow

## Tests
- Unit tests:
  - [ ] N/A — this task is integration/E2E focused
- Integration tests:
  - [ ] Full API test suite passes in CI
- E2E tests:
  - [ ] Login with seed admin credentials
  - [ ] Painel loads KPIs and switches layout A→B
  - [ ] Filter change refetches dashboard
  - [ ] CSV upload flow completes
  - [ ] Navigate Cadastros → Unidades
  - [ ] Dark mode toggle persists
  - [ ] Logout redirects to login
- Test coverage target: E2E covers all critical paths
- All tests must pass

## Success Criteria
- All tests passing in CI
- Production URL serves app with JWT-protected API on same origin
- README documents one-command deploy for municipal IT
