# SIMPA Fullstack — Task List

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Docker Compose + PostgreSQL init | completed | high | — |
| 02 | Python ETL suite (consolidate + SIA sync) | completed | high | task_01 |
| 03 | Backend Express foundation | completed | medium | task_01 |
| 04 | Auth JWT backend | completed | medium | task_03 |
| 05 | Dashboard API | completed | medium | task_02, task_03 |
| 06 | Importação API | completed | high | task_02, task_03, task_04 |
| 07 | SIA sync API | completed | medium | task_02, task_03, task_04 |
| 08 | Cadastros & Admin API | completed | high | task_03, task_04 |
| 09 | Frontend scaffold + design system | completed | high | — |
| 10 | Auth frontend + login page | completed | medium | task_04, task_09 |
| 11 | App shell (Sidebar, Topbar, FilterBar) | completed | medium | task_09, task_10 |
| 12 | Painel layouts A/B/C + ECharts | completed | high | task_05, task_11 |
| 13 | Sala de Situação overlay | completed | medium | task_11, task_12 |
| 14 | Indicadores, Metas e Relatórios | completed | high | task_11, task_12 |
| 15 | Importação UI | completed | medium | task_06, task_11 |
| 16 | Cadastros UI — superseded | completed | high | task_08, task_11 |
| 17 | Administração UI | completed | medium | task_08, task_11 |
| 18 | Production nginx + Playwright E2E + CI | completed | high | task_03–task_17 |

## Workflow notes

### Cadastros redesign (2026-06-20)

Task **16** and a porção da API de cadastros (task **08**) foram **superseded** pelo workflow paralelo **`simpa-cadastros-sync`**, agora arquivado em:

`.compozy/tasks/_archived/1781967665702-a4fca8ed-simpa-cadastros-sync/`

Entregas principais já no codebase:
- Sync MySQL → PostgreSQL (`sync_cadastros_mysql.py`, `POST /api/cadastros/sincronizar`)
- UI Estabelecimentos + Procedimentos (read-only) + banner de sync
- FilterBar/useDashboard com estabelecimentos APS (task 11 amended)
- Review round 001: 10/10 issues resolved

**Master simpa concluído** — tasks 01–18 completed. Review round 001: 7 issues (5 resolved, 2 medium follow-ups). Workflow arquivado.
