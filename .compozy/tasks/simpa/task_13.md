---
status: completed
title: Sala de Situação overlay
type: frontend
complexity: medium
dependencies:
  - task_11
  - task_12
---

# Task 13: Sala de Situação overlay

## Overview

Implement the fullscreen Sala de Situação telão as an overlay (no route change) toggled from Topbar. Dark theme fixed (#070f1c), 4 KPI cards, trend chart, and Componente Qualidade APS progress bars.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST render fixed fullscreen overlay when AppContext.isSituacao is true
- MUST use dark palette independent of app theme toggle
- MUST show live status indicator and competencia from FilterBar
- MUST include exit button returning to normal app shell
- MUST reuse dashboard KPI and indicadores_qualidade data
</requirements>

## Subtasks
- [x] 13.1 Situacao overlay component with z-index 50
- [x] 13.2 KPI grid (4 columns) with IBM Plex Mono 34px values
- [x] 13.3 ECharts dark trend + quality progress bars
- [x] 13.4 Wire Topbar button to toggle isSituacao

## Implementation Details

See auth design spec Section 5 and SIMPA.dc.html isSituacao block lines 82–133.

### Relevant Files
- `simpa-frontend/src/pages/Situacao/index.tsx` — create
- `simpa-frontend/src/contexts/AppContext.tsx` — isSituacao state

### Related ADRs
- [ADR-005: React Port](../adrs/adr-005.md)

## Deliverables
- Working telão overlay from any authenticated screen
- Charts populated from dashboard hook
- Vitest test for open/close toggle

## Tests
- Unit tests:
  - [x] openSituacao sets isSituacao true
  - [x] closeSituacao restores false
  - [x] Overlay renders above shell (portal/fixed)
- Integration tests:
  - [x] KPI values match dashboard data source
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Telão visually matches prototype dark layout
