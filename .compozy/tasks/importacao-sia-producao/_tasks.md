# Importação SIA Produção — Task List

**Feature:** `importacao-sia-producao`  
**PRD:** [_prd.md](./_prd.md) · **TechSpec:** [_techspec.md](./_techspec.md)

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Migration 010 sia_producao CNES e métricas apresentado | pending | low | — |
| 02 | Query MySQL schema-compliant em sync_sia_mysql | pending | medium | task_01 |
| 03 | Batch insert e resolução estabelecimento_id | pending | high | task_02 |
| 04 | API SIA auth planning staff e resposta enriquecida | pending | medium | task_03 |
| 05 | UI SiaProducaoSyncBanner e client api/sia | pending | medium | task_04 |
| 06 | Consolidador e siaProducaoService por estabelecimento_id | pending | medium | task_03 |
| 07 | Testes integração e docs agent | pending | medium | task_05, task_06, task_08 |
| 08 | Espelho rubricas_sia e gate cadastros antes produção | pending | medium | — |
