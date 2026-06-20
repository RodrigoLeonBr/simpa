# SIMPA Cadastros MySQL Sync — Task List

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | PostgreSQL migration 004 (estabelecimentos schema) | completed | medium | — |
| 02 | Python sync_cadastros_mysql.py + tests | completed | high | task_01 |
| 03 | Legacy cadastro data migration script | completed | medium | task_01 |
| 04 | Backend cadastro sync API (subprocess + routes) | completed | medium | task_02 |
| 05 | Backend estabelecimentos + procedimentos read-only API | completed | high | task_01, task_04 |
| 06 | Backend equipes FK migration + route deprecation | completed | medium | task_03, task_05 |
| 07 | Frontend Cadastros grid + sync banner | completed | medium | task_04 |
| 08 | Frontend Establishments + Procedures pages | completed | high | task_05, task_07 |
| 09 | Frontend FilterBar, dashboard filters, Equipes dropdown | completed | medium | task_06, task_08 |
| 10 | Deprecation cleanup + integration verification | completed | medium | task_09 |
