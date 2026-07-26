# e-SUS ↔ SIGTAP Procedure Mapping (De-Para) — Task List

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Add procedimentos and esus_procedimento_map DDL | completed | low | — |
| 02 | Curate and apply seed_esus_sigtap_depara.sql | completed | high | task_01 |
| 03 | Cadastros API CRUD for procedimentos and maps | completed | medium | task_01 |
| 04 | Shared resolve query/service (exact secao+label, silent skip) | completed | medium | task_01, task_02 |
| 05 | Export API JSON and CSV | completed | medium | task_04 |
| 06 | Consolidator procedimentos_mapeados + schema version bump | pending | medium | task_04 |
| 07 | Cadastros UI for de-para + in-app help | pending | medium | task_03 |
| 08 | Frontend export download + Painel mapped procedures | pending | medium | task_05, task_06 |
| 09 | Repository guide docs/esus-sigtap-depara.md | pending | low | task_04, task_05 |
