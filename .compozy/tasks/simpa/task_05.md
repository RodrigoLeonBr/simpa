---
status: pending
title: Dashboard API
type: backend
complexity: medium
dependencies:
  - task_02
  - task_03
---

# Task 05: Dashboard API

## Overview

Implement the primary dashboard endpoint that reads `dados_consolidados` and returns the spec-driven JSON contract v3.1.0, including `indicadores_qualidade[]`. Include consolidar trigger endpoint for backfill.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement GET `/api/v1/dashboard/planejamento` with query params competencia, unidade, equipe
- MUST implement POST `/api/v1/dashboard/consolidar` spawning Python consolidator
- MUST return coherent empty/404 when no data for filter combination
- MUST respond within ~2s for indexed queries (PRD 7.2)
- MUST validate response against ContratoDashboard schema in tests
</requirements>

## Subtasks
- [ ] 5.1 Query builder for dados_consolidados with filters
- [ ] 5.2 Envelope raw JSONB into full ContratoDashboard shape
- [ ] 5.3 Consolidar endpoint with subprocess orchestration
- [ ] 5.4 JSON schema test fixture from PRD Section 5

## Implementation Details

See PRD Section 5 and TechSpec **Core Interfaces** (ContratoDashboard).

### Relevant Files
- `simpa-backend/src/routes/dashboard.js` — create
- `simpa-backend/src/services/consolidator.js` — spawn consolidate_dashboard.py

### Dependent Files
- `simpa-frontend/src/types/contrato.ts` — mirrors this contract (Task 09)

### Related ADRs
- [ADR-002: Spec-Driven Stack](../adrs/adr-002.md)

## Deliverables
- Dashboard endpoint returning v3.1.0 JSON from seed data
- Consolidar endpoint triggering Python backfill
- Schema validation integration tests

## Tests
- Unit tests:
  - [ ] Envelope builder handles null KPIs correctly
  - [ ] Missing competencia returns appropriate status
- Integration tests:
  - [ ] GET dashboard with seed data matches JSON schema
  - [ ] POST consolidar with mocked subprocess succeeds
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Frontend can consume real endpoint after Task 12 integration
