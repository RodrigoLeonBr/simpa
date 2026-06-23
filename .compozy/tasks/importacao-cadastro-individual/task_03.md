---
status: completed
title: "ETL contract: integração pop_row em build_payload"
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 03: ETL contract: integração pop_row em build_payload

## Overview

Modifies `etl_contract.py` to accept an optional `pop_row` parameter in `build_payload()` and compute quality indicator denominators from population data. Adds a `_denominadores()` helper that extracts `den` values for C1, B4, IGM-APS, IGM-PN, IGM-VAC, and IGM-ICSAP from the `pop_row` dict. All existing callers of `build_payload()` continue to work with `pop_row=None`, which leaves `den` as `"—"`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC "Implementation Design — etl_contract.py Changes" and "Core Interfaces — pop_row dict" sections
- FOCUS ON "WHAT" — computing correct denominators from the population snapshot; do NOT add DB access to this module
- MINIMIZE CODE — `_build_indicadores_qualidade()` and `build_payload()` are modified minimally; the rest of etl_contract.py is untouched
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST add optional `pop_row: dict | None = None` keyword argument to `build_payload()` signature.
2. MUST pass `pop_row` to `_build_indicadores_qualidade(pop_row=None)`.
3. MUST implement `_denominadores(pop_row)` that returns a dict with keys matching indicator codes: `{"C1": int, "B4": int | None, "IGM-APS": int, "IGM-PN": int | None, "IGM-VAC": int | None, "IGM-ICSAP": int}`.
4. MUST compute denominators as specified in TechSpec: C1/IGM-APS/IGM-ICSAP = `cidadaos_ativos`; IGM-PN = `condicoes_saude["gestante"]["sim"]`; IGM-VAC = sum of "Menos de 01 ano" faixa masculino+feminino; B4 = sum of "05 a 09 anos" + "10 a 14 anos" (approximate, documented).
5. MUST leave `den = "—"` for B1, B2, B3, B5, B6, M1, M2 (odontology indicators — denominators from production data, not cadastro).
6. MUST set `den = "—"` for any denominator where `pop_row is None` or where the computed value is None/0.
7. MUST NOT add any database connections, file I/O, or subprocess calls to `etl_contract.py` — this module must remain a pure data-transformation module.
8. MUST add a `den_nota` field to indicator entries where B4 denominator is approximate: `"den_nota": "Aproximado: faixas 05-09 + 10-14 anos"`.
9. SHOULD add type annotations for the new parameters consistent with existing annotations in the file.
</requirements>

## Subtasks

- [x] 3.1 Add `pop_row: dict | None = None` parameter to `build_payload()` and thread it through to `_build_indicadores_qualidade()`.
- [x] 3.2 Implement `_denominadores(pop_row)` helper with faixa_etaria summing logic.
- [x] 3.3 Modify `_build_indicadores_qualidade(pop_row)` to call `_denominadores()` and set `den` per indicator.
- [x] 3.4 Add `den_nota` field to B4 indicator entry.
- [x] 3.5 Write 25 unit tests for `_denominadores()` and `build_payload()` integration.

## Implementation Details

See TechSpec "Implementation Design — etl_contract.py Changes" for the `_denominadores()` implementation sketch and the faixa_etaria summing helper `_sum_faixas()`. The `_build_indicadores_qualidade()` function currently iterates `INDICADORES_QUALIDADE_CATALOG` (lines 261-278) — modify it to accept `pop_row` and call `_denominadores()` once, then use `dens.get(item["cod"], "—")` for each item's `den` field.

The B4 denominator uses bands `"05 a 09 anos"` and `"10 a 14 anos"` summed — this over-counts the 6–12 range (includes 5-year-olds and 13–14-year-olds). This is documented as `den_nota` and communicated to the frontend as a tooltip.

### Relevant Files

- `etl_contract.py` — primary file to modify (lines 261-278 for `_build_indicadores_qualidade`, lines 359-430 for `build_payload`)
- `simpa-backend/tests/` — location for new Python unit tests (if using pytest) or check for existing test runner pattern

### Dependent Files

- `consolidate_dashboard.py` — task_04 calls `build_payload(pop_row=pop_row)` after this task
- `simpa-frontend/src/types/contrato.ts` — may need `den_nota?: string` added to indicator type

### Related ADRs

- [ADR-003: Denominator Integration via pop_row Parameter in build_payload()](../adrs/adr-003.md) — Justifies pure function approach with pop_row parameter

## Deliverables

- Modified `etl_contract.py` with `pop_row` integration
- Unit tests for `_denominadores()` covering all indicator codes
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests confirming `dados_consolidados` JSONB has numeric `den` values after import **(REQUIRED)**

## Tests

- Unit tests:
  - [ ] `_denominadores(None)` returns empty dict (no denominators set)
  - [ ] `_denominadores({"cidadaos_ativos": 3337, "faixa_etaria": [...], "condicoes_saude": {...}})` returns `{"C1": 3337, "IGM-APS": 3337, "IGM-ICSAP": 3337}`
  - [ ] `_denominadores(pop_row)` with `condicoes_saude["gestante"]["sim"] = 24` returns `{"IGM-PN": 24}`
  - [ ] `_denominadores(pop_row)` with faixa "Menos de 01 ano" masculino=31, feminino=26 returns `{"IGM-VAC": 57}`
  - [ ] `_denominadores(pop_row)` with faixas "05 a 09 anos" total=221, "10 a 14 anos" total=211 returns `{"B4": 432}`
  - [ ] `build_payload(..., pop_row=None)` returns `indicadores_qualidade` list where all `den` values equal `"—"` (backward compatibility)
  - [ ] `build_payload(..., pop_row=mock_pop_row)` returns C1 entry with `den == 3337` (int, not string)
  - [ ] `build_payload(..., pop_row=mock_pop_row)` B1 entry still has `den == "—"` (odontology — not from cadastro)
  - [ ] B4 indicator entry has `den_nota` field containing the word "Aproximado"
- Integration tests:
  - [ ] After task_01 migration + task_02 import of PSF JD Alvorada + consolidation with pop_row: `dados_consolidados.dados_conteudo #>> '{indicadores_qualidade,0,den}'` (C1) is a numeric string, not `"—"`
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `build_payload(..., pop_row=None)` produces identical output to current version (no regression for existing consolidations without cadastro data)
- `build_payload(..., pop_row={cidadaos_ativos: 3337, ...})` produces C1 `den = 3337` in `indicadores_qualidade`
- B1–B3, B5–B6, M1, M2 `den` values remain `"—"` regardless of pop_row contents
