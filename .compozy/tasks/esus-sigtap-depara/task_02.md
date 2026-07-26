---
status: completed
title: Curate and apply seed_esus_sigtap_depara.sql
type: infra
complexity: high
dependencies:
  - task_01
---

# Task 02: Curate and apply seed_esus_sigtap_depara.sql

## Overview

Produce a versioned SQL seed that loads municipal de-para bases and native e-SUS SIGTAP section templates into `procedimentos` and `esus_procedimento_map`. Accurate 10-digit SIGTAP codes and real e-SUS section names are required so exact-match consumers work.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST create `seed_esus_sigtap_depara.sql` that inserts into `procedimentos` then `esus_procedimento_map`.
2. MUST use real e-SUS section names (see ADR-003): e.g. `Procedimentos / Pequenas cirurgias`, `Procedimentos - Teste rápido`, `Procedimentos - Administração de medicamentos`, odontological `Procedimentos`, `Outros procedimentos (SIGTAP)`, and native exam SIGTAP sections as applicable.
3. MUST set `origem` to `seed` for spreadsheet-derived rows and `nativo_sigtap` for native code-in-description rows.
4. MUST store complete 10-digit SIGTAP codes (curate truncated spreadsheet values against official SIGTAP).
5. MUST NOT store spreadsheet quantity columns as business fields.
6. SHOULD be re-runnable via ON CONFLICT upserts where sensible.
7. MUST document in seed header which municipal image/spreadsheet sources were used.
</requirements>

## Subtasks
- [x] 2.1 Transcribe municipal bases into curated rows split by real e-SUS sections
- [x] 2.2 Complete/verify SIGTAP check digits against official table
- [x] 2.3 Insert master `procedimentos` rows (dedupe by codigo_sigtap)
- [x] 2.4 Insert `esus_procedimento_map` rows with correct origem
- [x] 2.5 Add representative native SIGTAP section map rows for unified consultation
- [x] 2.6 Apply seed to local PG and spot-check counts per section
- [x] 2.7 Add SQL assertions or a small verification query set as tests

## Implementation Details

See TechSpec **Development Sequencing** step 2 and ADR-003 for section/lookup rules. Source labels must match `esus_indicadores_raw.descricao` text from `parse_esus_csv.py` / `seed_esus_2026-05.sql` exactly.

**Delivered:**
- `seed_esus_sigtap_depara.sql` (66 maps / 64 procs) — LEDI FP+FAO + municipal screenshots
- `scripts/generate_seed_esus_sigtap_depara.py` — regenerator
- `tests/sql/verify_seed_esus_sigtap_depara.sql` + `tests/test_seed_esus_sigtap_depara.py`

**Follow-ups:** Teste do olhinho (sem SIGTAP); 3ª planilha clínica sem seção e-SUS no export CAFI.

### Relevant Files
- `seed_esus_2026-05.sql` — reference for exact section and description strings
- `Relatório de procedimentos individualizados-*.csv` — section boundaries
- `Relatório de atendimento odontológico-*.csv` — odontological `Procedimentos` / Outros SIGTAP
- User-provided mapping images under Cursor assets (municipal bases)

### Dependent Files
- Resolve service (task_04) — consumes seeded maps
- Docs (task_09) — documents seed provenance

### Related ADRs
- [ADR-002](adrs/adr-002.md) — SQL seed delivery
- [ADR-003](adrs/adr-003.md) — real sections + exact match

## Deliverables
- `seed_esus_sigtap_depara.sql` in repo root (or agreed path)
- Curated 10-digit codes for all municipal base rows
- Verification queries / tests proving section coverage **(REQUIRED)**
- Unit/integration checks with >=80% coverage for any seed helper **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Every seed map row has `codigo_sigtap` length 10 (digits only)
  - [x] No duplicate `(secao, descricao_esus)` in seed file
  - [x] `origem` values are only allowed enum set
- Integration tests:
  - [x] Applying seed after DDL succeeds on empty tables
  - [x] Spot-check: label `Coleta de citopatológico de colo uterino` maps under `Procedimentos / Pequenas cirurgias`
  - [x] Spot-check: label `Para HIV` maps under `Procedimentos - Teste rápido`
  - [x] Spot-check: odontological `Exodontia de dente permanente` under section `Procedimentos`
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Seed applies cleanly after task_01 DDL
- >=95% of municipal base labels present with SIGTAP codes (PRD metric)
