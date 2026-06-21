---
status: completed
title: Extender sync_cadastros_mysql para extrair forma e cbo
type: backend
complexity: high
dependencies:
  - task_01
---

# Task 02: Extender sync_cadastros_mysql para extrair forma e cbo

## Overview

Ampliar o pipeline de sincronização de cadastros para extrair tabelas `forma` e `cbo` do MySQL, normalizar registros e persistir no PostgreSQL com UPSERT.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST update `build_cadastro_config` with table/column envs for forma/cbo
- MUST add extraction queries for `forma` and `cbo`
- MUST implement UPSERT SQLs for `formas_sia` and `cbos_sia`
- MUST include inserted/updated/inactivated counters for both entities
- MUST preserve existing sync behavior for estabelecimentos/procedimentos
</requirements>

## Subtasks
- [x] 02.1 Config/env keys para forma e cbo
- [x] 02.2 Queries de extração e funções `extrair_formas`/`extrair_cbos`
- [x] 02.3 UPSERTs e persistência transacional
- [x] 02.4 Atualizar payload JSON final do sync

## Deliverables
- `sync_cadastros_mysql.py` atualizado
- testes Python cobrindo novos fluxos

## Tests
- Unit tests:
  - [x] Extração de forma retorna campos esperados
  - [x] Extração de cbo retorna campos esperados
  - [x] UPSERT atualiza registro existente sem duplicar
- Integration tests:
  - [x] `--dry-run` com contadores de forma/cbo
  - [x] `--pg-write` grava em `formas_sia` e `cbos_sia`

## Success Criteria
- Sync retorna métricas completas sem quebrar o contrato atual
