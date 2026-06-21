---
status: completed
title: Testes backend das novas rotas e histórico de sync
type: test
complexity: medium
dependencies:
  - task_04
  - task_06
---

# Task 07: Testes backend das novas rotas e histórico de sync

## Overview

Cobrir com testes de backend a exposição dos novos cadastros e o novo shape de sincronizações.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add route tests for `formas` and `cbos`
- MUST validate 405 em métodos não permitidos
- MUST assert campos `formas`/`cbos` no retorno de sincronizações
- MUST keep tests deterministic com mocks de DB/sync
</requirements>

## Subtasks
- [x] 07.1 Criar suíte de rotas novas
- [x] 07.2 Atualizar suíte de sincronização existente
- [x] 07.3 Garantir cobertura mínima do código novo

## Deliverables
- novos/ajustados testes em `simpa-backend/tests/*`

## Tests
- Unit tests:
  - [x] mapeamento de shape em `cadastrosSync`
- Integration tests:
  - [x] `GET /api/cadastros/formas` 200
  - [x] `GET /api/cadastros/cbos` 200
  - [x] `GET /api/cadastros/sincronizacoes` inclui novos blocos
- Coverage target: >=80% dos arquivos tocados

## Success Criteria
- Testes backend passam com cobertura adequada dos novos fluxos
