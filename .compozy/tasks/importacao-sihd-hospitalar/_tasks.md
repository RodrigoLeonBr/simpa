# SIHD Importation and Hospital Panel — Task List

**Feature:** `importacao-sihd-hospitalar`
**PRD:** [_prd.md](./_prd.md) · **TechSpec:** [_techspec.md](./_techspec.md)

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Migration 013: tabelas PG sih_* + seeds widgets Hospitalar | completed | low | — |
| 02 | sync_sih_mysql.py: extração MySQL s_aih + s_aih_pa e batch write PG | completed | high | task_01 |
| 03 | Backend SIHD: services/sih.js + routes/sih.js + mount em api.js | completed | medium | task_02 |
| 04 | sihProducaoService.js: queries sih_internacoes e sih_procedimentos | completed | medium | task_01 |
| 05 | consolidate_dashboard.py: módulo hospitalar_sihd + ModuloSIHD expandido | completed | medium | task_01 |
| 06 | Frontend: types/sih.ts + api/sih.ts + expansão ModuloSIHD em contrato.ts | completed | low | task_03 |
| 07 | SihImportSection.tsx: UI de importação SIHD em /importacao | completed | medium | task_06 |
| 08 | Painel Hospitalar: catalogView Layout A ativo + badge status em Cadastros | pending | medium | task_05, task_06 |
| 09 | Docs agent: backend-api.md, frontend.md, database.md | pending | low | task_07, task_08 |
