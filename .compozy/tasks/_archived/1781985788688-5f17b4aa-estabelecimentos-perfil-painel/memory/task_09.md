# Task 09 — Painel profile switcher and placeholder UX

## Objective Snapshot

`ProfileSwitcher`; `PAINEL_KPI_CATALOGS`; APS layouts A/B/C; placeholder MAC/Hospitalar/Misto.

## Important Decisions

- MVP: só APS `catalogStatus: 'ready'`; demais `'pending'` → `PainelProfilePlaceholder`.

## Learnings

- `isPainelCatalogReady` coordena render sem KPI APS enganoso.
- Estilos espelham `LayoutSwitcher` (a11y consistente).

## Files / Surfaces

- `pages/Painel/index.tsx`
- `ProfileSwitcher.tsx`, `PainelProfilePlaceholder.tsx`
- `utils/dashboardView.ts`

## Errors / Corrections

- Nenhum blocker pós-review nesta task.

## Ready for Next Run

**Completed.** task_10 valida E2E multi-perfil.
