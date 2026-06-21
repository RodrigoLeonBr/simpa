---
status: completed
title: Painel — fetch dashboard by estabelecimento_id and equipe_id
type: frontend
complexity: medium
dependencies:
  - task_05
  - task_07
---

# Task 09: Painel — fetch dashboard by estabelecimento_id and equipe_id

## Overview

Update `useDashboard.ts` and `api/dashboard.ts` to pass `estabelecimento_id` and `equipe_id` from filter state instead of resolved name strings, fixing Panel charts after mapped imports.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST extend `fetchDashboard(competencia, { estabelecimentoId?, equipeId? })` query params
- MUST update `useDashboard` to pass `unidadeId` and `equipeId` from `useFilters` directly to API
- MUST remove dependency on name resolution via `unidadeNomeMap` for dashboard fetch (names remain for display only)
- MUST update `useDashboard.test.tsx` for ID-based fetch calls
- MUST handle 404 gracefully with existing error state when no consolidated data for selection
</requirements>

## Subtasks
- [x] 09.1 Update `api/dashboard.ts` with ID query parameters
- [x] 09.2 Refactor `useDashboard.ts` loadDashboard effect
- [x] 09.3 Update `useDashboard.test.tsx` expectations
- [x] 09.4 Verify FilterBar unchanged (already uses cadastro IDs)

## Implementation Details

See TechSpec **Data flow — Panel** and **Impact Analysis** useDashboard row.

### Relevant Files
- `simpa-frontend/src/hooks/useDashboard.ts`
- `simpa-frontend/src/api/dashboard.ts`
- `simpa-frontend/src/hooks/useDashboard.test.tsx`
- `simpa-frontend/src/components/layout/FilterBar.tsx`

### Dependent Files
- `docs/agent/frontend.md` — task_10

### Related ADRs
- [ADR-002: Cadastro keys on import storage](adrs/adr-002.md)

## Deliverables
- Updated dashboard hook and API client
- Vitest tests with 80%+ coverage **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `fetchDashboard('2026-01', { estabelecimentoId: 42 })` requests `/api/v1/dashboard/planejamento?competencia=2026-01&estabelecimento_id=42`
  - [x] `useDashboard` passes equipeId when both unidadeId and equipeId set
  - [x] `useDashboard` omits ID params when filters are null (municipal aggregate view)
  - [x] 404 response sets error state without crashing
- Integration tests:
  - [ ] N/A — E2E covered in task_08 with Panel navigation optional follow-up
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on useDashboard and dashboard API
- Selecting CAFI establishment in Panel after mapped import loads chart data
