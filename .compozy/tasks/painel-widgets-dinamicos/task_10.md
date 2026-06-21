---
status: completed
title: usePainelLayout hook
type: frontend
complexity: medium
dependencies:
  - task_08
---

# Task 10: usePainelLayout hook

## Overview

Add a hook that fetches resolved Painel layout widgets when APS Layout A is active, keyed on the same filter dimensions as `useDashboard`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `simpa-frontend/src/hooks/usePainelLayout.ts`
- MUST read `competencia`, `unidadeId`, `equipeId`, `painelPerfil` from `useFilters`
- MUST call `fetchPainelLayout` only when `painelPerfil === 'APS'` (MVP scope)
- MUST expose `{ layout, loading, error, refetch }` where layout is `PainelLayoutResponse | null`
- MUST reuse `buildDashboardFilters` pattern from `useDashboard.ts` for ID params
- MUST cancel in-flight fetch on filter key change (same pattern as useDashboard)
- SHOULD accept optional `layout: 'A'` param defaulting to A
</requirements>

## Subtasks
- [x] 10.1 Implement hook with filterKey memo
- [x] 10.2 Skip fetch when perfil is not APS (return null layout, not loading forever)
- [x] 10.3 Map API errors to user-facing Portuguese messages
- [x] 10.4 Vitest tests with mocked fetchPainelLayout

## Implementation Details

See TechSpec **Data flow — Painel view**. Parallel fetch orchestration stays in LayoutA (task_11), not inside this hook.

### Relevant Files
- `simpa-frontend/src/hooks/useDashboard.ts`
- `simpa-frontend/src/hooks/useFilters.ts`
- `simpa-frontend/src/api/painelWidgets.ts`

### Dependent Files
- `simpa-frontend/src/pages/Painel/LayoutA.tsx` — task_11

### Related ADRs
- [ADR-002: Dedicated Painel Layout Endpoint](../adrs/adr-002.md)

## Deliverables
- `hooks/usePainelLayout.ts`
- `hooks/usePainelLayout.test.ts` **(REQUIRED)**

## Tests
- Unit tests:
  - [x] When painelPerfil MAC, hook does not call fetchPainelLayout
  - [x] When APS + competencia changes, fetch called twice with new param
  - [x] 404 API error sets error state without throwing
  - [x] Successful response sets layout.widgets length
- Test coverage target: >=80%
- All tests must pass

### Validation evidence
- `npx vitest run src/hooks/usePainelLayout.test.tsx` ✅ (8/8)
- `npx vitest run src/hooks/usePainelLayout.test.tsx --coverage --coverage.include=src/hooks/usePainelLayout.ts` ✅ (`branches 80.95%`)
- `npx tsc --noEmit` ✅

## Success Criteria
- All tests passing
- Hook integrates with existing filter sessionStorage behavior
