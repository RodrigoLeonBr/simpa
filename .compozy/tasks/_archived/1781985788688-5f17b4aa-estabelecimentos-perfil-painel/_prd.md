# PRD — Establishment Profile, Enrichment & Multi-Profile Painel

**Feature:** `estabelecimentos-perfil-painel`  
**Version:** 1.0  
**Date:** 2026-06-20  
**Status:** Accepted  
**Parent product:** SIMPA Fullstack Redesign  
**Inputs:** Stakeholder session 2026-06-20, archived [simpa-cadastros-sync PRD](../_archived/1781967665702-a4fca8ed-simpa-cadastros-sync/_prd.md), existing Painel layouts A/B/C

---

## Overview

SIMPA mirrors municipal establishment master data from production MySQL into a unified **Establishments** cadastro. Today, the **Perfil** field (APS, MAC, Hospitalar, Misto, Outro) is derived at sync time and locked in the UI — even though it does not exist as a native MySQL column and is often wrong for local planning needs. Enrichment (beds, specialties, authorizations) is limited to Hospitalar/Misto, while the **Painel** loads only APS units and offers layout switchers A/B/C without letting managers choose which care-level profile they are monitoring.

This PRD makes **Perfil a first-class planning attribute**: editable in Cadastros, preserved across MySQL sync, driving profile-specific enrichment and profile-aware unit lists. It extends the **Painel** with a profile selector (APS, MAC, Hospitalar, Misto) orthogonal to layouts A/B/C, each combination showing **distinct indicator catalogs** sourced from establishments registered under that profile.

**Primary users:** Planning Unit staff (Planejamento, Gestor Secretaria) and municipal health managers who classify establishments, enrich planning context, and monitor performance by care level.

**Value:** Correct establishment taxonomy, richer planning metadata per profile, and a Painel that reflects how Americana's health system is actually organized — APS first in MVP, then MAC, Hospitalar, and Misto.

---

## Goals

1. **Enable manual Perfil correction** so planning staff can fix misclassified establishments without re-entering MySQL data.
2. **Protect user classification on sync** — MySQL refresh updates identity fields but does not overwrite edited Perfil.
3. **Offer profile-specific enrichment** in Cadastros for APS, MAC, Hospitalar, and Misto.
4. **Unify Painel unit scope** with the establishment registry filtered by selected profile.
5. **Introduce profile × layout dashboard views** with fully distinct KPI sets per profile.
6. **Deliver complete APS indicator packs in MVP** (layouts A, B, C); ship MAC, Hospitalar, and Misto indicator packs in Phase 2.

**Target:** Cadastros changes in MVP Phase 1; Painel profile selector and APS-complete dashboards in MVP Phase 1; remaining profile indicator catalogs in Phase 2.

---

## User Stories

### Planning analyst

- As a planning analyst, I want to edit an establishment's Perfil when the auto-derived value is wrong so that filters and dashboards group units correctly.
- As a planning analyst, I want my Perfil edits to survive the next MySQL sync so that I do not repeat corrections after every refresh.
- As a planning analyst, I want to add APS-specific planning notes and attributes on APS establishments so that primary-care context is captured where MySQL is silent.
- As a planning analyst, I want to enrich MAC and Hospitalar establishments with fields relevant to each profile so that planning data matches how each unit operates.
- As a planning analyst, I want the establishments list tabs (APS, MAC, Hospitalar) to show only matching profiles so that I work in the right context.

### Planning coordinator / Gestor Secretaria

- As a coordinator, I want the Painel to list units from the establishment cadastro for the profile I select so that rankings and tables match registered establishments.
- As a coordinator, I want to switch between APS, MAC, Hospitalar, and Misto on the Painel and see indicator sets meaningful to that care level so that I do not interpret APS metrics when reviewing hospitals.
- As a coordinator, I want layouts A (Cards), B (Foco), and C (Tabela) available for each profile so that I keep my preferred visual style while changing care-level context.
- As a coordinator, I want a complete APS dashboard in the first release so that primary-care monitoring is production-ready while other profiles are being defined.

### Dashboard consumer (read-only)

- As a dashboard user, I want unit names in Painel filters to match establishment names in Cadastros so that terminology is consistent across SIMPA.

---

## Core Features

### F1 — Editable Perfil in Establishments cadastro

**Priority:** P0 — MVP

| Behavior | Detail |
|----------|--------|
| Who can edit | Administrador, Gestor Secretaria, Planejamento |
| Allowed values | APS, MAC, Hospitalar, Misto, Outro |
| UI | Perfil field editable in establishment detail drawer; visually distinct from locked SIA identity fields |
| Sync behavior | MySQL re-sync **preserves** user-edited Perfil; updates codigo, nome, CNPJ, tipouni, status, etc. |
| Initial value | On first import, Perfil still derived from `tipouni` mapping; user may override afterward |
| List filter | Existing profile chips (Todos, APS, MAC, Hospitalar) continue to filter the grid |

### F2 — Profile-specific enrichment

**Priority:** P0 — MVP

Replace hospital-only enrichment with **per-profile enrichment schemas** stored in the existing enrichment payload, keyed by profile at save time.

| Profile | Minimum enrichment themes (product-defined; exact fields in TechSpec workshop) |
|---------|--------------------------------------------------------------------------------|
| **APS** | Territorial notes, population coverage hints, e-SUS linkage notes, planning priorities |
| **MAC** | Medium-complexity capability tags, referral relationships, authorization notes |
| **Hospitalar** | Bed counts by type, specialties, habilitações, capacity notes (extends current hospital form) |
| **Misto** | Combined subset: beds where applicable + ambulatory/MAC notes |
| **Outro** | Free-form planning notes only |

| Behavior | Detail |
|----------|--------|
| Visibility | Enrichment section shown for all profiles except where empty schema applies |
| Validation | Required formats enforced per profile (e.g., non-negative bed counts for Hospitalar) |
| Read-only users | See enrichment; cannot edit |

### F3 — Painel profile selector

**Priority:** P0 — MVP (selector + APS data); P1 (full MAC/Hospitalar/Misto indicators)

| Behavior | Detail |
|----------|--------|
| Selector options | APS, MAC, Hospitalar, Misto |
| Placement | Painel header alongside existing layout switcher A/B/C |
| Unit source | Active establishments where `perfil` matches selection |
| Global filters | Competência, unidade, equipe respect selected profile's unit list |
| Outro establishments | Excluded from Painel profile tabs; visible only in Cadastros |

### F4 — Profile × layout indicator catalogs

**Priority:** P0 — APS complete; P1 — MAC, Hospitalar, Misto

Each profile has **its own KPI definitions** for layouts A, B, and C. Metrics are not shared labels with different values — APS "Cobertura APS" and Hospitalar "Taxa de ocupação" are different concepts.

| Layout | Behavior per profile |
|--------|---------------------|
| **A · Cards** | Profile-specific KPI grid, trend chart, unit ranking |
| **B · Foco** | Profile-specific hero metric, secondary KPIs, side panel |
| **C · Tabela** | Profile-specific columns per unit row |

**MVP (Phase 1):** Full APS catalogs for A, B, C using data already available in the dashboard contract and e-SUS/SIA aggregates.

**Phase 2:** Approved catalogs for MAC, Hospitalar, Misto; until then, non-APS profiles show unit lists and a clear "indicadores em definição" state rather than APS placeholders.

### F5 — Misto as first-class profile

**Priority:** P1 (selector in MVP; indicators Phase 2)

Establishments classified as Misto appear **only** under the Misto Painel profile, not duplicated under APS and Hospitalar simultaneously. Cadastros Misto chip/filter supported in a follow-up if not in MVP grid chips.

---

## User Experience

### Cadastros — Establishments flow

1. User opens **Cadastros → Estabelecimentos**.
2. User selects profile chip (APS, MAC, Hospitalar) or Todos.
3. User opens a row → detail drawer shows locked SIA fields + **editable Perfil** dropdown.
4. User changes Perfil → saves → list refreshes under correct chip.
5. Enrichment form adapts to current Perfil (hospital beds hidden for APS; APS fields shown for APS).
6. User triggers MySQL sync from Cadastros banner → identity fields update; Perfil unchanged if previously edited.

### Painel flow

1. User opens **Painel**.
2. User selects **profile** (default: APS) and **layout** (default: A).
3. Unit dropdown and ranking/table pull establishments for that profile.
4. KPI cards, charts, and table columns reflect the **APS indicator catalog** (MVP).
5. User switches to MAC → layout persists; units update; Phase 1 shows coming-soon indicator state.
6. User switches layout B or C within APS → same profile, different visual emphasis, APS-specific metrics throughout.

### Discoverability & accessibility

- Profile selector and layout switcher are sibling controls with clear labels.
- Locked vs editable fields use existing Cadastros visual language (lock icon, hints).
- Non-APS Painel states must not look like errors — use informative empty states.

---

## High-Level Technical Constraints

- Establishment registry remains the single source for establishment identity; MySQL sync stays read-only for identity fields.
- Perfil preservation on sync is a **business rule**, not a user preference toggle.
- Painel must continue to support competência filtering and existing global filter bar behavior.
- Role gating for edits aligns with existing SIMPA profiles (Administrador, Gestor Secretaria, Planejamento).
- LGPD: enrichment must not store identifiable citizen data — planning metadata only.

---

## Non-Goals (Out of Scope)

- Automatic Perfil suggestion from machine learning or CNES rules engine.
- Creating establishments that do not exist in MySQL.
- Background scheduled sync (manual sync remains user-triggered).
- Full MAC/Hospitalar/Misto indicator definitions in MVP Phase 1.
- Replacing layout switcher A/B/C with profile-only views.
- CNES validation against national SCNES API in this initiative.
- Editing `tipouni` or other locked SIA fields in SIMPA.

---

## Phased Rollout Plan

### MVP — Phase 1

**Cadastros (complete)**

- Editable Perfil with role restrictions.
- Sync preserves manual Perfil.
- Profile-specific enrichment forms for APS, MAC, Hospitalar, Misto, Outro (minimum field sets).
- Profile filter chips on list.

**Painel (APS-complete)**

- Profile selector: APS, MAC, Hospitalar, Misto.
- Unit lists from establishments by profile.
- Layouts A, B, C with **full APS indicator catalogs**.
- MAC, Hospitalar, Misto: selector + units + explicit "indicadores em definição" UX.

**Success criteria to proceed to Phase 2**

- Planning staff correct Perfil on ≥5 real establishments without sync rollback.
- APS Painel layouts reviewed and accepted by Gestor Secretaria.
- Enrichment saved per profile without validation errors in UAT.

### Phase 2 — MAC, Hospitalar, Misto indicator packs

- Workshop with Planning Unit to define KPI catalogs per profile.
- Ship layouts A/B/C for MAC, then Hospitalar, then Misto.
- Add Misto filter chip on Cadastros list if not delivered in Phase 1.
- Remove placeholder states on non-APS profiles.

**Success criteria**

- Each profile has signed-off indicator list and UAT sign-off.
- Managers use profile selector weekly without support tickets on wrong metrics.

### Phase 3 — Refinement

- Cross-profile municipal summary view (optional executive rollup).
- Enrichment-driven hints on Painel (e.g., bed capacity badge on Hospitalar rows).
- Export/reporting by profile.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Perfil corrections without re-sync loss | 100% preserved after manual edit + sync |
| Establishments with enrichment by profile | ≥60% of Hospitalar/Misto active rows within 90 days of launch |
| APS Painel weekly active users (Planning roles) | ≥3 distinct users/week |
| Support tickets "wrong unit type on dashboard" | ↓50% within 60 days of Phase 1 |
| Time to find establishments by profile in Cadastros | ≤30 seconds (task-based UAT) |
| Phase 2 indicator approval | Signed catalog per profile before development starts |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Users expect full MAC/Hospitalar dashboards at launch | Phase 1 messaging; disabled/placeholder states with roadmap visibility |
| Perfil drift from SIA `tipouni` causes reporting confusion | Show read-only `tipouni` alongside editable Perfil; audit log of Perfil changes (future Admin enhancement) |
| Four enrichment schemas overwhelm users | Start with minimum fields per profile; expand in Phase 2 based on feedback |
| Misto establishments poorly defined | Misto profile tab + Cadastros guidance text; coordinator workshop |
| APS indicator scope creep delays MVP | Freeze APS catalog before build; defer MAC/Hospitalar/Misto per stakeholder decision |

---

## Architecture Decision Records

- [ADR-001: Editable Establishment Profile with Phased Multi-Profile Dashboard](adrs/adr-001.md) — Cadastro-first editable perfil, sync preservation, profile selector on Painel, APS-complete MVP with phased indicator catalogs.

---

## Open Questions

1. **APS enrichment field list** — Exact fields for APS/MAC/Misto enrichment require a 1-hour workshop with Planejamento before TechSpec finalization.
2. **Misto Cadastros chip** — Should "Misto" appear as a fifth list filter chip in MVP or only in the detail Perfil dropdown until Phase 2?
3. **Outro on Painel** — Confirm Outro establishments never appear on Painel (current decision: Cadastros only).
4. **Perfil change audit** — Is a visible audit trail in Administração required in Phase 1 or defer to Administration enhancements?
5. **APS indicator catalog sign-off** — Who approves the frozen APS KPI list (Gestor Secretaria only, or Planejamento + Gestor)?

---

**Next step:** Create Technical Specification with `cy-create-techspec` from this PRD.
