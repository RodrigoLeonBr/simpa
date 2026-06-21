---
status: completed
title: Dynamic LayoutA with hardcoded fallback
type: frontend
complexity: high
dependencies:
  - task_09
  - task_10
---

# Task 11: Dynamic LayoutA with hardcoded fallback

## Overview

Refactor `LayoutA.tsx` to render KPI cards and charts from `usePainelLayout` when available, falling back to existing `buildPainelKpis` / `buildTrendSeries` / `buildRanking` on error or empty widgets.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST update `simpa-frontend/src/pages/Painel/LayoutA.tsx` to consume dynamic widgets
- MUST use `painelWidgetsView` mappers for cards and charts
- MUST retain existing CSS grid structure (`kpi-grid-3`, `painel-split-grid`)
- MUST fallback to hardcoded builders when `layoutError || !layout?.widgets?.length`
- MUST preserve `data-testid="layout-a"`, `trend-chart`, ranking structure for tests
- MUST keep chart titles from widget `titulo` when dynamic
- MUST NOT break LayoutB/C (unchanged in this task)
- SHOULD show combined loading state when dashboard and layout both loading
</requirements>

## Subtasks
- [x] 11.1 Wire `usePainelLayout` alongside existing props from Painel index
- [x] 11.2 Render six card slots from first six card-type widgets ordered by `ordem`
- [x] 11.3 Render line and ranking charts from chart-type widgets
- [x] 11.4 Implement fallback branch to legacy builders
- [x] 11.5 Update/add Vitest tests for LayoutA dynamic and fallback paths

## Implementation Details

See TechSpec **Dynamic APS Layout A** and PRD F3. Parent `Painel/index.tsx` may pass layout hook results or LayoutA calls hook internally — pick one pattern and document in task PR.

### Relevant Files
- `simpa-frontend/src/pages/Painel/LayoutA.tsx`
- `simpa-frontend/src/pages/Painel/index.tsx`
- `simpa-frontend/src/utils/painelWidgetsView.ts`
- `simpa-frontend/src/utils/dashboardView.ts` — fallback

### Dependent Files
- `tests/e2e/painel-widgets.spec.ts` — task_17

### Related ADRs
- [ADR-002: Dedicated Painel Layout Endpoint](../adrs/adr-002.md)

## Deliverables
- Dynamic LayoutA implementation
- Updated LayoutA tests **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Renders 6 KpiCard components from mocked layout response
  - [x] Renders EChart when line widget has series data
  - [x] Falls back to buildPainelKpis when layout fetch fails
  - [x] Widget titles appear in DOM from API titulo
- Test coverage target: >=80% on LayoutA changed lines
- All tests must pass

### Validation evidence
- `npx vitest run src/pages/Painel/LayoutA.test.tsx src/pages/Painel/Painel.test.tsx` ✅ (7/7)
- `npx vitest run src/pages/Painel/LayoutA.test.tsx --coverage --coverage.include=src/pages/Painel/LayoutA.tsx` ✅ (`branches 80%`)
- `npx tsc --noEmit` ✅

## Success Criteria
- All tests passing
- Default seed layout visually matches pre-change Painel for reference competência
- No regression in existing Painel tests
