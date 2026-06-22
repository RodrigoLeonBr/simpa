---
status: completed
title: Component DashboardPageShell
type: frontend
complexity: low
dependencies: []
---

# Task 11: Component DashboardPageShell

## Overview

Shared loading/error wrapper for dashboard-driven pages (Painel, Metas, Indicadores, Relatórios).

<requirements>
- MUST create `components/shared/DashboardPageShell.tsx`
- MUST render `analytics-state` / `analytics-state-error` matching existing copy patterns
- MUST include unit tests
</requirements>

## Subtasks

- [x] 11.1 Implement shell component
- [x] 11.2 Add DashboardPageShell.test.tsx

## Success Criteria
- Tests pass; component ready for task_12

## Verification (2026-06-21)

- `DashboardPageShell`: loading → `analytics-state`; error → `analytics-state-error`; else children
- Props: `loading`, `error?`, `loadingLabel?`, `children`, `testId?`
- `children` aceita `ReactNode | (() => ReactNode)` — função só invocada quando pronto
- DashboardPageShell.test.tsx: 6 passing; `tsc -b` OK
