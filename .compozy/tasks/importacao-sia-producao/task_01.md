---
status: pending
title: Migration 010 sia_producao CNES e métricas apresentado
type: backend
complexity: low
dependencies: []
---

# Task 01: Migration 010 sia_producao CNES e métricas apresentado

## Overview

Adicionar colunas `cnes`, `estabelecimento_id`, `quantidade_apresentada` e `valor_apresentado` em `sia_producao`, ajustar índice/UNIQUE para o novo grão com CNES, e registrar migration no Docker init.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `migration_010_sia_producao_cnes.sql` idempotente
- MUST add FK opcional `estabelecimento_id` → `estabelecimentos(id)`
- MUST add index `(competencia, estabelecimento_id)`
- MUST update `docker-compose.yml` init order after migration_009
- MUST update `schema_full.sql` for greenfield installs
</requirements>

## Subtasks

- [ ] 1.1 Definir ALTER TABLE e recriar UNIQUE com cnes no grão agregado
- [ ] 1.2 Registrar migration no compose e schema_full
- [ ] 1.3 Teste pytest validando colunas

## Implementation Details

Ver TechSpec § Migration 010.

### Relevant Files
- `migration_010_sia_producao_cnes.sql` — nova migration
- `schema_full.sql` — baseline PG
- `docker-compose.yml` — init scripts

### Dependent Files
- `sync_sia_mysql.py` — passará a gravar novas colunas (task_03)

### Related ADRs
- [ADR-001](../adrs/adr-001.md) — grão agregado

## Deliverables
- Migration SQL + schema_full atualizado
- pytest `tests/test_migration_010.py`

## Tests
- Unit tests:
  - [ ] Migration aplica colunas cnes, estabelecimento_id, quantidade_apresentada, valor_apresentado
  - [ ] Migration é idempotente (re-run safe)
- Integration tests:
  - [ ] Docker init inclui migration_010
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Colunas visíveis em `\d sia_producao` após migrate
