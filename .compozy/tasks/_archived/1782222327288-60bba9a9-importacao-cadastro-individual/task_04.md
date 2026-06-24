---
status: completed
title: "Consolidação: fetch_pop_row em consolidate_group"
type: backend
complexity: low
dependencies:
  - task_01
  - task_02
  - task_03
---

# Task 04: Consolidação: fetch_pop_row em consolidate_group

## Overview

Adds `fetch_pop_row()` to `consolidate_dashboard.py` and wires it into `consolidate_group()`, which now queries `populacao_cadastrada` for the matching `(competencia, estabelecimento_id)` before calling `build_payload()`. Passes the result as `pop_row` to `build_payload()`. When no population data exists for the group, `pop_row=None` preserves the existing `"—"` denominator behavior.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC "Implementation Design — consolidate_dashboard.py Changes" section for `fetch_pop_row()` signature
- FOCUS ON "WHAT" — fetching the population snapshot and threading it to build_payload; do not change consolidation logic
- MINIMIZE CODE — add ~10 lines to consolidate_group(); do not refactor other functions
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST implement `fetch_pop_row(conn, competencia: date, estabelecimento_id: int | None) -> dict | None` that queries `populacao_cadastrada` and returns a dict matching the `pop_row` shape defined in TechSpec "Core Interfaces", or `None` if no row found or if `estabelecimento_id` is None.
2. MUST call `fetch_pop_row()` inside `consolidate_group()` after `fetch_sia_rows()` and before `build_payload()`.
3. MUST pass the result as `pop_row=pop_row` to `build_payload()`.
4. MUST only fetch `pop_row` when `estabelecimento_id is not None` (ID-based consolidation path). Legacy text-based path passes `pop_row=None`.
5. MUST NOT fail consolidation when `populacao_cadastrada` has no row for the group — return `None` and let `build_payload` use `"—"` for denominators.
6. MUST fetch columns: `cidadaos_ativos`, `saidas`, `faixa_etaria`, `condicoes_saude`, `raca_cor` from `populacao_cadastrada`.
</requirements>

## Subtasks

- [x] 4.1 Implement `fetch_pop_row(conn, competencia, estabelecimento_id)` function in `consolidate_dashboard.py`.
- [x] 4.2 Add `pop_row` fetching call in `consolidate_group()` (after `fetch_sia_rows`, before `build_payload`).
- [x] 4.3 Update `build_payload()` call in `consolidate_group()` to include `pop_row=pop_row`.
- [x] 4.4 Write 8 unit tests for `fetch_pop_row()` with mocked DB cursor.
- [x] 4.5 Write 2 integration tests: cadastro_individual import → consolidate → C1 den numeric; without import → den stays "—".

## Implementation Details

See TechSpec "Implementation Design — consolidate_dashboard.py Changes" for the `fetch_pop_row()` SQL query. The function is ~10 lines: `cursor.execute(SELECT ... WHERE competencia = %s AND estabelecimento_id = %s)`, `row = cursor.fetchone()`, `return dict(row) if row else None`.

In `consolidate_group()`, add two lines after the existing `sia_rows = fetch_sia_rows(...)` call:
```python
pop_row = fetch_pop_row(conn, competencia, estabelecimento_id)
```
Then update the `build_payload(...)` call to include `pop_row=pop_row`.

### Relevant Files

- `consolidate_dashboard.py` — file to modify (`consolidate_group()` at lines 370-428, `fetch_raw_rows()` and `fetch_sia_rows()` as reference patterns)

### Dependent Files

- `etl_contract.py` — receives `pop_row` via `build_payload()` (task_03 must be done first)
- `dados_consolidados` table — output payload now contains numeric `den` values when pop_row available

### Related ADRs

- [ADR-003: Denominator Integration via pop_row Parameter in build_payload()](../adrs/adr-003.md) — Justifies this wiring pattern

## Deliverables

- Modified `consolidate_dashboard.py` with `fetch_pop_row()` and updated `consolidate_group()`
- Unit tests for `fetch_pop_row()` (no-row and with-row cases)
- Integration test for full pipeline: import → consolidate → verify `den` in `dados_consolidados`
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for consolidation with pop_row **(REQUIRED)**

## Tests

- Unit tests:
  - [ ] `fetch_pop_row(conn, competencia, None)` returns `None` without querying DB
  - [ ] `fetch_pop_row(conn, date(2026,1,31), 5)` with no matching row returns `None`
  - [ ] `fetch_pop_row(conn, date(2026,1,31), 5)` with matching row returns dict with `cidadaos_ativos`, `faixa_etaria`, `condicoes_saude` keys
  - [ ] `consolidate_group()` called without `estabelecimento_id` still succeeds (legacy path, `pop_row=None`)
- Integration tests:
  - [ ] Import PSF JD Alvorada cadastro_individual (task_02) + run `consolidate_group(competencia=2026-01, estabelecimento_id=<id>, equipe_id=<id>, pg_write=True)` → `dados_consolidados` row exists; `dados_conteudo->'indicadores_qualidade' @> '[{"cod":"C1"}]'` and that entry's `den != "—"`
  - [ ] Consolidation for unit WITHOUT cadastro_individual import: `den` values remain `"—"` (no regression)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- After importing PSF JD Alvorada cadastro_individual and running consolidation: `dados_consolidados.dados_conteudo #>> '{indicadores_qualidade,0,den}'` (C1) returns `"3337"` (not `"—"`)
- Units without cadastro_individual import continue to consolidate with `den = "—"` (no regression)
