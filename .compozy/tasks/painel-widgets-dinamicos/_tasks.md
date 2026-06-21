# Dynamic Painel Indicators — Task List

**Feature:** `painel-widgets-dinamicos`  
**PRD:** [_prd.md](./_prd.md) · **TechSpec:** [_techspec.md](./_techspec.md)

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Metric SQL template binder and executor service | completed | medium | — |
| 02 | Widget configuration CRUD service | completed | medium | — |
| 03 | Painel layout resolver and widget preview logic | completed | high | task_01, task_02 |
| 04 | Metric catalog discovery from e-SUS raw | completed | medium | task_01 |
| 05 | Dashboard painel-layout runtime endpoint | completed | low | task_03 |
| 06 | Cadastro painel-widgets API routes and audit | completed | medium | task_02, task_03 |
| 07 | Cadastro painel-metricas API routes | completed | low | task_02, task_04 |
| 08 | Frontend types and painelWidgets API client | completed | medium | task_05, task_06, task_07 |
| 09 | painelWidgetsView mapping utilities | completed | low | task_08 |
| 10 | usePainelLayout hook | completed | medium | task_08 |
| 11 | Dynamic LayoutA with hardcoded fallback | completed | high | task_09, task_10 |
| 12 | Cadastros grid entry and route wiring | completed | low | task_08 |
| 13 | IndicadoresPainelPage widget list | completed | medium | task_08, task_12 |
| 14 | Widget edit form and metric catalog picker | completed | medium | task_13 |
| 15 | Widget preview modal and SQL detail panel | pending | medium | task_14 |
| 16 | Catalog discovery action in cadastro UI | pending | low | task_15, task_07 |
| 17 | Playwright E2E cadastro to Painel flow | pending | medium | task_11, task_15 |
| 18 | Agent docs and design spec expansion | pending | low | task_11, task_16, task_17 |
