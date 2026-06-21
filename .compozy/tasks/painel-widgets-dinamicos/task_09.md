---
status: completed
title: painelWidgetsView mapping utilities
type: frontend
complexity: low
dependencies:
  - task_08
---

# Task 09: painelWidgetsView mapping utilities

## Overview

Create view-layer mappers from `ResolvedPainelWidget` API payloads to existing Painel UI types (`PainelKpi`, trend points, ranking rows) used by `KpiCard` and `EChart`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `simpa-frontend/src/utils/painelWidgetsView.ts`
- MUST map card widgets to `PainelKpi` shape compatible with `KpiCard`
- MUST map `grafico_linha` series to `TrendPoint[]` for `trendOption`
- MUST map `grafico_ranking` to `RankingRow[]` for ranking bars
- MUST preserve EM_DASH / null semantics via existing `kpi.ts` helpers
- MUST NOT duplicate `buildPainelKpis` logic — only adapt API DTOs
</requirements>

## Subtasks
- [x] 09.1 Implement `mapWidgetToKpi(resolved: ResolvedPainelWidget): PainelKpi`
- [x] 09.2 Implement `mapWidgetToTrendSeries` and `mapWidgetToRanking`
- [x] 09.3 Split widgets array into cards vs charts by `tipo`
- [x] 09.4 Vitest tests with fixture resolved widgets

## Implementation Details

See TechSpec **Frontend** impact and existing `utils/dashboardView.ts` types. Keep mappers pure functions.

### Relevant Files
- `simpa-frontend/src/utils/dashboardView.ts` — `PainelKpi`, `RankingRow`, `TrendPoint`
- `simpa-frontend/src/utils/kpi.ts` — formatting
- `simpa-frontend/src/components/painel/KpiCard.tsx`

### Dependent Files
- `simpa-frontend/src/pages/Painel/LayoutA.tsx` — task_11

## Deliverables
- `utils/painelWidgetsView.ts`
- `utils/painelWidgetsView.test.ts` **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Card with null value maps to `isNull: true` and EM_DASH value string
  - [x] Line widget produces non-empty trend array when series present
  - [x] Ranking widget caps rows at configured limit
  - [x] Fracao formato preserves `"2 / 5"` valueLabel
- Test coverage target: >=80%
- All tests must pass

### Validation evidence
- `npx vitest run src/utils/painelWidgetsView.test.ts` ✅ (8/8)
- `npx vitest run src/utils/painelWidgetsView.test.ts --coverage --coverage.include=src/utils/painelWidgetsView.ts` ✅ (`branches 85.41%`)
- `npx tsc --noEmit` ✅

## Success Criteria
- All tests passing
- Mappers produce structures LayoutA can render without type errors
