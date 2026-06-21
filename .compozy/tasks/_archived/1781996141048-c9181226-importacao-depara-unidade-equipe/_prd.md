# PRD: e-SUS Import Unit & Team Mapping (De-para)

> **Workflow:** `importacao-depara-unidade-equipe`  
> **Status:** Approved product spec (ADRs merged 2026-06-20)  
> **Source ADRs:** [adr-001.md](adrs/adr-001.md), [adr-002.md](adrs/adr-002.md)

---

## Overview

SIMPA imports e-SUS APS analytic CSV reports to populate the APS Panel and future planning modules. Each CSV header carries a **free-text unit name** (e.g., `CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO`) that does not match the **registered establishment** in SIMPA cadastro (e.g., code `7169698`, name `CAFI - CENTRO DE ASSISTÊNCIA A FAMÍ`, profile APS).

**Current gap:** `esus_cargas` and `dados_consolidados` store only e-SUS text labels. The Panel filter uses `estabelecimentos.id`, resolves to registered names, and queries consolidated data by **string equality**—so charts stay empty after a successful import when names diverge.

**Solution (two pillars, merged from ADR-001 + ADR-002):**

1. **Mapping registry + preview gate** — persistent, editable de-para from e-SUS labels to cadastro records; block upload until resolved; suggest matches; auto-create teams (never establishments); enforce `"Todas"` rules.
2. **Cadastro keys on storage** — persist `estabelecimento_id` and `equipe_id` on import and consolidation so Panel filters and future Metas join by stable IDs, not fragile names.

**Primary users:** Planning staff (Administrador, Gestor Secretaria, Planejamento).

**Reference example:** e-SUS `CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO` → establishment `7169698` (APS); Panel filter on that establishment for competence `2026-01` must load dashboard data.

---

## Goals

- Every successfully processed import is linked to `estabelecimentos.id` (and `equipes.id` when team scope applies).
- Panel unit/team selection updates charts for the selected cadastro record without manual name alignment.
- Operators map an e-SUS label once; subsequent imports apply saved de-paras automatically.
- Missing teams are auto-registered under the mapped establishment; establishments are **never** auto-created from import.
- `"Todas"` aggregate imports follow explicit conflict rules per establishment and month.
- De-para registry remains editable by planning staff only.
- Zero new cargas with NULL `estabelecimento_id` after process completes (MVP).

---

## User Stories

### Planning analyst (primary)

- As a planning analyst, I want the system to suggest which registered establishment matches an e-SUS unit name so that I can confirm the link quickly without guessing codes.
- As a planning analyst, I want saved mappings applied automatically on the next import so that I do not repeat the same de-para every month.
- As a planning analyst, I want import blocked until every unknown unit/team in the batch is mapped so that no orphan production enters the Panel.
- As a planning analyst, I want to select a unit in the Panel filter and see the charts for that unit’s imported data so that I can monitor APS performance reliably.

### Planning administrator

- As a planning administrator, I want to edit or deactivate saved de-paras so that I can fix a wrong mapping without re-importing historical CSVs manually.
- As a planning administrator, I want only planning roles to manage de-paras so that cadastro integrity stays controlled.

### Future Metas user (secondary)

- As a metas owner, I want imported production keyed to the same `estabelecimento_id` / `equipe_id` used in `metas_financiamento` so that targets and actuals align by unit.

---

## Core Features

### 1. Persistent mapping registry (de-para) — ADR-001

| Mapping type | Source (e-SUS) | Target (SIMPA cadastro) |
|--------------|------------------|-------------------------|
| Unit | CSV header line 5 (`UNIDADE DE SAÚDE …`) | `estabelecimentos.id` (via selection; display `codigo_externo` + `nome`) |
| Team | Filter `Equipe` (INE + name, or `"Todas"`) | `equipes.id` scoped to mapped establishment |

- Apply saved mappings automatically on preview; show resolved target (code + registered name).
- First-time unknown labels: suggest candidates by name similarity; **require manual confirmation** before saving or processing.
- Planning staff only: create, update, deactivate mappings during import and in de-para management UI.
- Default UI location: **Importação** module, with link from Cadastros establishment detail.

**Rejected alternatives (ADR-001):**

- Session-only mapping without persistence — rejected (repeated monthly work, high error rate).
- Separate admin screen before any CSV upload — rejected (operators discover new e-SUS labels at export time).

### 2. Preview gate — ADR-001

- Detect unknown unit/team labels not covered by the registry.
- **Block “Process”** until every file in the batch has resolved unit and team linkage.
- If establishment not in cadastro: block with guidance to run MySQL cadastro sync (no auto-create).

### 3. Cadastro keys on import storage — ADR-002

De-para resolution runs **before write**; keys are set at import time, not inferred at query time.

| Layer | Today | Required |
|-------|-------|----------|
| `esus_cargas` | `unidade`, `equipe_nome` text only | + `estabelecimento_id` (required), `equipe_id` (required when team scope applies, including synthetic `"Todas"` team); retain e-SUS text for audit |
| `esus_indicadores_raw` | via `carga_id` | inherits keys through parent carga |
| `dados_consolidados` | UNIQUE `(competencia, unidade, equipe)` text | + `estabelecimento_id`, `equipe_id` as **authoritative** Panel/Metas dimensions; keep text for display |
| De-para registry | — | e-SUS label → IDs for reuse |

**Panel consumption:** filter and load dashboard by establishment/team **IDs**; registered names are display fields only.

**Metas alignment:** same IDs as `metas_financiamento.estabelecimento_id` / `equipe_id`.

**Rejected alternatives (ADR-002):**

- Name normalization only — rejected (fragile encoding; no Metas FK support).
- Resolve IDs only at query time via JOIN — rejected (duplicate logic; text-based consolidation uniqueness).

**Acceptance:** After import + consolidation, selecting establishment `7169698` in the Panel for `2026-01` returns dashboard data—not 404 from name mismatch.

### 4. Team auto-registration — ADR-001

- If CSV carries a specific team (INE + name) not in cadastro, **create** the team under the mapped establishment.
- Do **not** create establishments from e-SUS; map only to existing MySQL-synced cadastro.
- Auto-created teams remain editable in Cadastros like manual entries.

### 5. `"Todas"` business rules — ADR-001

Stakeholder rules (confirmed in brainstorming):

1. Accept `"Todas"` **only if** no specific-team import exists for that mapped establishment in the same competence month.
2. When importing with `"Todas"`, create or reuse a team named `"Todas"` linked to the mapped establishment (`equipe_id` required—no NULL sentinel for aggregate scope).
3. Before accepting a new import, check whether a prior `"Todas"` import exists for that establishment/month.
4. If a new import has a **specific team** and `"Todas"` already exists for the same establishment/month:
   - Warn explicitly (modal; describe cargas/consolidated rows to be removed).
   - Remove/replace `"Todas"` import and its consolidated dashboard row after user confirmation.
   - Proceed with specific-team import.

### 6. De-para management UI

- List saved mappings: e-SUS label, target establishment, target team, last used, edited by.
- Edit or deactivate; changes affect **future** imports only (no silent rewrite of historical cargas without explicit reprocess action).

---

## User Experience

### Primary flow: monthly import

1. Upload CSVs on Importação.
2. Preview: report type, competence, e-SUS unit label, team filter.
3. Known de-paras → show resolved establishment (code + name) and team.
4. Unknown labels → suggestions + manual pick; confirm saves de-para.
5. **Process** disabled until all rows resolved.
6. Process → persist carga with IDs → consolidate by IDs.
7. Panel → select competence + establishment from cadastro filter → charts update.

### `"Todas"` conflict flow

1. Import with `"Todas"` → team `"Todas"` created/reused → aggregate carga stored.
2. Later same month, import with specific team → warning → user confirms removal of `"Todas"` data → specific import proceeds.

### Error states

- Establishment missing from cadastro → block + link to cadastro sync.
- `"Todas"` vs specific team conflict → confirmation modal before replacement.
- Wrong mapping accepted → editable de-para; show code + name prominently at confirm time.

---

## High-Level Technical Constraints

- Integrate with `estabelecimentos` (MySQL mirror) and `equipes` (manual + import-created).
- Persist `estabelecimento_id` / `equipe_id` on `esus_cargas` and `dados_consolidados`; retain e-SUS text.
- Revisit UNIQUE constraints toward `(competencia, estabelecimento_id, equipe_id)` (TechSpec).
- Planning-staff role gate aligned with Cadastros edit permissions.
- Historical rows may remain ID-null until Phase 2 backfill; **new** imports must not complete with NULL establishment key.
- Municipality: Americana/SP.

---

## Non-Goals (Out of Scope)

- Auto-creating establishments from e-SUS or CNES XML inside SIMPA.
- Replacing MySQL cadastro sync as source of establishment identity.
- Bulk historical backfill without operator confirmation (Phase 2 optional wizard).
- Full Metas module (only shared ID contract).
- Report types beyond current five e-SUS analytic exports.
- Fuzzy auto-mapping without user confirmation on first use.

---

## Phased Rollout Plan

### MVP (Phase 1)

- De-para registry + preview gate + suggestions.
- `estabelecimento_id` / `equipe_id` on import and consolidation.
- Panel filter by ID for new imports.
- Team auto-create; `"Todas"` rules.
- De-para list/edit (planning staff).

**Exit criteria:** CAFI `2026-01` import; Panel on `7169698` shows charts; second upload of same e-SUS label skips mapping step.

### Phase 2

- Backfill wizard for legacy cargas missing IDs.
- Dashboard API: explicit `estabelecimento_id` / `equipe_id` query params (names fallback only).
- Import history: e-SUS label vs cadastro name side by side.

### Phase 3

- Metas reads production by shared IDs.
- De-para audit trail (who/when).
- Bulk export/import of de-para registry.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Panel filter hit rate (mapped imports) | ≥ 95% return data for selected establishment |
| Mapping reuse (recurring labels) | ≥ 80% zero new mapping steps after first month |
| Time to import (5-file batch, excl. first mapping) | Median ≤ 5 min |
| Data integrity | 0 new cargas with NULL `estabelecimento_id` |
| Support: “import OK, Panel empty” | Material reduction within one release |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Wrong mapping confirmed | Editable de-para; code + name at confirm |
| Establishment not in cadastro | Block + cadastro sync guidance |
| `"Todas"` replacement surprises user | Explicit modal listing removed cargas |
| Two names (e-SUS vs cadastro) confuse operators | Show both in preview and history |
| Legacy rows without IDs | Phase 2 backfill; MVP blocks new NULL keys |
| UNIQUE constraint drift (text vs ID) | Migrate to ID-based uniqueness in TechSpec |

---

## Architecture Decision Records

The following decisions are **canonical in this PRD**. Full ADR files remain in `adrs/` for Compozy traceability.

### ADR-001: Mapping Registry with Preview Gate

**Status:** Accepted · **Date:** 2026-06-20

**Context:** e-SUS unit names in CSV headers do not match MySQL-mirrored establishment names; no link exists today between import staging and cadastro.

**Decision:**

- Persist editable de-para (unit + team) reused on future imports.
- Preview: apply saved mappings; suggest + confirm unknowns; block Process until resolved.
- Auto-create missing teams under mapped establishment; never auto-create establishments.
- `"Todas"` rules as in Core Feature 5.
- Permissions: Administrador, Gestor Secretaria, Planejamento only.

**Consequences:** Operators map once per e-SUS label variant; first import for new labels requires manual step; `"Todas"` replacement may remove consolidated rows—user must confirm.

**File:** [adrs/adr-001.md](adrs/adr-001.md)

---

### ADR-002: Cadastro Keys on Import and Consolidation Storage

**Status:** Accepted · **Date:** 2026-06-20

**Context:** Panel filters by `estabelecimentos.id` but dashboard queries `dados_consolidados` by text `unidade`/`equipe`. Metas already uses `estabelecimento_id` / `equipe_id`. Schema comment anticipated FK on `esus_cargas` but was never implemented.

**Decision:**

- Add `estabelecimento_id` (required after mapping) and `equipe_id` (when team scope applies) to `esus_cargas` and `dados_consolidados`.
- De-para (ADR-001) resolves IDs before write; consolidation and Panel query by IDs.
- Retain original e-SUS strings for audit and de-para matching keys.

**Consequences:** Requires schema migration and pipeline updates; legacy rows need backfill (Phase 2); Panel and Metas share one identifier model.

**File:** [adrs/adr-002.md](adrs/adr-002.md)

---

## Open Questions

| Question | Default proposal |
|----------|------------------|
| Re-consolidate on de-para edit? | Prompt operator; do not auto-reprocess silently |
| UX copy for `"Todas"` removal warning | Portuguese review in implementation |
| TechSpec: exact migration number and UNIQUE migration | Deferred to `cy-create-techspec` |

---

## References

- `docs/agent/backend-api.md` — Importação endpoints
- `docs/agent/cadastros.md` — estabelecimentos, equipes
- `docs/agent/database.md` — schema overview
- `schema_full.sql` — `esus_cargas`, `dados_consolidados`
- `scripts/cadastros_legacy_match.py` — prior codigo/CNES match pattern
