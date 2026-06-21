---
status: completed
title: Migration PostgreSQL para formas_sia e cbos_sia
type: backend
complexity: medium
dependencies: []
---

# Task 01: Migration PostgreSQL para formas_sia e cbos_sia

## Overview

Criar a base de dados no PostgreSQL para espelhar os cadastros `forma` e `cbo` da produção, incluindo colunas de auditoria de sincronização em `cadastros_sincronizacoes`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `migration_009_cadastros_forma_cbo.sql`
- MUST add table `formas_sia` with codes `grupo/subgrupo/forma`, `status`, `sincronizado_em`
- MUST add table `cbos_sia` with `codigo_cbo`, `descricao`, `status`, `sincronizado_em`
- MUST create indexes described in TechSpec
- MUST extend `cadastros_sincronizacoes` with six counters (`forma_*`, `cbo_*`)
- MUST be idempotent (`IF NOT EXISTS` / safe re-run)
</requirements>

## Subtasks
- [x] 01.1 Criar DDL das tabelas e constraints
- [x] 01.2 Criar índices por código/status
- [x] 01.3 Adicionar colunas de auditoria em `cadastros_sincronizacoes`
- [x] 01.4 Revisar compatibilidade com docker init e ambiente local

## Deliverables
- `migration_009_cadastros_forma_cbo.sql`

## Tests
- Unit tests:
  - [x] N/A (migration)
- Integration tests:
  - [x] Aplicar migration em banco limpo
  - [x] Reaplicar migration sem erro
  - [x] Validar estrutura final com `information_schema`

## Success Criteria
- Migration aplica com sucesso e sem regressões nas migrations anteriores
