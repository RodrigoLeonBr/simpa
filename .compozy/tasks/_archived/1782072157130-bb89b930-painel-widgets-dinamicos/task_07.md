---
status: completed
title: Cadastro painel-metricas API routes
type: backend
complexity: low
dependencies:
  - task_02
  - task_04
---

# Task 07: Cadastro painel-metricas API routes

## Overview

Expose catalog read endpoints and the manual discovery trigger for planning staff under `/api/cadastros/painel-metricas`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add GET `/painel-metricas` with pagination and filters `q`, `fonte_tipo`
- MUST add GET `/painel-metricas/:id` returning full row including `sql_template`
- MUST add POST `/painel-metricas/descobrir` protected by `requirePlanningStaff`
- MUST call `discoverMetricsFromRaw()` and audit `painel_metricas_descobrir`
- MUST return list sorted by `label` or `ocorrencias DESC` for picker UX
</requirements>

## Subtasks
- [x] 07.1 Implement list query with ILIKE search on label/chave
- [x] 07.2 Implement detail GET by id
- [x] 07.3 Implement descobrir POST with audit
- [x] 07.4 Supertest tests for list, detail, descobrir auth

## Implementation Details

See TechSpec **API Endpoints → Cadastro** metric routes. List logic can live in `painelMetricsService.js` as `listMetricas` / `getMetricaById`.

### Relevant Files
- `simpa-backend/src/routes/cadastros.js`
- `simpa-backend/src/services/painelMetricsService.js`

### Dependent Files
- `simpa-frontend/src/api/painelWidgets.ts` — task_08
- `IndicadoresPainelPage` — task_16 discovery button

### Related ADRs
- [ADR-001: Curated Metric Catalog](../adrs/adr-001.md)

## Deliverables
- Metric catalog routes in `cadastros.js`
- List/get helpers in `painelMetricsService.js` if not present
- Route tests **(REQUIRED)**

## Tests
- Unit tests:
  - [x] GET list with `q=atendimento` filters results (mock DB)
  - [x] GET :id returns 404 for missing metric
  - [x] POST descobrir returns 403 for non-planning user
  - [x] POST descobrir returns `{ inserted, updated }` payload
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- [x] All tests passing
- [ ] Catalog list returns 10 seed metrics on empty query against dev DB
