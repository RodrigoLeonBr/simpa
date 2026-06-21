# Idea — Frontend Maintainability & Performance

**Feature slug:** `frontend-manutenibilidade`  
**Date:** 2026-06-21  
**Status:** Accepted (seed from planning session)

---

## Problem statement

SIMPA's React frontend builds successfully (`tsc -b && vite build`) but shows a Vite warning: the main JS chunk is **882 KB** (277 KB gzip) after minification. All routes are imported statically in `App.tsx`, so users download Cadastros, Importação, Admin, ECharts, and analytics modules even when opening only the Painel.

Separately, **maintainability debt** is visible in source:

- ~13 production files exceed 200 lines; `index.css` is ~2900 lines monolithic.
- Formas, CBOs, and Procedimentos pages are ~90% duplicate read-only catalog code.
- Three parallel CRUD implementations: `CadastroCrudPage`, `UsuariosPage`, `IndicadoresPainelPage`.
- God modules: `EnrichmentFormByPerfil.tsx` (418 lines), `dashboardView.ts`, `indicadoresView.ts`.

This slows feature delivery (new SIA catalog pages, admin screens, painel widgets) and increases regression risk in PR review.

---

## Proposed direction

**Incremental 4-phase refactor** (no big-bang rewrite):

| Phase | Focus | User-visible impact |
|-------|--------|---------------------|
| 1 | Unified read-only catalog, lazy routes, modular CSS, type consolidation | Faster initial load; easier new catalog pages |
| 2 | `useEntityCrud`, dashboard page shell, Vite chunk tuning | Consistent admin/cadastro UX; smaller Painel-first bundle |
| 3 | Split enrichment forms, view utils, establishment drawer | Faster PR reviews; safer changes |
| 4 | Extended cadastro registry, split large tests, agent docs | Onboarding for new contributors |

---

## Explicit non-goals

- Rewriting Importação module UI/flow
- Replacing ECharts
- Backend/API or dashboard contract v3.1.0 changes
- Big-bang rewrite of Cadastros

---

## Success signals

- Initial JS gzip chunk measurably smaller (target: under ~500 KB gzip for entry route)
- Formas/CBOs/Procedimentos pages under ~40 lines each (config only)
- No production TS/TSX file > 250 lines (tests excepted) after phase 3
- All existing Vitest + Playwright E2E pass without regression
- Coverage thresholds maintained (≥80% on covered paths)

---

## References

- Planning doc: Cursor plan `frontend_maintainability_roadmap`
- Build output: `simpa-frontend` Vite 8.0.16, 697 modules, 2026-06-21
- Key files: `App.tsx`, `index.css`, `FormasPage.tsx`, `EnrichmentFormByPerfil.tsx`, `IndicadoresPainelPage.tsx`
