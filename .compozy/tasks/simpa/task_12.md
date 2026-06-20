---
status: pending
title: Painel layouts A/B/C + ECharts
type: frontend
complexity: high
dependencies:
  - task_05
  - task_11
---

# Task 12: Painel layouts A/B/C + ECharts

## Overview

Implement the Painel module with three switchable layouts (A Cards+Trend, B Hero focus, C Dense table) consuming dashboard API data. Include KPI cards, trend chart (12 competencias), ranking, and MAC/Hospitalar sections as embedded blocks per redesign spec.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement layouts A, B, C with segmented switcher per SIMPA.dc.html
- MUST display 6 KPIs: atendimentos, cobertura APS, equipes, metas, odonto, coletivas
- MUST use ECharts for trend lines and sparklines
- MUST show module status badges (SIA connected, SIHD pending)
- MUST render null KPIs as em dash with amber badge
</requirements>

## Subtasks
- [ ] 12.1 useDashboard hook wired to API/mock
- [ ] 12.2 LayoutA: KPI grid + trend + ranking
- [ ] 12.3 LayoutB: hero card + secondary KPIs + quality bars
- [ ] 12.4 LayoutC: mini KPIs + dense unit table

## Implementation Details

See auth design spec Section 6 and SIMPA.dc.html scrPainel section.

### Relevant Files
- `simpa-frontend/src/pages/Painel/LayoutA.tsx` — create
- `simpa-frontend/src/pages/Painel/LayoutB.tsx` — create
- `simpa-frontend/src/pages/Painel/LayoutC.tsx` — create
- `simpa-frontend/src/hooks/useDashboard.ts` — create

### Related ADRs
- [ADR-005: React Port](../adrs/adr-005.md)

## Deliverables
- Fully interactive Painel with layout switcher
- Charts render from real or mock contract data
- Component tests for null KPI formatting

## Tests
- Unit tests:
  - [ ] formatKpi(null) returns em dash
  - [ ] Layout switcher changes visible panel
- Integration tests:
  - [ ] useDashboard refetches on filter change
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- All three layouts match prototype structure at desktop breakpoint
