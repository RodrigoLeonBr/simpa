---
status: completed
title: "Parser Python: tipo cadastro_individual"
type: backend
complexity: high
dependencies:
  - task_01
---

# Task 02: Parser Python: tipo cadastro_individual

## Overview

Extends `parse_esus_csv.py` to recognize and process "Relatório de cadastro individual - Analítico" CSV files. Adds `cadastro_individual` to `TIPO_RELATORIO_MAP`, defines `CADASTRO_SECTION_MAP` for section-to-field routing, and implements `_write_cadastro_to_pg()` which maps parsed CSV sections to structured `populacao_cadastrada` columns instead of the generic `esus_indicadores_raw` rows. Also adds `cidadaos_ativos` to the preview metadata so the frontend can display it on preview cards.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC "Implementation Design — parse_esus_csv.py Changes" section for function signatures and CADASTRO_SECTION_MAP keys
- FOCUS ON "WHAT" — the parser must extract structured population data from all key CSV sections
- MINIMIZE CODE — the section detection loop is already implemented; do not rewrite it
- TESTS REQUIRED — every task MUST include tests in deliverables; use the three real CSV fixtures
</critical>

<requirements>
1. MUST add `"Relatório de cadastro individual - Analítico": "cadastro_individual"` to `TIPO_RELATORIO_MAP`.
2. MUST add `CADASTRO_SECTION_MAP` dict mapping `normalize_key(section_header)` values to field names (dados_gerais, faixa_etaria, sexo, raca_cor, condicoes_saude, mercado_trabalho, escolaridade, deficiencia).
3. MUST implement `_write_cadastro_to_pg(meta, sections, conn, estabelecimento_id)` that: INSERTs into `esus_cargas` (type=cadastro_individual), then INSERTs/UPSERTs into `populacao_cadastrada` using ON CONFLICT (competencia, estabelecimento_id) DO UPDATE for all JSONB fields.
4. MUST branch in `write_to_pg()`: when `meta["tipo_relatorio"] == "cadastro_individual"`, call `_write_cadastro_to_pg()` and return early — skipping `esus_indicadores_raw` writes.
5. MUST extract `cidadaos_ativos` from the "Dados gerais" section during preview mode (`--json-out`) and include it in the returned metadata dict.
6. MUST handle missing sections gracefully — if a section is absent in the CSV, leave the corresponding field as its default (0, [], or {}).
7. MUST store unrecognized sections in `populacao_cadastrada.extras` JSONB for forward compatibility.
8. MUST parse encoding correctly — CSVs are ISO-8859-1; the existing `open(path, encoding='latin-1')` pattern MUST be used.
9. MUST map "Condições / Situações de saúde gerais" section to `condicoes_saude` JSONB with keys: gestante, hipertensao, diabetes, fumante, acamado, avc_derrame, cancer, saude_mental, alcool, tuberculose, hanseniase — each as `{sim, nao, nao_informado}`.
10. MUST map "Faixa etária" section to `faixa_etaria` JSONB array with items `{faixa, masculino, feminino, indeterminado, nao_informado}` preserving CSV order.
</requirements>

## Subtasks

- [x] 2.1 Add `cadastro_individual` entry to `TIPO_RELATORIO_MAP` and `CADASTRO_SECTION_MAP` constant.
- [x] 2.2 Implement `_write_cadastro_to_pg()`: INSERT into `esus_cargas`, map sections to structured fields, UPSERT into `populacao_cadastrada`.
- [x] 2.3 Add branch in `write_to_pg()` to call `_write_cadastro_to_pg()` for `cadastro_individual` type.
- [x] 2.4 Extend preview/`--json-out` mode to extract and return `cidadaos_ativos` for `cadastro_individual`.
- [x] 2.5 Copy the three real e-SUS CSV fixture files to `tests/fixtures/cadastro-individual/`.
- [x] 2.6 Write 28 unit tests validating section parsing for all three fixture files.
- [x] 2.7 Write 2 integration tests: full pipeline to DB + CASCADE delete.

## Implementation Details

See TechSpec "Implementation Design — parse_esus_csv.py Changes" for `CADASTRO_SECTION_MAP` keys and `pop_row` dict structure. The `_write_cadastro_to_pg()` function follows the same psycopg2 connection pattern as the existing `write_to_pg()`. Key differences: no `esus_indicadores_raw` writes; structured JSONB columns instead of generic EAV rows; UPSERT uses `(competencia, estabelecimento_id)` conflict target.

The section header matching uses `normalize_key(section_name)` — this strips accents and replaces spaces/punctuation with `_`. Example: `"Identificação do usuário / cidadão - Faixa etária"` → `"identificacao_do_usuario_cidadao_faixa_etaria"`.

For the `condicoes_saude` section, each CSV row is `"Descrição;Sim;Não;Não informado;"` — map `parts[1]`, `parts[2]`, `parts[3]` to `sim`, `nao`, `nao_informado` respectively.

### Relevant Files

- `parse_esus_csv.py` — file to modify (TIPO_RELATORIO_MAP at line 36, write_to_pg at ~line 427)
- `C:\Planejamento\relatórios pec esus - janeiro2026\*.csv` — source fixture files to copy
- `simpa-backend/tests/fixtures/` — target for test fixtures

### Dependent Files

- `consolidate_dashboard.py` — task_04 relies on `carga_id` from `esus_cargas` inserted here
- `simpa-backend/src/services/populacaoService.js` — task_05 reads `populacao_cadastrada` rows written here
- `simpa-backend/src/routes/importacao.js` — task_08 uses `cidadaos_ativos` from preview metadata

### Related ADRs

- [ADR-001: Dedicated Population Table for Cadastro Individual Data](../adrs/adr-001.md) — Justifies `_write_cadastro_to_pg()` routing to `populacao_cadastrada` instead of EAV

## Deliverables

- Modified `parse_esus_csv.py` with new type, section map, and write function
- Fixture files in `simpa-backend/tests/fixtures/cadastro-individual/`
- Unit tests for section parsing and JSONB field mapping
- Integration test for full CSV → DB write flow
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for CSV → populacao_cadastrada write **(REQUIRED)**

## Tests

- Unit tests:
  - [ ] `TIPO_RELATORIO_MAP["Relatório de cadastro individual - Analítico"]` equals `"cadastro_individual"`
  - [ ] `parse_report(psf_alvorada_fixture)` returns `meta["tipo_relatorio"] == "cadastro_individual"` and `meta["cidadaos_ativos"] == 3337`
  - [ ] `parse_report(psf_alvorada_fixture)` returns `meta["cidadaos_ativos"] == 3337` in preview mode
  - [ ] `_write_cadastro_to_pg()` with PSF Jardim Brasil fixture inserts `populacao_cadastrada` row with `cidadaos_ativos == 6834`
  - [ ] `faixa_etaria` array for PSF JD Alvorada has 21 items; first item is `{"faixa": "Menos de 01 ano", "masculino": 31, "feminino": 26}`
  - [ ] `condicoes_saude["gestante"]["sim"]` == 24 for PSF JD Alvorada
  - [ ] `condicoes_saude["hipertensao"]["sim"]` == 313 for PSF JD Alvorada
  - [ ] `condicoes_saude["diabetes"]["sim"]` == 123 for PSF JD Alvorada
  - [ ] PA Luiza Tebaldi fixture (2 cidadãos) parses without error; `cidadaos_ativos == 2`
  - [ ] Missing section in CSV → corresponding field defaults to `[]` (faixa_etaria) or `{}` (condicoes_saude) without raising exception
  - [ ] Re-import of same unit + competência upserts (does not create duplicate `populacao_cadastrada` row)
- Integration tests:
  - [ ] Full parse → write_to_pg for PSF JD Alvorada: `esus_cargas` row created with `tipo_relatorio = 'cadastro_individual'`; `populacao_cadastrada` row created with correct `cidadaos_ativos`; `esus_indicadores_raw` has no new rows
  - [ ] ON DELETE CASCADE: deleting the `esus_cargas` row removes the `populacao_cadastrada` row
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `python parse_esus_csv.py <psf_alvorada_csv> --json-out` returns JSON with `tipo_relatorio: "cadastro_individual"` and `cidadaos_ativos: 3337`
- `python parse_esus_csv.py <psf_alvorada_csv> --pg-write --estabelecimento-id 5 --equipe-id 10` inserts into `populacao_cadastrada` without error
- `esus_indicadores_raw` table has no new rows after cadastro_individual import
