---
status: completed
title: "Cadastros API routes, auth, and audit for perfil/enrichment"
type: backend
complexity: medium
dependencies:
  - task_03
---

# Task 04: Cadastros API routes, auth, and audit for perfil/enrichment

## Overview

Expose new REST endpoints for perfil and per-slug enrichment updates, apply `requirePlanningStaff` to all mutation routes, log audit events, and deprecate the legacy JSONB enrichment PUT.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add `PUT /api/cadastros/estabelecimentos/:id/perfil` with `requirePlanningStaff`
- MUST add `PUT /api/cadastros/estabelecimentos/:id/enriquecimento/:slug` with `requirePlanningStaff`
- MUST apply `requirePlanningStaff` to all enrichment mutation routes (including legacy path handling)
- MUST log `estabelecimento_perfil_update` and `estabelecimento_enriquecimento_update` via `auditService` on success
- MUST return 410 or proxy legacy `PUT .../enriquecimento` (no slug) per TechSpec deprecation note
- MUST add route tests in `estabelecimentos.routes.test.js` and integration tests in `cadastros.integration.test.js`
</requirements>

## Subtasks
- [x] 04.1 Register new routes in `cadastros.js`
- [x] 04.2 Wire `requirePlanningStaff` on enrichment PUT routes
- [x] 04.3 Add audit logging on successful perfil and enrichment updates
- [x] 04.4 Handle legacy enrichment endpoint deprecation
- [x] 04.5 Add route and integration tests for 403 non-planning role

## Implementation Details

See TechSpec **API Endpoints** and **Monitoring and Observability**. Reuse `requirePlanningStaff` from existing `POST /sincronizar` pattern.

### Relevant Files
- `simpa-backend/src/routes/cadastros.js`
- `simpa-backend/src/middleware/requirePlanningStaff.js`
- `simpa-backend/src/services/auditService.js`
- `simpa-backend/tests/estabelecimentos.routes.test.js`
- `simpa-backend/tests/integration/cadastros.integration.test.js`

### Dependent Files
- `simpa-frontend/src/api/cadastros.ts` — task_05

### Related ADRs
- [ADR-003: Profile-Specific Enrichment in Four Physical Tables](adrs/adr-003.md)

## Deliverables
- Updated `cadastros.js` with new routes and middleware
- Route + integration tests with 80%+ coverage on new handlers **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `PUT /estabelecimentos/1/perfil` with body `{perfil:'APS'}` returns 200 and `perfil_editado:true` for planning staff JWT
  - [x] Same request with read-only user JWT returns 403
  - [x] `PUT /estabelecimentos/1/enriquecimento/aps` returns 403 when establishment perfil is Hospitalar
  - [x] Legacy `PUT /estabelecimentos/1/enriquecimento` returns 410 or proxies per chosen deprecation strategy
- Integration tests:
  - [x] Full round-trip: PUT perfil → PUT enrichment aps → GET detail shows both
  - [x] Audit log row created with action `estabelecimento_perfil_update`
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on route handlers added/changed
- OpenAPI-less contract matches TechSpec endpoint table
- Non-planning roles cannot mutate perfil or enrichment
