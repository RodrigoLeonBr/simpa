# Importação de Cadastro Individual — Task List

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Database migration: populacao_cadastrada | completed | low | — |
| 02 | Parser Python: tipo cadastro_individual | completed | high | task_01 |
| 03 | ETL contract: integração pop_row em build_payload | completed | medium | task_01 |
| 04 | Consolidação: fetch_pop_row em consolidate_group | completed | low | task_01, task_02, task_03 |
| 05 | Backend API: populacaoService + GET /api/populacao | completed | medium | task_01 |
| 06 | Frontend: types + API client populacao | completed | low | task_05 |
| 07 | Frontend: PopulacaoPage (/painel/populacao) | completed | high | task_06 |
| 08 | Frontend: routing, navigation, preview badge | completed | low | task_07, task_02 |
