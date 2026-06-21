---
status: completed
title: Painel layout resolver and widget preview logic
type: backend
complexity: high
dependencies:
  - task_01
  - task_02
---

# Task 03: Painel layout resolver and widget preview logic

## Overview

Extend `painelWidgetsService.js` with `resolvePainelLayout` and single-widget preview: execute metrics per widget, apply fallback, fraction, delta, spark, and chart row shaping per TechSpec resolution rules.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement `resolvePainelLayout({ perfil, layout, competencia, estabelecimentoId, equipeId })` returning `PainelLayoutResponse` shape
- MUST apply `fonte_config.fallback_chave` when primary metric returns null
- MUST format `fracao` widgets using `par_chave` second metric (metas seed)
- MUST compute `delta_config` tipo `competencia_anterior` by re-running metric for previous month
- MUST populate `sparkSeries` from `spark_metrica_id` when present
- MUST map `grafico_linha` to `series[]` and `grafico_ranking` to `ranking[]` with `limite` default 6
- MUST apply unit-filter rule: ranking with establishment filter returns ≤1 row or empty
- MUST log `painel.layout.resolve` with durationMs and widgetCount (TechSpec Monitoring)
- MUST expose `previewWidget(widgetId | draftBody, scope)` for cadastro preview endpoint
</requirements>

## Subtasks
- [x] 03.1 Load active widgets for perfil/layout and iterate resolution
- [x] 03.2 Implement card scalar + spark + delta pipeline
- [x] 03.3 Implement fraction and fixed delta label paths
- [x] 03.4 Implement line and ranking chart row mappers
- [x] 03.5 Add resolve + preview unit tests with mocked `executeMetric`
- [ ] 03.6 Optional PG integration: 8 seed widgets resolve for reference competência

## Implementation Details

See TechSpec **Widget resolution rules**, **Delta**, **Unit filter behavior**. Reuse formatting helpers aligned with `simpa-frontend/src/utils/kpi.ts` semantics (server may return raw numbers + labels).

### Relevant Files
- `simpa-backend/src/services/painelMetricsService.js` — task_01
- `simpa-backend/src/services/painelWidgetsService.js` — task_02 CRUD
- `simpa-frontend/src/utils/dashboardView.ts` — parity reference for deltas
- `migration_008_painel_widgets.sql` — seed widget configs

### Dependent Files
- `simpa-backend/src/routes/dashboard.js` — task_05
- `simpa-backend/src/routes/cadastros.js` — preview route task_06

### Related ADRs
- [ADR-002: Dedicated Painel Layout Endpoint](../adrs/adr-002.md)
- [ADR-003: Named Placeholder Binding](../adrs/adr-003.md)

## Deliverables
- `resolvePainelLayout` and `previewWidget` in `painelWidgetsService.js`
- `simpa-backend/tests/painelWidgetsResolve.test.js` **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Card widget returns `valueLabel` formatted number for atendimentos mock
  - [x] Fallback triggers when primary null and `fallback_chave` set
  - [x] Fracao widget `metas` returns `"2 / 5"` style label when mocks return 2 and 5
  - [x] Delta `competencia_anterior` calls executeMetric twice with adjacent months
  - [x] Ranking with `estabelecimentoId` set returns at most one ranking row
  - [x] Placeholder metrics yield `isNull: true` and em-dash label
- Integration tests:
  - [ ] With PG: `resolvePainelLayout` APS/A seed returns 8 widgets for competência with data
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- [x] All tests passing
- [x] Test coverage >=80% on resolver functions
- [ ] Seed widgets produce parity with `buildPainelKpis` for default competência (manual or integration check)
