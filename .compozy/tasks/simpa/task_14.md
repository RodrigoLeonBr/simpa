---
status: completed
title: Indicadores, Metas e Relatórios
type: frontend
complexity: high
dependencies:
  - task_11
  - task_12
---

# Task 14: Indicadores, Metas e Relatórios

## Overview

Implement three analytics modules porting SIMPA.dc.html: Indicadores (catalog + drill-down), Metas (summary cards + progress table), Relatórios (benchmarking table + map placeholder + export toasts).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement Indicadores 300px catalog + detail panel with history chart and unit comparison
- MUST implement Metas 4 summary cards + table with progress bars and status badges (green/amber/red)
- MUST implement Relatórios ranking table + SVG map placeholder + municipal synthesis column
- MUST show export Excel/PDF buttons with toast "Em breve" (no error)
- MUST treat null exec/meta as em dash per PRD null semantics
</requirements>

## Subtasks
- [x] 14.1 Indicadores page with catalog selection state
- [x] 14.2 Metas page with atingimento calculation display
- [x] 14.3 Relatórios benchmarking with indicator selector
- [x] 14.4 Shared progress bar and status badge components

## Implementation Details

See auth design spec Sections 7–9 and SIMPA.dc.html scrIndic/scrMetas/scrRelat.

### Relevant Files
- `simpa-frontend/src/pages/Indicadores/index.tsx` — create
- `simpa-frontend/src/pages/Metas/index.tsx` — create
- `simpa-frontend/src/pages/Relatorios/index.tsx` — create

### Related ADRs
- [ADR-005: React Port](../adrs/adr-005.md)

## Deliverables
- Three fully navigable modules using indicadores_qualidade from dashboard
- Reusable StatusBadge and ProgressBar components
- Tests for null and threshold coloring logic

## Tests
- Unit tests:
  - [x] Meta status: >=100% green, 90-99% amber, <90% red
  - [x] null exec renders em dash not 0%
  - [x] Export button shows toast not throw
- Integration tests:
  - [x] Selecting catalog item updates detail panel
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Pages match prototype layout at 1280px viewport
