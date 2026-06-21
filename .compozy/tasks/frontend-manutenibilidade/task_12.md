---
status: pending
title: Apply DashboardPageShell to analytics pages
type: frontend
complexity: medium
dependencies:
  - task_11
---

# Task 12: Apply DashboardPageShell to analytics pages

## Overview

Replace duplicated loading/error branches in four analytics pages with DashboardPageShell.

<requirements>
- MUST update Painel, Metas, Indicadores, Relatorios index pages
- MUST preserve useDashboard + useFilters integration
- MUST run related unit tests and build
</requirements>

## Subtasks

- [ ] 12.1 Refactor Painel/index.tsx
- [ ] 12.2 Refactor Metas, Indicadores, Relatorios
- [ ] 12.3 Verify no duplicate analytics-state blocks remain

## Relevant Files
- `simpa-frontend/src/pages/Painel/index.tsx`
- `simpa-frontend/src/pages/Metas/index.tsx`
- `simpa-frontend/src/pages/Indicadores/index.tsx`
- `simpa-frontend/src/pages/Relatorios/index.tsx`

## Success Criteria
- Four pages use shell; tests pass
