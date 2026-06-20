# e-SUS Import Unit & Team Mapping (De-para) — Task List

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Database migration 006 — de-para registry and import FKs | completed | medium | — |
| 02 | Import mapping service (de-para, suggestions, Todas rules) | completed | high | task_01 |
| 03 | Parser ETL — write estabelecimento_id and equipe_id to esus_cargas | completed | high | task_01 |
| 04 | Consolidator ETL — consolidate and store dashboard by cadastro IDs | completed | high | task_03 |
| 05 | Dashboard API — query dados_consolidados by establishment/team IDs | completed | medium | task_04 |
| 06 | Importacao API — preview gate, upload resolucoes, mapeamentos CRUD | completed | high | task_02, task_03, task_04 |
| 07 | Frontend import API client and mapping types | completed | medium | task_06 |
| 08 | Importacao UI — mapping pickers, Process gate, Todas conflict modal | completed | high | task_07 |
| 09 | Painel — fetch dashboard by estabelecimento_id and equipe_id | completed | medium | task_05, task_07 |
| 10 | Agent docs — import de-para and schema reference | completed | low | task_09 |
