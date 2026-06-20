# PRD — SIMPA Cadastros: MySQL Aggregation & Enrichment

**Feature:** `simpa-cadastros-sync`  
**Version:** 1.0  
**Date:** 2026-06-20  
**Status:** Accepted  
**Parent product:** SIMPA Fullstack Redesign  
**Inputs:** [producao.sql](../../../producao.sql), [SIMPA Task 16](../simpa/task_16.md), [Auth design spec Section 10](../../../docs/superpowers/specs/2026-06-16-simpa-redesign-auth-design.md), stakeholder clarification session 2026-06-20

---

## Overview

The SIMPA Cadastros module currently treats units, MAC providers, hospitals, and procedures as independent manual registries. The municipal production environment already maintains equivalent master data in the XAMPP/MySQL database (`prestador` for establishments, `procedimento` for SIGTAP catalog entries). This duplication forces the Planning Unit to re-enter information that billing and production systems already own, creating inconsistency between dashboards and SIA/SIH production.

This PRD redefines Cadastros as an **aggregation layer**: mirror authoritative MySQL master data, expose it read-only where synced, and allow SIMPA-specific enrichment only where planning needs extra context (hospital beds, specialties, authorizations). Teams, parliamentary amendments, and the indicators/metas catalog remain fully manual SIMPA cadastros because they do not exist in MySQL.

**Primary users:** Planning Unit staff (Gestor Secretaria, Planejamento profile) who maintain municipal health planning data and reconcile production against targets.

**Value:** One truth for establishments and procedures; zero redundant typing; planning views aligned with production identifiers.

---

## Goals

1. **Eliminate duplicate master-data entry** for establishments and SIGTAP procedures already present in MySQL.
2. **Unify establishment management** — one Establishments cadastro replacing separate Units, MAC Providers, and Hospitals cards.
3. **Preserve planning-specific data entry** only where MySQL has no source (teams, amendments, indicator/metas catalog, hospital enrichment).
4. **Give users control over refresh timing** via an explicit manual sync action (no background schedule in MVP).
5. **Reduce cadastros-related data drift** between SIMPA filters/dashboards and SIA production within one business day of user-triggered sync.

**Target:** Deliver as a redesign of Task 16 Cadastros UI and backend cadastro behavior, before Administration UI (Task 17) and production E2E (Task 18).

---

## User Stories

### Planning Unit analyst

- As a planning analyst, I want establishments to load from our production MySQL so that I never re-type CNES names and codes already used in SIA billing.
- As a planning analyst, I want to filter establishments by profile (APS, MAC, Hospitalar) so that I can manage each context without separate duplicate lists.
- As a planning analyst, I want to add hospital-specific details (bed counts, specialties, authorizations) on top of synced data so that hospital planning panels have context MySQL does not store.
- As a planning analyst, I want to trigger a cadastro refresh manually so that I control when master data updates after municipal SIA maintenance.
- As a planning analyst, I want procedures to reflect the municipal SIGTAP catalog from MySQL so that emendas and metas reference the same codes as production.

### Planning Unit coordinator

- As a coordinator, I want to manage teams manually because team structure comes from e-SUS and is not in the production MySQL cadastro.
- As a coordinator, I want to register parliamentary amendments and link them to SIGTAP targets so that execution tracking stays in SIMPA even though amendments are not in MySQL.

### Dashboard consumer (read-only)

- As a dashboard user, I want filter dropdowns for units/teams to reflect synced establishment names so that dashboard filters match production terminology.

---

## Core Features

### F1 — Unified Establishments cadastro (from MySQL `prestador`)

**Priority:** P0 — MVP

Replace separate Units, MAC Providers, and Hospitals cards with a single **Establishments** experience.

| Behavior | Detail |
|----------|--------|
| Source | MySQL `prestador` (read-only on sync) |
| Identity fields (locked) | Establishment code (`re_cunid`), name (`re_cnome`), type indicators (`re_tipo`, `tipouni`), CNPJ, active flag |
| Profile classification | Derive APS / MAC / Hospitalar profile from existing type fields; user can filter and view by profile |
| Enrichment fields (editable) | Hospital context: bed counts by type, specialties, authorizations/habilitações; optional internal planning notes |
| Create | Users cannot create establishments that do not exist in MySQL |
| Inactivate | Reflect MySQL `ativo`; SIMPA may hide inactive by default |
| UI | List + detail/enrichment panel; locked fields visually distinct from editable extensions |

### F2 — Procedures catalog mirror (from MySQL `procedimento`)

**Priority:** P0 — MVP

| Behavior | Detail |
|----------|--------|
| Source | MySQL `procedimento` (read-only) |
| Identity fields (locked) | SIGTAP code, description, reference values, financing metadata present in MySQL |
| Create / Edit / Delete | Not available for synced core fields |
| UI | Searchable read-only table; links to emendas/metas that reference codes |

### F3 — Manual cadastro sync action

**Priority:** P0 — MVP

| Behavior | Detail |
|----------|--------|
| Trigger | User clicks **“Update cadastros from SIA”** (or equivalent label) in Cadastros module |
| Scope | Refreshes Establishments and Procedures from MySQL |
| Feedback | Show last sync timestamp, record counts added/updated/deactivated, and errors if MySQL unavailable |
| Frequency | On demand only in MVP (no scheduled job) |

### F4 — SIMPA-native manual cadastros (unchanged scope, clarified ownership)

**Priority:** P0 — MVP

| Cadastro | Source | Editable |
|----------|--------|----------|
| Teams (Equipes) | e-SUS / manual | Full CRUD |
| Parliamentary Amendments (Emendas) | Manual | Full CRUD |
| Indicators / Metas catalog | Manual / Admin | Full CRUD (may live under Cadastros or Administração — see Open Questions) |

### F5 — Cadastros landing redesign

**Priority:** P0 — MVP

Replace six-card grid with a reduced set aligned to data ownership:

1. **Establishments** — unified, MySQL-sourced + enrichment  
2. **Procedures** — MySQL mirror, read-only  
3. **Teams** — manual  
4. **Parliamentary Amendments** — manual  
5. **Indicators & Metas** — manual catalog (or link to Admin module)

Cards for standalone Units, MAC Providers, and Hospitals are **removed**.

---

## User Experience

### Primary flow — Refresh master cadastros

1. User opens **Cadastros** from sidebar.
2. User clicks **Update cadastros from SIA**.
3. System shows progress, then summary (updated establishments count, procedures count, timestamp).
4. User opens **Establishments** — list reflects MySQL; locked fields show sync badge or read-only styling.

### Primary flow — Enrich a hospital establishment

1. User filters Establishments by **Hospitalar** profile.
2. User selects an establishment (e.g., municipal hospital already in `prestador`).
3. Detail view shows locked identity fields (code, name, CNES if mapped) and an **Enrichment** section.
4. User edits bed counts, specialties, authorizations; saves — only extension fields persist in SIMPA.

### Primary flow — Manage a team (unchanged intent)

1. User opens **Teams** card.
2. User creates/edits team linked to an establishment from the synced list (dropdown sourced from Establishments, not free text).

### UX principles

- **Visual distinction:** synced vs enriched vs manual fields must be obvious (icons, labels, disabled inputs).
- **No false affordances:** hide Create button on read-only catalogs; show sync action instead.
- **Empty enrichment:** hospital enrichment form may start blank — show helper text that data is planning-specific.
- **Error state:** if MySQL unavailable, show same degraded pattern as SIA production sync (`MySQL unavailable` message, last successful sync time).

---

## High-Level Technical Constraints

- Must read establishment and procedure master data from the **existing municipal MySQL/XAMPP production database** already used for SIA (`prestador`, `procedimento`) — no parallel manual master in SIMPA for those entities.
- Must remain **read-only toward MySQL** (consistent with existing SIA connector policy).
- Must preserve **compatibility with existing SIA production sync** — cadastro sync is a sibling capability, not a replacement for production import.
- Establishment identifiers used in SIMPA filters must remain stable across syncs (`re_cunid` as primary business key).
- Hospital enrichment data is **SIMPA-owned** and must survive re-sync of MySQL master fields without overwrite.
- LGPD: display only establishment/planning metadata required for municipal health management; no patient data from production tables in cadastros screens.
- Performance: cadastro sync should complete within a timeframe acceptable for interactive use (user waits on screen — target under 2 minutes for typical municipal catalog size; exact threshold in TechSpec).

---

## Non-Goals (Out of Scope)

- Creating or editing SIGTAP procedures directly in SIMPA.
- Creating establishments not present in MySQL `prestador`.
- Automatic/scheduled cadastro sync (MVP is manual trigger only).
- CNES national TXT/WebService import for beds and authorizations (Phase 2+ candidate).
- Team (`equipes`) import from e-SUS CSV — remains manual cadastro in this phase.
- Parliamentary amendment portal integration (InvestSUS/Ambiente Parlamentar) — remains manual.
- Row-level RBAC scoping by establishment (deferred per SIMPA MVP auth ADR-004).
- Hard-delete of synced records — deactivation follows MySQL `ativo` flag.
- Migrating historical manually-entered SIMPA units/procedures — addressed in rollout/migration notes in TechSpec, not in this PRD.

---

## Phased Rollout Plan

### MVP (Phase 1)

- Unified Establishments mirror + enrichment UI  
- Procedures read-only mirror  
- Manual sync action with status/history  
- Teams, Emendas, Indicators/Metas manual cadastros retained  
- Cadastros landing redesign (5 cards or 4 + admin link)  
- Deprecate duplicate Units / MAC / Hospitals CRUD  

**Success criteria:** Planning Unit confirms zero re-entry of establishment names and SIGTAP codes for records already in MySQL; sync action used successfully in UAT; Task 16 acceptance tests rewritten for new model.

### Phase 2

- CNES file import to pre-fill hospital enrichment (beds, specialties, authorizations)  
- Reconciliation assistant: match e-SUS CSV unit names to synced establishments  
- Sync history log with diff summary (what changed per run)  

**Success criteria:** Hospital enrichment mostly pre-filled; e-SUS import mismatch tickets reduced.

### Phase 3

- Optional scheduled sync + notification when MySQL catalog changes  
- Semi-automated emenda registration from transparency portals  
- Cross-check dashboard: establishments in production but missing from e-SUS teams  

---

## Success Metrics

| Metric | Target (90 days post-release) |
|--------|-------------------------------|
| Duplicate manual establishment entries | 0 new manual unit/MAC/hospital records created in SIMPA |
| Cadastro sync adoption | Planning Unit runs sync at least weekly |
| Filter name mismatch reports | 50% reduction in dashboard filter vs production name tickets |
| Time to refresh master catalog | User completes sync + verification in one session (< 15 min including review) |
| Hospital enrichment coverage | ≥ 80% of Hospitalar-profile establishments have bed/specialty data entered |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Users expect to create establishments in SIMPA | Onboarding copy + disabled Create; training for sync-first workflow |
| `prestador` type codes ambiguous for APS/MAC/Hospitalar | Workshop with municipal SIA operator to validate mapping before build |
| MySQL downtime blocks cadastro refresh | Reuse existing degraded-mode UX; show last sync timestamp |
| Existing Task 16 work discarded | Treat as prototype; communicate redesign rationale early |
| Hospital enrichment burden falls on Planning Unit | Phase 2 CNES import; start with highest-volume hospitals |
| e-SUS unit strings differ from `prestador` names | Phase 2 reconciliation; Open Question for MVP fallback |

---

## Architecture Decision Records

- [ADR-001: Unified Establishment Mirror from MySQL Prestador with Enrichment](adrs/adr-001.md) — Single Establishments cadastro from MySQL, locked sync fields, SIMPA enrichment, manual sync, manual Teams/Emendas/Indicators.

---

## Open Questions

1. **Type-code mapping:** What are the exact `re_tipo` / `tipouni` values in Americana's `prestador` table for APS vs MAC vs Hospitalar? (Requires export/sample from production DBA.)
2. **CNES field:** Does `re_cunid` map 1:1 to CNES in all cases, or should SIMPA display CNES separately if added later?
3. **Indicators/Metas placement:** Should the indicators/metas catalog live under Cadastros landing or only under Administração?
4. **Inactive establishments:** Show in default list with badge, or hide unless filter enabled?
5. **Migration:** What happens to records already manually created in PostgreSQL `unidades_saude`, `prestadores_mac`, `hospitais` before sync goes live?
6. **e-SUS name reconciliation (MVP):** If CSV import unit name ≠ `prestador` name, block import warning only, or offer mapping UI in MVP?

---

## Relationship to Current SIMPA Artifacts

This PRD **supersedes the cadastro requirements** in Task 16 and related sections of the main SIMPA PRD for synced entities. TechSpec and task breakdown should be updated via `cy-create-techspec` and new implementation tasks; ADR-003 (MySQL read-only) remains valid and extends to cadastro sync.

**MySQL reference schema (producao.sql):**

| MySQL table | SIMPA role after this PRD |
|-------------|---------------------------|
| `prestador` | Source for unified Establishments |
| `procedimento` | Source for read-only Procedures |
| `s_prd` | Production only (existing SIA sync — unchanged) |
| *(none)* | Teams — SIMPA manual |
| *(none)* | Emendas — SIMPA manual |
