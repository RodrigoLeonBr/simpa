---
status: completed
title: Metric catalog discovery from e-SUS raw
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 04: Metric catalog discovery from e-SUS raw

## Overview

Implement `discoverMetricsFromRaw` to scan `esus_indicadores_raw` joined with `esus_cargas`, generate stable `chave` values, default `sql_template` from seed patterns, and UPSERT into `painel_metricas_catalogo`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement `discoverMetricsFromRaw()` in `painelMetricsService.js` per TechSpec
- MUST generate `chave` as `esus.{tipo_relatorio}.{secao_slug}.{descricao_slug}.{campo_json}` max 160 chars
- MUST UPSERT on `chave` — update `ocorrencias`, `ultima_carga_em`, increment counts on conflict
- MUST NOT overwrite `sql_template` on existing seed rows if `status=ativo` and template non-empty (preserve manual seed)
- MUST generate default `sql_template` for new rows following esus_raw seed pattern in migration 008
- MUST set `fonte_tipo = 'esus_raw'` and `agregacao = 'valor_unico'` for discovered rows
- MUST return `{ inserted, updated }` summary
</requirements>

## Subtasks
- [x] 04.1 SQL DISTINCT scan over raw + cargas with jsonb_object_keys on `valores`
- [x] 04.2 Slug helper for secao/descricao (ASCII fold, dots)
- [x] 04.3 UPSERT logic preserving existing seed templates
- [x] 04.4 Unit tests with fixture rows
- [x] 04.5 Document discovery behavior in service JSDoc

## Implementation Details

See TechSpec **Discovery-generated chave pattern**. Reference `parse_esus_csv.py` EAV structure and `consolidate_dashboard.py` `fetch_raw_rows`.

### Relevant Files
- `migration_008_painel_widgets.sql` — template pattern for esus_raw
- `consolidate_dashboard.py` — raw join query reference
- `schema_full.sql` — `esus_indicadores_raw` columns

### Dependent Files
- `simpa-backend/src/routes/cadastros.js` — task_07 descobrir endpoint

### Related ADRs
- [ADR-001: Curated Metric Catalog](../adrs/adr-001.md)

## Deliverables
- `discoverMetricsFromRaw` in `painelMetricsService.js`
- Tests in `painelMetricsService.test.js` or `painelMetricsDiscover.test.js` **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Slug helper converts `"Resumo de produção"` → stable segment
  - [x] New raw combination inserts row with generated `sql_template`
  - [x] Existing seed `chave` updates `ocorrencias` only, preserves `sql_template`
  - [x] Empty scan returns `{ inserted: 0, updated: 0 }`
- Integration tests:
  - [ ] PG: after seed_esus data, discovery returns inserted >= 0 without duplicate key errors
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- [x] All tests passing
- [x] Test coverage >=80% on discovery functions
- [ ] Manual discovery on dev DB adds picker entries for unseen e-SUS rows
