---
status: completed
title: Metric SQL template binder and executor service
type: backend
complexity: medium
dependencies: []
---

# Task 01: Metric SQL template binder and executor service

## Overview

Implement the governed SQL execution layer for catalog metrics: convert named placeholders to positional PostgreSQL parameters and run templates loaded only from `painel_metricas_catalogo`. This is the foundation for all Painel widget value resolution.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `simpa-backend/src/services/painelMetricsService.js` with `bindTemplate` and `executeMetric(metricaId, scope)` per TechSpec Core Interfaces
- MUST bind only whitelisted placeholders: `:competencia`, `:estabelecimento_id`, `:equipe_id` (ADR-003)
- MUST reject templates with disallowed tokens or multiple statements
- MUST load SQL exclusively by `metrica_id` from DB — never from request body
- MUST parse `competencia` as `YYYY-MM` and bind as first day of month DATE
- MUST return `{ rows, single }` where `single` is first numeric `valor` column or null
- MUST export `bindTemplate` for unit testing without DB
</requirements>

## Subtasks
- [x] 01.1 Implement `bindTemplate(sql, scope)` with ordered `$n` substitution
- [x] 01.2 Implement `executeMetric` loading template from `painel_metricas_catalogo`
- [x] 01.3 Handle null `estabelecimento_id` / `equipe_id` for municipal scope
- [x] 01.4 Add structured error types for unknown metrica or invalid template
- [x] 01.5 Write Jest unit tests for binder and mocked query execution

## Implementation Details

See TechSpec **Implementation Design → Core Interfaces** (`painelMetricsService.js`) and **ADR-003**. Follow `dashboardService.js` `parseCompetencia` pattern for date validation.

### Relevant Files
- `simpa-backend/src/services/db.js` — `query()` pool
- `simpa-backend/src/services/dashboardService.js` — competencia parsing reference
- `migration_008_painel_widgets.sql` — seed `sql_template` examples

### Dependent Files
- `simpa-backend/src/services/painelWidgetsService.js` — task_03 consumer
- `simpa-backend/tests/painelMetricsService.test.js` — new

### Related ADRs
- [ADR-003: Server-Side Named Placeholder Binding](../adrs/adr-003.md)
- [ADR-001: Curated Metric Catalog](../adrs/adr-001.md)

## Deliverables
- `simpa-backend/src/services/painelMetricsService.js`
- `simpa-backend/tests/painelMetricsService.test.js` with 80%+ coverage **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `bindTemplate` maps `:competencia`, `:estabelecimento_id`, `:equipe_id` to `$1`, `$2`, `$3` in fixed order
  - [x] `bindTemplate` throws on `:user_input` or semicolon second statement
  - [x] `executeMetric` with mocked `query` returns `single` from first row `valor`
  - [x] `executeMetric` with unknown `metricaId` returns descriptive error
  - [x] Null establishment/equipe IDs bind as SQL NULL for municipal templates
- Integration tests:
  - [ ] Optional: execute seed template `esus.atendimento_individual.resumo.registros.quantidade` against PG when `PG_HOST` set
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- [x] All tests passing
- [x] Test coverage >=80% on `painelMetricsService.js`
- All seed templates bind without syntax errors (smoke via unit mocks)
