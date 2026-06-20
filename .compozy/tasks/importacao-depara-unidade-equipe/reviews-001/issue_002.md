---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T22:05:00Z
status: resolved
file: simpa-frontend/src/hooks/useDashboard.ts
line: 17
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Panel ignores unidade-only and Todas equipes filters

## Review Comment

`FilterBar` allows selecting a **Unidade** while leaving **Equipe** on “Todas as equipes” (`equipeId === null`). Before de-para, `fetchDashboard` was called with the resolved unit name and no equipe, scoping charts to that establishment.

`buildDashboardFilters()` now returns `undefined` unless **both** `unidadeId` and `equipeId` are set, so the Painel loads the **municipal aggregate** instead of unit-scoped data. This regresses the PRD acceptance path (“selecting establishment 7169698… returns dashboard data”) when the operator filters by unit without picking a specific team — a common FilterBar flow.

**Suggested fix:** Either (a) extend `dashboardService.buildDashboardQuery` + API to query by `estabelecimento_id` alone (aggregate teams), and have `useDashboard` pass `{ estabelecimentoId }` when only unit is selected; or (b) require equipe selection in FilterBar when ID-based data exists and disable “Todas as equipes” until backend supports unit-level aggregation. Align with TechSpec Panel data flow.

## Triage

- Decision: `valid`
- Root cause: `buildDashboardFilters` required both IDs; backend only supported ID pair or legacy text, not establishment-only ID.
- Fix: `useDashboard.buildDashboardFilters` returns `{ estabelecimentoId }` when only unit selected. `dashboardService.buildDashboardQuery` adds `useEstabelecimentoOnly` path; rejects `equipe_id` without `estabelecimento_id` (400).
- Verification: `dashboardService.test.js` (estab-only query), `useDashboard.test.tsx` (passes `{ estabelecimentoId: 1 }` when only unidade set).
