---
status: completed
title: "Migration 013 — tabelas PG sih_* + seeds widgets Hospitalar"
type: infra
complexity: low
dependencies: []
---

# Task 01: Migration 013 — tabelas PG sih_* + seeds widgets Hospitalar

## Overview

Cria as três tabelas PostgreSQL do módulo SIHD (`sih_sincronizacoes`, `sih_internacoes`, `sih_procedimentos`), seus índices e a UNIQUE grain constraint de cada tabela. Também insere os seeds de métricas e widgets do Painel Hospitalar (Layout A) nas tabelas `painel_metricas` e `painel_widgets` existentes. Registra a migration no docker-compose e no schema_full.sql para installs greenfield.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `migration_013_sih_tabelas.sql` idempotente (IF NOT EXISTS em todo DDL)
- MUST criar `sih_sincronizacoes` com CHECK constraint em status ('ok','parcial','erro','pendente') e UNIQUE index em competencia
- MUST criar `sih_internacoes` com FK para sih_sincronizacoes (ON DELETE CASCADE), FK nullable para estabelecimentos, índices em (competencia, cnes), (competencia, estabelecimento_id), (competencia, diag_principal) e UNIQUE grain constraint conforme TechSpec § Data Models
- MUST criar `sih_procedimentos` com mesmas FKs e índices em (competencia, cnes), (competencia, estabelecimento_id) e UNIQUE grain constraint conforme TechSpec § Data Models
- MUST inserir seeds de painel_metricas e painel_widgets para perfil Hospitalar Layout A com slug prefix `sih.*` — INSERT ... ON CONFLICT DO NOTHING
- MUST registrar migration_013 no docker-compose.yml após migration_012 no init chain
- MUST atualizar schema_full.sql com o DDL completo da migration_013
</requirements>

## Subtasks

- [x] 1.1 Escrever DDL das três tabelas com todos os índices e UNIQUE grain constraints conforme TechSpec
- [x] 1.2 Escrever seeds INSERT para painel_metricas (KPIs: sih.total_aih, sih.total_diarias, sih.total_diarias_uti, sih.total_valor, sih.media_permanencia, sih.taxa_mortalidade, sih.pct_diarias_uti) e painel_widgets (associações ao perfil Hospitalar Layout A)
- [x] 1.3 Registrar migration_013 no docker-compose.yml init chain e em schema_full.sql
- [x] 1.4 Escrever pytest idempotente validando tabelas, colunas, índices e seeds

## Implementation Details

Ver TechSpec § Data Models para DDL exato das três tabelas e § Integration Points para seeds de widgets.

Padrão de migration do projeto: arquivo `.sql` na raiz, DDL com `IF NOT EXISTS`, prefixo numérico `13_` no docker-compose init.

Seeds de widgets seguem padrão de `migration_008_painel_widgets.sql` — verificar colunas existentes em `painel_metricas` e `painel_widgets` antes de escrever INSERTs.

### Relevant Files

- `migration_012_populacao_cadastrada.sql` — referência de padrão mais recente de migration
- `migration_008_painel_widgets.sql` — referência para seeds de painel_metricas e painel_widgets
- `migration_011_rubricas_sia.sql` — referência de tabela com FK e índices
- `schema_full.sql` — arquivo baseline a ser atualizado
- `docker-compose.yml` — init chain a ser atualizado
- `tests/conftest.py` — fixtures pytest
- `tests/test_integration.py` — padrão de testes de migration existente

### Dependent Files

- `sync_sih_mysql.py` (task_02) — escreve nas tabelas criadas aqui
- `services/sihProducaoService.js` (task_04) — lê das tabelas criadas aqui
- `consolidate_dashboard.py` (task_05) — lê de sih_internacoes
- `migration_014*` (futuros) — dependem desta como base

### Related ADRs

- [ADR-001: Dual-Table Hybrid Storage](adrs/adr-001.md) — define grão de sih_internacoes e sih_procedimentos

## Deliverables

- `migration_013_sih_tabelas.sql` com DDL completo + seeds
- `schema_full.sql` atualizado
- `docker-compose.yml` atualizado com init entry migration_013
- `tests/test_migration_013.py` (pytest)

## Tests

- Unit tests:
  - [ ] Migration aplica `sih_sincronizacoes` com CHECK constraint status e UNIQUE em competencia
  - [ ] Migration aplica `sih_internacoes` com todas as colunas, FK CASCADE e UNIQUE grain (sincronizacao_id, cnes, proc_principal, diag_principal, complexidade, financiamento, motivo_saida, sexo)
  - [ ] Migration aplica `sih_procedimentos` com todas as colunas, FK CASCADE e UNIQUE grain (sincronizacao_id, cnes, proc_detalhado, cbo_profissional, financiamento_detalhe)
  - [ ] Migration é idempotente: re-executar não lança erro
  - [ ] Seeds de painel_metricas inserem pelo menos 7 slugs `sih.*` sem duplicar em re-run
- Integration tests:
  - [ ] docker-compose init inclui migration_013 após migration_012
  - [ ] DELETE de sih_sincronizacoes faz CASCADE em sih_internacoes e sih_procedimentos
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `\d sih_sincronizacoes`, `\d sih_internacoes`, `\d sih_procedimentos` mostram todas as colunas e índices
- Seeds visíveis em `SELECT slug FROM painel_metricas WHERE slug LIKE 'sih.%'`
- docker-compose.yml referencia migration_013
