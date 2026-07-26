---
status: completed
title: Shared resolve query/service (exact secao+label, silent skip)
type: backend
complexity: medium
dependencies:
  - task_01
  - task_02
---

# Task 04: Shared resolve query/service (exact secao+label, silent skip)

## Overview

Implement the shared lookup that joins active `esus_procedimento_map` + `procedimentos` to `esus_indicadores_raw` / `esus_cargas` filters, returning mapped quantities and omitting unmapped labels. Export and consolidator must use the same contract to avoid drift.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST implement the resolve contract from TechSpec Core Interfaces (`ResolveMappedProcedures` semantics).
2. MUST match exactly on `(secao, descricao_esus)` = `(esus_indicadores_raw.secao, descricao)` with both map and procedimento `status='ativo'`.
3. MUST silently skip unmapped labels (no error, no warning payload in MVP).
4. MUST accept filters competencia (required conceptually), unidade, equipe via `esus_cargas`.
5. MUST aggregate `quantidade` from `valores` JSON when present (default key `quantidade`).
6. SHOULD live in one shared place callable from Node export and Python consolidator (SQL view/function or duplicated identical SQL documented as single source — prefer one SQL artifact).
7. MUST exclude inactive maps from results.
</requirements>

## Subtasks
- [x] 4.1 Define shared SQL (view/function) or shared module implementing resolve
- [x] 4.2 Join raw indicators to maps with exact secao+descricao
- [x] 4.3 Apply competencia/unidade/equipe filters through esus_cargas
- [x] 4.4 Aggregate quantities and return MappingLookup-shaped rows
- [x] 4.5 Add tests covering mapped, unmapped, and inactive map cases

## Implementation Details

See TechSpec **Core Interfaces**, **Integration Points**, and ADR-003/004. Prefer a Postgres view or SQL function used by both Node and Python to avoid dual-language drift (ADR-004 risk mitigation).

**Delivered:**
- Postgres function `resolve_mapped_procedures(date, text, text)` in `schema_full.sql` (applied to live PG)
- Node wrapper `simpa-backend/src/services/procedimentoMap.js` → `resolveMappedProcedures`
- Row shape: `{secao, descricao_esus, codigo_sigtap, descricao_sigtap, quantidade}`
- Tests: `simpa-backend/test/procedimentoMap.test.js` (10/10 pass)

### Relevant Files
- `schema_full.sql` — may host view/function
- `esus_indicadores_raw` / `esus_cargas` definitions in `schema_full.sql`
- `consolidate_dashboard.py` — future consumer (task_06)
- `simpa-backend/src/services/` — place Node wrapper if needed

### Dependent Files
- Export route (task_05)
- Consolidator (task_06)
- Docs (task_09)

### Related ADRs
- [ADR-003](adrs/adr-003.md) — exact match + silent skip
- [ADR-004](adrs/adr-004.md) — shared consumer contract

## Deliverables
- Shared resolve artifact (SQL and/or service module)
- Documented row shape matching TechSpec MappingLookup (snake_case JSON)
- Automated tests **(REQUIRED)**
- Coverage >=80% on resolve logic **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Given map + raw row same secao/descricao, returns codigo_sigtap and quantidade
  - [x] Raw row without map does not appear in results
  - [x] Map with status inativo does not appear even if raw exists
- Integration tests:
  - [x] Filter by competencia+unidade+equipe returns only that carga's mapped rows
  - [x] Two loads different equipes do not leak quantities across filters
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Resolve usable from both planned consumers without behavior divergence
- Silent skip verified with fixture data
