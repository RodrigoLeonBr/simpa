---
status: completed
title: Batch insert e resolução estabelecimento_id
type: backend
complexity: high
dependencies:
  - task_02
---

# Task 03: Batch insert e resolução estabelecimento_id

## Overview

Refatorar `gravar_pg()` para insert em batch (execute_batch ou COPY), resolver `estabelecimento_id` via mapa `estabelecimentos.codigo_externo`, popular `dados_extras` com rubrica, e retornar estatísticas de CNES órfãos no JSON de resultado.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST replace row-by-row INSERT loop with batch insert (chunk size configurable, default 1000)
- MUST load estabelecimentos map once per sync run
- MUST write cnes, estabelecimento_id, quantidade_apresentada, valor_apresentado columns
- MUST DELETE all sia_producao rows for competencia before reimport (not only by sincronizacao_id)
- MUST accept reimportar flag from API; skip DELETE on first import only
- MUST support check_competencia_importada(competencia) returning exists/status/registros for 409 gate
- MUST return orphan_cnes, estabelecimentos_resolvidos, and optional linhas_mysql_raw vs registros (aggregation ratio) in JSON
- MUST handle empty dataframe gracefully
</requirements>

## Subtasks

- [x] 3.1 Implementar load_estabelecimentos_map(conn_pg)
- [x] 3.2 Batch insert com novas colunas
- [x] 3.3 Estender resultado JSON com contadores
- [x] 3.4 Testes unitários com PG mock/fixture

## Implementation Details

Padrão de referência: batch patterns em `sync_cadastros_mysql.py`.

### Relevant Files
- `sync_sia_mysql.py` — gravar_pg, sincronizar

### Dependent Files
- `migration_010_sia_producao_cnes.sql` — colunas destino

### Related ADRs
- [ADR-001](../adrs/adr-001.md)

## Deliverables
- gravar_pg otimizado + testes pytest

## Tests
- Unit tests:
  - [x] estabelecimento_id resolvido quando cnes existe
  - [x] orphan_cnes incrementado quando cnes ausente
  - [x] Batch chamado N/chunk vezes
  - [x] Empty df → status parcial, 0 registros
- Integration tests:
  - [x] gravar_pg contra PG test container ou mock cursor
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Sync 1 competência dev completa sem timeout de insert
