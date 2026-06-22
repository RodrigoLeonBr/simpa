---
status: pending
title: Query MySQL schema-compliant em sync_sia_mysql
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 02: Query MySQL schema-compliant em sync_sia_mysql

## Overview

Reescrever `build_sia_query()` e `transformar()` para agregação gerencial: GROUP BY no grão ADR-002, SUM com CAST, excluir colunas administrativas (folha, seq, flags, APAC, etc.), filtro obrigatório por ano/mês (`prd_cmp`).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST always filter `prd_cmp = %(comp)s` from user-selected YYYY-MM
- MUST GROUP BY gerencial grain (cnes, procedimento, faixa, sexo, cbo, rubrica) — never import prd_flh/prd_seq
- MUST NOT SELECT excluded columns per ADR-002 (flags, APAC, CNS, NF, CID sec/causa, PRD_ORG, PRD_CNPJ)
- MUST use SUM(CAST(...)) on PRD_QT_P/A and PRD_VL_P/A only
- MUST use COLLATE on JOINs prestador/procedimento/cbo/s_rub
- MUST preserve SIA_* env overrides
- MUST update tests/test_sync_sia_mysql.py asserting excluded columns absent from query
</requirements>

## Subtasks

- [ ] 2.1 build_sia_query com GROUP BY + SUM + joins s_rub/cbo
- [ ] 2.2 Garantir query não referencia folha/seq/flags
- [ ] 2.3 transformar: faixa_etaria, PRD_IDADE > 150 → null/Ignorado
- [ ] 2.4 Testes query shape + colunas excluídas

## Implementation Details

Referência externa: `consultasia/docs/sia-schema-for-llm.md` §2–3.

### Relevant Files
- `sync_sia_mysql.py` — build_sia_query, extrair_sia, transformar
- `tests/test_sync_sia_mysql.py` — asserts query

### Dependent Files
- `etl_db.py` — mysql_connect

### Related ADRs
- [ADR-001](../adrs/adr-001.md)
- [ADR-002](../adrs/adr-002.md) — campos excluídos e grão

## Deliverables
- Query conforme schema + testes pytest atualizados

## Tests
- Unit tests:
  - [ ] Query NÃO contém prd_flh, prd_seq, PRD_FLPA, PRD_APANUM, etc.
  - [ ] Query contém GROUP BY e SUM(CAST(...))
  - [ ] Params competência YYYYMM
  - [ ] Colunas cnes, quantidade_apresentada, rubrica_codigo no SELECT
  - [ ] transformar normaliza faixa etária e sexo
- Integration tests:
  - [ ] (opcional) extrair_sia contra MySQL mock/fixture
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- `--json-out` preview retorna novos campos
