# Frontend Maintainability — Task List

**Feature:** `frontend-manutenibilidade`  
**PRD:** [_prd.md](./_prd.md) · **TechSpec:** [_techspec.md](./_techspec.md)

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Unify buildPaginatedCatalogQuery in enrichmentView | completed | low | — |
| 02 | Hook usePaginatedCatalog with tests | completed | medium | task_01 |
| 03 | Component ReadOnlyCatalogPage with tests | completed | medium | task_02 |
| 04 | Migrate Formas/CBOs/Procedimentos to unified catalog | completed | low | task_03 |
| 05 | Consolidate api/cadastros types to types/cadastros | completed | low | — |
| 06 | Modularize index.css into styles/ domain files | completed | medium | — |
| 07 | Lazy route loading in App.tsx + ModuleLoadingFallback | completed | medium | — |
| 08 | Hook useEntityCrud extracted from CRUD pages | pending | high | — |
| 09 | Refactor UsuariosPage with useEntityCrud | pending | medium | task_08 |
| 10 | Refactor IndicadoresPainelPage with useEntityCrud | pending | high | task_08 |
| 11 | Component DashboardPageShell | pending | low | — |
| 12 | Apply DashboardPageShell to analytics pages | pending | medium | task_11 |
| 13 | Vite manualChunks + lazy EChart import | pending | medium | task_07 |
| 14 | Split EnrichmentFormByPerfil by perfil | pending | high | — |
| 15 | Partition dashboardView, indicadoresView, importacaoView | pending | high | — |
| 16 | Split EstabelecimentoDetailDrawer + cadastroEntities + docs | pending | medium | task_04, task_14 |
