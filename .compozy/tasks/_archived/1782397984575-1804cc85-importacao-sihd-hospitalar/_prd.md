# PRD — SIHD Importation and Hospital Panel

**Feature:** `importacao-sihd-hospitalar`
**Version:** 1.0
**Date:** 2026-06-24
**Status:** Accepted
**Parent product:** SIMPA — Secretaria de Saúde de Americana/SP
**Inputs:** [`sih-aih-schema-for-llm.md`](../../../../sih-aih-schema-for-llm.md), SIA importation PRD (archived `importacao-sia-producao`), codebase survey

---

## Overview

SIMPA unifies health data for municipal planning teams. The SIA module (outpatient production) is already fully operational. The Hospital module (`hospitalar_sihd`) exists in the dashboard contract v3.1.0 as a stub that always returns `PENDING`. No hospitalization data is imported, no Hospital panel KPIs are displayed, and the Hospital profile in the panel is marked `pending` across all layouts.

SIHD (Sistema de Informações Hospitalares — Decisor) exposes two MySQL tables in the same `producao` database used by SIA: `s_aih` (one row per hospitalization/AIH) and `s_aih_pa` (procedure items per AIH). This feature completes the hospital data pipeline: import AIH data from MySQL by competência, persist in PostgreSQL, and power a full Hospital panel with managerial, epidemiological, and procedure KPIs.

**Primary beneficiaries:** Planning team that triggers imports and validates hospital production.
**Secondary beneficiaries:** Health managers who consume Hospital panel KPIs and future SIH reports.

---

## Goals

1. **Import SIHD hospitalization data by competência** from MySQL (`s_aih` + `s_aih_pa`) into PostgreSQL, reliably and repeatably.
2. **Link hospitalizations to registered establishments** via CNES → `estabelecimentos.codigo_externo`.
3. **Populate the Hospital module** in the dashboard contract so `hospitalar_sihd` reflects real AIH data after each sync.
4. **Deliver the full Hospital panel** (Layout A) with all KPI categories: managerial, epidemiological, clinical (CID-10), and procedure-level.
5. **Give planning staff full operational control** — choose year/month to import, see history, reimport when needed.
6. **Minimize PostgreSQL volume** by aggregating at the managerial grain in MySQL before writing.
7. **Preserve quality gates** — pytest/Jest/Playwright green; no regression in SIA or e-SUS pipelines.

**MVP = Phase 1.** Sync a single competência + full Hospital panel + history.

---

## User Stories

### Planning / Secretary of Health

- As a **planning analyst**, I want to select a year/month (e.g., Jan/2025) and import only that competência's AIH data so the Hospital panel stops showing "pending."
- As an **analyst**, I want the system to aggregate folhas and sequences and discard administrative line details so PostgreSQL stays lean.
- As an **analyst**, I want to see the last sync date, competência, and record count per import so I can audit failures or gaps.
- As an **analyst**, I want CNES to be resolved to registered establishments so Hospital panel filters align with SIA and e-SUS filters.
- As an **analyst**, if I try to import a competência already imported, I want a clear warning and an explicit option to **reimport (replace)** so I never accidentally duplicate data.
- As an **analyst**, I want to see both internalization headers (`s_aih`) and procedure items (`s_aih_pa`) imported together in a single operation.

### Health Manager (consumer)

- As a **manager**, when I open the Hospital panel for a synced competência, I want to see:
  - Total AIH, total diárias, total diárias UTI, total value
  - Average length of stay and average AIH cost
  - UTI occupancy rate (% diárias UTI / total diárias)
  - Mortality rate (óbitos motivo_saida 31/32 over total AIH)
  - Distribution by CID-10 chapter
  - Distribution by discharge reason (motivo_saída)
  - Distribution by complexity and financing (rubrica)
  - Top procedures from s_aih_pa (procedure, quantity, value, CBO)
- As a **manager**, if MySQL/XAMPP is unavailable, I want a message in Portuguese — not a stack trace.

### Developer / Agent

- As a **developer**, I want SIHD extraction queries documented in the schema reference (COLLATE utf8mb4_unicode_ci, FINANCIAMENTO 2-char, three-column JOIN) so future changes do not silently break aggregations.

---

## Core Features

### F1 — MySQL Extraction: s_aih (internalization headers) [Phase 1, MVP]

- **What:** Query `s_aih` with mandatory `WHERE COMPETENCIA = 'AAAAMM'` filter, aggregated at managerial grain: `competencia × CNES × PROC_PRINCIPAL × DIAG_PRINCIPAL × COMPLEXIDADE × FINANCIAMENTO × MOTIVO_SAIDA × SEXO_PACIENTE`.
- **Metrics aggregated:** `COUNT(DISTINCT AIH)` as `qtd_aih`; `SUM(DIARIAS)`, `SUM(DIARIAS_UTI)`, `SUM(VALOR_TOTAL_AIH)`, `AVG(IDADE)`, `AVG(DIARIAS)`.
- **Why:** `VALOR_TOTAL_AIH` is pre-calculated by SIHD; aggregating at this grain reduces PG rows by orders of magnitude while preserving all needed managerial dimensions.
- **Behavior:** Sync always receives `YYYY-MM`; converts to `AAAAMM` for MySQL filter.

### F2 — MySQL Extraction: s_aih_pa (procedure items) [Phase 1, MVP]

- **What:** Query `s_aih_pa` for the same competência, aggregated at `competencia × CNES × PROC_DETALHADO × CBO_PROFISSIONAL × FINANCIAMENTO_DETALHE`. Metrics: `COUNT(DISTINCT AIH)` as `qtd_aih_distintas`, `SUM(QUANTIDADE)`, `SUM(VALOR_ITEM)`.
- **Why:** Procedure-level data powers the "top procedures" KPI and CBO breakdown in the Hospital panel.
- **Behavior:** Same competência parameter as F1; sync extracts both tables in a single Python run.

### F3 — Establishment Resolution [Phase 1, MVP]

- **What:** Columns `cnes` and `estabelecimento_id` (FK, nullable) in both `sih_internacoes` and `sih_procedimentos`.
- **Why:** Hospital panel filters by `estabelecimento_id`; CNES text alone is insufficient for FK joins with establishments.
- **Behavior:** CNES without a match → `estabelecimento_id` NULL, `cnes` preserved; count of orphan CNES in sync response JSON.

### F4 — API, Authorization, and Reimport Gate [Phase 1, MVP]

- **What:**
  - `POST /api/sih/sincronizar` with `{ competencia, reimportar?: boolean }`.
  - If competência already imported and `reimportar !== true` → **409** with metadata (`competencia`, `sincronizado_em`, `qtd_aih`, `qtd_procedimentos`).
  - With `reimportar: true` → DELETE both tables for competência then reimport.
  - `GET /api/sih/sincronizacoes/existe?competencia=YYYY-MM` for pre-check without writing.
  - `GET /api/sih/sincronizacoes` — history list.
- **Why:** Identical gate pattern to SIA prevents accidental duplication and gives operators explicit control (ADR-001).
- **Auth:** `requirePlanningStaff` middleware — only planning staff can trigger sync.

### F5 — Operational UI: SIHD Import Section [Phase 1, MVP]

- **What:** New section in Cadastros (below `SiaProducaoSyncBanner` or parallel import area): year/month selector (default: previous month), **Import AIH** button, last sync metadata, ConfirmDialog on 409.
- **Behavior:** First import triggers directly; reimport only after explicit confirmation. Toast with `qtd_aih` gravadas + `qtd_procedimentos` + orphan CNES count.

### F6 — Hospital Panel: Layout A with Full KPIs [Phase 1, MVP]

- **What:** Activate Hospitalar profile in `catalogView.ts` (change `pending` → `ready` for Layout A). Define KPI widgets:
  - **Managerial:** total AIH, total diárias, total diárias UTI, total value, average length of stay, average AIH cost, UTI occupancy rate (%), mortality rate (%).
  - **Epidemiological:** distribution by CID-10 chapter (pie/bar), distribution by discharge reason (`motivo_saida`), distribution by complexity, distribution by financing rubrica.
  - **Procedures:** top procedures by value (from `sih_procedimentos`), procedure quantity vs value, top CBOs.
- **Behavior:** Layout A uses `painelMetricsService` dynamic widget engine. Hospital establishment filter via `estabelecimento_id` (same as SIA). Competência selector same as APS panel.

### F7 — Dashboard Consolidation: ModuloSIHD [Phase 1, MVP]

- **What:** Update `consolidate_dashboard.py` to populate `modulos.hospitalar_sihd` with real data: `status_importacao` (OK/PENDING/ERROR), summary metrics (total AIH, total value, pct_diarias_uti, taxa_mortalidade), `internacoes_por_capitulo_cid` array.
- **Why:** Module status badge "SIHD · AIH" in the panel header must reflect actual import state, not always-PENDING.
- **Behavior:** Consolidation runs after each successful SIHD sync (same pattern as SIA).

### F8 — Reference Dimensions: Rubricas and Formas SIH [Phase 2]

- **What:** Enrich SIHD queries with rubrica descriptions (from `rubricas_sia` already synced from `s_rub`) and procedure group hierarchy (from `formas_sia`). Add `descricao_rubrica` and `descricao_grupo` to Hospital panel aggregations.
- **Why:** Managers need readable labels, not numeric codes, on financing and procedure group dimensions.
- **Behavior:** Read from PG dimension tables already populated by `sync_cadastros_mysql.py`.

### F9 — Multi-Month Sync and SIH Reports [Phase 3]

- **What:** API `--meses N` parameter; basic SIH reports page (historical trends, cross-establishment ranking).
- **Why:** Year-over-year analysis and inter-hospital benchmarking.
- **Behavior:** Progress per competência; non-blocking UI.

---

## User Experience

### Primary Flow — Planning Staff

1. User opens **Cadastros** → **Importação SIHD** section.
2. Sees last SIHD sync date (cabeçalho and procedimentos) and record counts.
3. Selects **year/month** → clicks **Importar internações AIH**.
4. Loading state shown; on completion: toast with total AIH gravadas, procedimentos gravados, orphan CNES count.
5. If competência already imported → ConfirmDialog: "Competência YYYY-MM já importada (N internações). Substituir?" → Confirmar reimports; Cancelar aborts.
6. Manager opens **Painel** → switches to **Hospitalar** profile → Layout A shows all KPIs for the synced competência.
7. Module status badge "SIHD · AIH" turns green.

### UX Requirements

- Copy in Brazilian Portuguese.
- Competência format `YYYY-MM` consistent with the rest of SIMPA.
- Hospital panel filter by establishment uses the same `estabelecimento_id` FK as SIA and e-SUS panels.
- `data-testid` attributes on all interactive elements for Playwright.
- Error state for MySQL unavailable: "Banco SIHD (XAMPP) indisponível. Verifique a conexão e tente novamente."
- Separate visual distinction between "Atualizar cadastros SIA" and "Importar internações SIHD" to avoid user confusion.

---

## High-Level Technical Constraints

- MySQL `producao` database is read-only (XAMPP); PostgreSQL is the write target.
- Reuse the Python subprocess spawning pattern established in SIA sync (`etl_db.py`, `consolidator.js`).
- Compatible with dashboard contract **v3.1.0** — populate `modulos.hospitalar_sihd` without changing the schema version.
- `s_aih` fields `DIARIAS`, `DIARIAS_UTI`, `VALOR_TOTAL_AIH` are already `int`/`decimal` — no CAST required (unlike SIA's `s_prd` varchar fields).
- `FINANCIAMENTO` in `s_aih` is 2 chars, mapping directly to `RUB_ID` in `s_rub` — different from SIA's 4-char `PRD_RUB`.
- JOIN `s_aih ↔ s_aih_pa` must use three columns: `AIH + CNES + COMPETENCIA` with `COLLATE utf8mb4_unicode_ci`.
- JOIN with `forma` dimension requires `COLLATE utf8mb4_general_ci` (differs from s_aih/s_aih_pa collation).
- Must not alter SIA sync, e-SUS importation, or population registry pipelines.
- sync performance target: one competência extracted and written to PG in under 5 minutes in dev environment.

---

## Non-Goals (Out of Scope)

- Importing raw `s_aih`/`s_aih_pa` line-by-line (patient-level granularity).
- Uploading SIHD `.txt` files (TB_HAIH / TB_HPA) via browser — MySQL sync is sufficient.
- Importing the full historical SIHD dataset without a competência selector.
- Automatic scheduled (cron) sync in MVP.
- SIH reports page (Phase 3).
- Rewriting the e-SUS importation or SIA sync modules.
- Changing JWT roles beyond aligning SIHD sync to `requirePlanningStaff`.
- APAC, CNPJ, CNS médico, NF data — not imported from SIHD.
- Hospital Layouts B and C (only Layout A in MVP).

---

## Phased Rollout Plan

### Phase 1 — MVP

**Includes:** F1, F2, F3, F4, F5, F6, F7; migration 013 (PG tables); batch insert; Hospital Layout A; consolidation update; tests; docs agent.

**Success criteria:**
- Sync `2025-01` (or available competência in XAMPP) writes > 0 rows in `sih_internacoes` and `sih_procedimentos`.
- `estabelecimento_id` populated for known CNES.
- Hospital panel Layout A renders all KPI categories after consolidation.
- Module badge "SIHD · AIH" shows green for synced competência.
- ConfirmDialog appears on reimport attempt; reimport replaces data correctly.
- pytest + Jest + Playwright green.

### Phase 2 — Enriched Dimensions

**Includes:** F8; rubrica and forma descriptions in API and panel.

**Success criteria:** Hospital panel shows readable financing and procedure group labels, not raw codes.

### Phase 3 — Multi-Month and SIH Reports

**Includes:** F9; historical trend charts; inter-establishment ranking.

**Success criteria:** Planning team can analyze 12-month hospitalization trends from the SIMPA UI.

---

## Success Metrics

| Metric | Baseline | MVP Target |
|--------|----------|------------|
| Hospital panel after sync | Always PENDING | Real data for synced competência |
| Time to sync 1 competência | N/A | < 5 min dev environment |
| PG rows vs MySQL raw | N/A | ≥ 90% reduction via aggregation |
| CNES resolved to estabelecimento_id | 0% | > 90% of active establishments |
| Hospital Layout A KPI widgets | 0 (all pending) | All 4 KPI categories rendered |
| Automated tests | 0 SIHD-specific | 100% pass (pytest + Jest + Vitest + Playwright) |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Query timeout on large `s_aih` without competência filter | Mandatory `WHERE COMPETENCIA = ?` parameter; no full-table reads |
| COLLATE mismatch silently returning zero JOIN results | Explicit `COLLATE utf8mb4_unicode_ci` on all SIHD JOINs; COLLATE utf8mb4_general_ci on `forma` JOINs |
| `FINANCIAMENTO` treated as 4-char (SIA habit) | Documented: SIHD `FINANCIAMENTO` = 2 chars = `RUB_ID` directly |
| Slow batch insert for large competências | `execute_batch` / `COPY` with chunks of 1000 rows |
| MySQL/XAMPP unavailable | HTTP 503 with Portuguese message; no partial state written |
| s_aih_pa orphans (procedure items without s_aih header) | LEFT JOIN pattern; log count; non-blocking |
| Hospital panel KPI scope creep delaying MVP | Layouts B and C deferred; only Layout A in Phase 1 |

---

## Architecture Decision Records

- [ADR-001: Dual-Table Hybrid Storage + Full Hospital Panel MVP](adrs/adr-001.md) — Aggregate s_aih into `sih_internacoes` and keep s_aih_pa items in `sih_procedimentos`; deliver all KPI categories in Layout A MVP.

---

## Open Questions

1. Should the SIHD import section live inside **Cadastros** (same page as SIA sync banner) or in the **Importação** module (alongside e-SUS)?
2. Hospital panel default competência: previous month, or inherit from panel competência filter?
3. Should `ESPECIALIDADE` (3-char code from `s_aih`) be decoded to a readable label in the panel? No dimension table exists for it yet.
4. Phase 2: `DIAG_PRINCIPAL` (CID-10) — should the panel display the 4-char code with description (requires a CID-10 dimension table) or just the chapter letter grouping?
5. Orphan CNES threshold: should a high orphan count (e.g., > 20%) block the sync or only warn?
