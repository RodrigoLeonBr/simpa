# Task 08 — FilterBar and useDashboard profile-aware loading

## Objective Snapshot

Unidades carregadas por `fetchEstabelecimentos({ perfil: painelPerfil })`; re-fetch ao trocar perfil.

## Important Decisions

- `fetchDashboard` inalterado no MVP (contrato APS); só lista de unidades muda por perfil.

## Learnings

- Review-001: skip `fetchDashboard` quando perfil ≠ APS; spinner só se `isPainelCatalogReady`.
- Review-001: delta coletivas omitido em `dashboardView` (sem série histórica compatível).

## Files / Surfaces

- `useDashboard.ts`, `FilterBar.tsx`, `useDashboard.test.tsx`

## Errors / Corrections

- Review-001: evitado flash de KPI APS em perfis pending.

## Ready for Next Run

**Completed.** task_09 adiciona switcher e placeholder.
