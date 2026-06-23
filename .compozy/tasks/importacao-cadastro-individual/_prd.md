# PRD: Importação de Cadastro Individual e Denominadores de Indicadores

## Overview

SIMPA currently imports six e-SUS report types but has no support for the "Relatório de Cadastro Individual Analítico." This report is the primary source of the registered population snapshot per health unit — active citizen counts by age, sex, and health condition — and is the official denominator source for APS quality indicators. Without it, all 13 indicators in the dashboard display `"—"` for numerators and denominators, blocking the Americana/SP Health Secretariat from reporting SUS Paulista quality metrics for 2026.

This feature adds:
1. An import pipeline for cadastro individual CSVs (reusing the existing preview + de-para + upload flow).
2. Structured population data storage per competência and health unit.
3. Denominator calculation for all 13 quality indicators (C1, B1-B6, M1, M2, IGM-APS, IGM-PN, IGM-VAC, IGM-ICSAP).
4. A "População Cadastrada" section within the main Painel displaying demographic pyramid, health condition prevalence, and population summary.

## Goals

- Enable real numerator/denominator values for all 13 quality indicators by extracting population denominators from cadastro individual data.
- Allow planning staff to import cadastro individual CSVs for any competência using the familiar import UI, with the full batch (multiple units) completing in under 5 minutes.
- Display a population dashboard within the Painel that shows active citizen counts, age/sex pyramid, and health condition prevalence per unit and competência.
- Support Americana/SP Health Secretariat in meeting SUS Paulista co-financing quality indicator requirements effective January 2026.

## User Stories

### Planning Staff

- As planning staff, I want to upload cadastro individual CSV files for each health unit so that population data is available for indicator denominator calculations.
- As planning staff, I want the import preview to identify the health unit name and competência from the CSV header so that I can confirm the mapping before committing.
- As planning staff, I want to reuse my existing unit de-para mappings so that I do not need to remap units already registered in the system.
- As planning staff, I want the dashboard indicators to display real numerator and denominator values after import so that I can analyze team performance.
- As planning staff, I want to see a population summary per unit (active citizens, age pyramid, health conditions) within the Painel so that I can compare demographic profiles across units.
- As planning staff, I want to filter population data by competência and unit so that I can track changes in the registered population over time.

### Administrator

- As admin, I want to see when cadastro individual was last imported for each unit so that I can identify gaps in the data.
- As admin, I want re-imports for the same unit and competência to update the existing data rather than create duplicates.

## Core Features

### 1. Cadastro Individual Import (extends existing import pipeline)

The import UI at `/importacao` automatically detects a cadastro individual CSV by the report title in line 7 of the file. The existing preview + de-para + upload flow applies:

- **Preview**: displays report type ("Cadastro Individual"), health unit name from the CSV header, active citizen count (quick scan of "Dados gerais" section), competência derived from the "Data" filter field (e.g., `31/01/2026` → `2026-01`).
- **Mapping**: resolves the CSV unit name to an `estabelecimento_id` via the existing `esus_import_mapeamentos` de-para registry. New mappings can be saved.
- **Upload**: parses all sections, stores a new `esus_cargas` record (type `cadastro_individual`), and populates the dedicated population table. Re-import for the same unit + competência replaces the previous record (upsert).

Sections parsed and stored:
- **Dados gerais**: cidadãos ativos, saídas do cadastro.
- **Faixa etária × sexo**: all age bands (< 1 yr to ≥ 80 yrs) with masculino/feminino/indeterminado counts.
- **Sexo**: total by sex.
- **Raça/cor**: branca, preta, amarela, parda, indígena, não informado.
- **Condições de saúde**: hipertensão, diabetes, gestante, fumante, acamado, hanseníase, tuberculose, AVC/derrame, infarto, câncer, saúde mental, uso de álcool, uso de outras drogas, deficiência (total + subtypes).
- **Sociodemográfico** (summary only): escolaridade, ocupação, situação mercado de trabalho.

Unknown or future sections are preserved in an `extras` JSONB field for forward compatibility.

### 2. Denominator Engine for Quality Indicators

After each cadastro individual import, the consolidation step derives denominators for all 13 indicators and writes them into `dados_consolidados`. Mappings:

| Indicator | Denominator Source |
|-----------|-------------------|
| C1 — Acesso e Vínculo | cidadãos ativos total |
| B1 — HAS acompanhamento | cidadãos com hipertensão arterial (`sim`) |
| B2 — DM acompanhamento | cidadãos com diabetes (`sim`) |
| B3 — Pré-natal | cidadãs com `gestante = sim` from condicoes_saude |
| B4 — Saúde da mulher | women aged 25–64 from faixa etária × feminino |
| B5 — Saúde da criança | children aged 0–2 from faixa etária (sum of < 1, 1, 2 anos) |
| B6 — Imunização | children aged < 1 year from faixa etária |
| M1, M2 | cidadãos ativos total |
| IGM-APS | cidadãos ativos total |
| IGM-PN | cidadãs com gestante = `sim` |
| IGM-VAC | children aged < 2 years from faixa etária |
| IGM-ICSAP | cidadãos ativos total |

The dashboard contract `indicadores_qualidade` section in `dados_consolidados` is updated: `den` receives the calculated value; `num` continues to be derived from production reports (atendimento individual, procedimentos) as before.

### 3. Population Dashboard Section in Painel

A new "População Cadastrada" section within the main Painel (accessible via a tab or expandable card in the existing Painel layout) displays:

- **Summary cards**: cidadãos ativos, saídas do cadastro, filterable by unit and competência.
- **Demographic pyramid**: horizontal bar chart with age bands on the Y-axis and masculino (left) / feminino (right) counts.
- **Health conditions panel**: horizontal bar chart showing % of active citizens with each condition (HAS, DM, gestantes, fumante, AVC, saúde mental, etc.).
- **Race/color distribution**: donut or bar chart.
- **Comparison selector**: view a single unit or aggregate across selected units for a competência.

Data reflects the most recently imported cadastro individual for the selected unit + competência. If no data exists, a prompt guides the user to import the report.

## User Experience

### Import flow

1. User navigates to `/importacao` and selects one or more cadastro individual CSV files (one per unit).
2. System shows preview cards — one per file — identifying: type "Cadastro Individual", unit name, competência, and active citizen count.
3. Each card shows mapping status: "resolved" (unit already in de-para), "pending" (user must select from suggestions), or "blocked" (no match found).
4. User resolves any pending mappings and clicks "Importar".
5. System processes files sequentially and shows success/error per file.
6. On success, a banner confirms: "X unidades importadas. Dados de população disponíveis no Painel."

### Population panel

1. User opens the Painel and sees a new "População Cadastrada" tab (or expandable section) alongside existing widgets.
2. Default view: aggregate across all units for the most recent available competência.
3. User can filter by unit and competência via the existing Painel filter controls.
4. If cadastro individual has not been imported for the selected unit/competência, the section shows a "Dados não disponíveis — importe o relatório de cadastro individual" message with a link to `/importacao`.
5. Indicators section updates automatically to show `den` values derived from population data.

## High-Level Technical Constraints

- Must reuse the existing `/importacao` UI and preview+mapping+upload flow without breaking the six existing report types.
- CSV files from e-SUS PEC are encoded in ISO-8859-1 (Latin-1); the import pipeline must handle encoding conversion as it does for existing reports.
- Population data must be linked to `estabelecimento_id` (not raw unit name) to align with the existing cadastro data model.
- Re-import for the same `(estabelecimento_id, competencia)` must replace — not duplicate — population data.
- The population section in Painel must respect the existing perfil-based filtering (APS, MAC, etc.) and role-based access (planning staff and admin only).
- Aggregate view across multiple units must consolidate population counts correctly (sum faixas, merge condition counts).

## Non-Goals (Out of Scope)

- **IBGE census integration**: official population estimates from IBGE are not included in this feature; all denominators come from cadastro individual (registered population, not estimated population).
- **Individual citizen records**: only aggregated counts are stored; no individual-level data (LGPD compliance).
- **Cadastro domiciliar**: household registration report is a different report type, not included.
- **Real-time sync with e-SUS**: import remains manual CSV upload; no API pull.
- **Automatic scheduling**: no recurring import jobs or reminders.
- **ICSAP subcategory breakdown**: IGM-ICSAP denominator uses total active population; condition-specific ICSAP subcategory denominators are deferred.
- **Historical trend charts**: population pyramid compares a single competência at a time; multi-competência trend lines are Phase 2.
- **Per-team granularity**: population data is stored per unit (Equipe=Todas); per-team breakdown is not required and would need separate e-SUS exports per team, which is operationally disproportionate.
- **IBGE population estimates**: official IBGE census data as denominators is out of scope; all denominators derive from registered population in cadastro individual.

## Phased Rollout Plan

### MVP (Phase 1)

- Import pipeline: cadastro individual CSV accepted, parsed, and stored.
- **Multi-file upload**: user selects up to 25 CSV files at once (one per unit); system shows a preview card per file and resolves mappings in batch.
- Dados gerais (cidadãos ativos + saídas) and faixa etária sections stored.
- Preview shows unit + competência + active citizen count per file.
- De-para reuse for unit mapping; unresolved mappings shown as pending in batch view.
- Re-import upsert behavior (same unit + competência replaces previous record).
- Population summary cards in Painel (cidadãos ativos per unit/competência).
- Denominators for C1, IGM-APS, IGM-ICSAP (use total cidadãos ativos).

**Success criteria**: planning staff imports all 11–25 unit CSVs for one competência in a single session in < 10 minutes; Painel shows active citizen count per unit; C1, IGM-APS, IGM-ICSAP show numeric denominators.

### Phase 2

- Parse and store all health condition sections (HAS, DM, gestantes, etc.).
- Denominator engine for all 13 indicators.
- Indicators dashboard shows real `num`/`den` values for B1-B6, M1, M2, IGM-PN, IGM-VAC.
- Demographic pyramid chart in population panel.
- Health condition prevalence chart.

**Success criteria**: all 13 indicators show calculated denominators; pyramid and condition charts render correctly for each unit.

### Phase 3

- Race/color distribution chart.
- Sociodemographic summary (escolaridade, situação no mercado de trabalho).
- Multi-unit aggregate view with unit comparison.
- Warning banner when cadastro individual for current competência has not been imported for a unit.

**Success criteria**: complete population dashboard usable for monthly team performance meetings.

## Success Metrics

- 100% of 13 indicators display numeric `den` values (not `"—"`) after cadastro individual import for a competência.
- Import of 3 unit CSVs for one competência completes in under 5 minutes.
- Planning staff imports cadastro individual monthly without requesting technical support.
- Denominator values in SIMPA match the "Cidadãos ativos" figure in the source CSV with 0% variance (exact match).
- Population section adoption: planning staff views population panel at least once per imported competência.

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| e-SUS PEC updates change section names or CSV structure in a future version | Parser matches sections by header string; unknown sections stored in `extras` JSONB; missing sections leave fields null rather than crashing |
| Some health units in Americana do not generate cadastro individual reports (e.g., PA Luiza Tebaldi with 2 active citizens) | System accepts partial imports; indicators show denominator only for units with data; units without import show N/D |
| Managing 20+ CSV files per competência manually is operationally heavy for planning staff | Phase 3 may add multi-file drag-and-drop batch import; for MVP, sequential upload of 3–5 key units is acceptable |
| Competência mismatch: cadastro individual snapshot date (31/01/2026) does not match atendimento import date | Competência is derived from the CSV "Data" filter field; the denominator engine matches by competência when joining with production data; mismatch warning shown if no production data exists for same competência |

## Architecture Decision Records

- [ADR-001: Dedicated Population Table for Cadastro Individual Data](adrs/adr-001.md) — Store population data in structured `populacao_cadastrada` table rather than generic EAV, enabling simple denominator queries and visualization.

## Open Questions

- Should the population panel be a new tab in the existing Painel layout or an expandable card section within the current layout? (UI design decision for TechSpec.)
- What is the exact SUS Paulista formula and methodology note for each of the 13 indicators? (Needed to validate the denominator mappings in Phase 2 against official specifications.)
