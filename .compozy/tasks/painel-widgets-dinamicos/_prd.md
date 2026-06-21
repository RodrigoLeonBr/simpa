# PRD — Dynamic Painel Indicators (Cadastro + Runtime)

**Feature:** `painel-widgets-dinamicos`  
**Version:** 1.0  
**Date:** 2026-06-20  
**Status:** Accepted  
**Parent product:** SIMPA — Secretaria de Saúde de Americana/SP  
**Inputs:** Brainstorm 2026-06-20, [`_idea.md`](_idea.md), design spec, implementation backlog plan

---

## Overview

SIMPA's managerial **Painel** gives municipal health leaders a filtered view of APS production by competência and establishment. Today, the APS Layout A screen always shows the same six KPI cards and two charts; their labels and data bindings are fixed in application code. When the Planning Unit needs to highlight a different e-SUS metric or reorder indicators for a management meeting, the change requires a developer and a new release.

This feature introduces **configurable Painel indicators**: planning staff register and arrange widgets (cards and charts) from a **discoverable metric catalog** sourced from imported e-SUS and municipal data. All authenticated users continue to use existing competência and unidade filters; only Administrador and Planejamento roles may change what the Painel displays.

**Primary users:** Planning analysts and coordinators (Planejamento, Gestor Secretaria) who curate what managers see; secondary users are dashboard consumers (Gestor, Visualizador) who benefit from a Painel that reflects local priorities without code changes.

**Value:** Operational autonomy for the Planning Unit, faster alignment of the Painel with PAS/programmatic priorities, and transparent metric definitions — while preserving today's APS Layout A experience as the default starting point.

**Phase 0 (complete):** Database tables and seed records mirror the current six cards and two charts; the live Painel is unchanged.

---

## Goals

1. **Enable planning staff to configure APS Layout A widgets** — choose metric, widget type (card or chart), title, and order — without IT intervention.
2. **Deliver a dynamic APS Painel in the same MVP release** — managers see the same layout structure, powered by configured widgets and live data, with parity to today's default seed.
3. **Provide a governed metric catalog** — flat list of discoverable metrics from e-SUS imports, with human-readable labels and visible query logic for admins.
4. **Restrict configuration to trusted roles** — Administrador and Planejamento only; all other roles read the resulting Painel.
5. **Preserve existing filters** — competência, unidade, and equipe continue to scope widget values consistently.

**MVP success criterion (stakeholder confirmed):** Cadastro editability and dynamic Painel delivery are **equal priority** in Phase 1 — both must ship together.

**Target:** MVP Phase 1 functional release after Phase 0 schema; Layouts B/C and non-APS profiles in Phase 2.

---

## User Stories

### Planning analyst

- As a planning analyst, I want to see all metrics available from our e-SUS imports in one searchable list so that I can pick the right production indicator for a Painel card without knowing internal report section names by heart.
- As a planning analyst, I want to add, edit, reorder, and deactivate widgets on the APS Layout A Painel so that the opening screen matches what leadership asked to monitor this quarter.
- As a planning analyst, I want to preview a widget's value for a test competência and unit before saving so that I do not publish a broken indicator.
- As a planning analyst, I want to view the query logic behind a metric so that I can explain a number to the Secretário with confidence.
- As a planning analyst, I want to refresh the metric catalog after new CSV imports so that newly appeared e-SUS rows become selectable.

### Planning coordinator / Gestor Secretaria

- As a coordinator, I want Painel changes made by my team to appear for all dashboard users immediately so that we do not maintain parallel "draft" and "live" versions in MVP.
- As a coordinator, I want the default APS Painel to match today's six cards and two charts until we intentionally change it so that managers notice no regression on day one.
- As a coordinator, I want only Planning and Admin roles to edit indicator configuration so that casual users cannot alter executive views.

### Dashboard consumer (Gestor, Visualizador)

- As a dashboard user, I want the Painel to respect my competência and unidade filters when showing configured widgets so that numbers stay consistent with what I already trust.
- As a dashboard user, I want cards and charts to show "not apurado" when data is missing so that I am not misled by zero placeholders.

### Administrator

- As an administrator, I want configuration changes audited so that we can trace who changed the Painel composition and when.

---

## Core Features

### F1 — Metric catalog (discoverable flat list)

**Priority:** P0 — MVP

| Behavior | Detail |
|----------|--------|
| Content | Metrics derived from e-SUS import lineage (report type, section, row description, value field), plus consolidated and placeholder entries |
| Discovery | Manual "refresh catalog" action after imports in MVP; scans existing loaded data and adds or updates entries |
| Display | Flat searchable list with label, source type, last seen date, occurrence count |
| Transparency | Each metric exposes its query logic to Planning/Admin in read-only form |
| Default | Seed includes metrics equivalent to current Layout A bindings |

### F2 — Widget configuration (Cadastro)

**Priority:** P0 — MVP

| Behavior | Detail |
|----------|--------|
| Location | New entry under Cadastros (replacing or alongside the current external "Indicadores e Metas" card) |
| Scope | Perfil APS, Layout A only in MVP |
| Widget types | Card, line chart (time series), ranking bar chart (top units) |
| Fields | Title, optional subtitle, display format (number, fraction, text), linked metric, optional sparkline metric for cards |
| Ordering | Explicit sort order for grid placement |
| Permissions | Create/update/delete/reorder: Administrador, Gestor Secretaria, Planejamento |
| Preview | Test competência + optional unit before save |
| Lifecycle | Soft deactivate; changes visible to all users immediately upon save (no separate publish step in MVP) |

### F3 — Dynamic APS Layout A Painel

**Priority:** P0 — MVP

| Behavior | Detail |
|----------|--------|
| Rendering | Painel loads widget configuration and resolved values for active filters |
| Layout | Maintains current visual grid: six card slots + two chart panels (widget count fixed to seed parity in MVP; variable count deferred) |
| Filters | Reuses existing competência, unidade, equipe, and painelPerfil APS selector |
| Fallback | If configuration unavailable, fall back to current hardcoded Painel behavior to avoid blank screens |
| Coexistence | SIA/SIHD module status bar and non-APS profile placeholders remain unchanged |

### F4 — Metric value resolution

**Priority:** P0 — MVP

| Behavior | Detail |
|----------|--------|
| Scoping | Values respect competência; when unidade/equipe selected, scope to establishment/equipe identifiers |
| Null handling | Missing data displays as "—" / "Não apurado" consistent with current KPI cards |
| Derived displays | Fraction widgets (e.g., metas atingidas X/Y) combine two catalog metrics |
| Sparklines | Cards may show mini trend from historical metric binding |
| Delta labels | Month-over-month delta on cards where configured (parity with current atendimentos/odonto behavior) |

### F5 — Audit and governance

**Priority:** P1 — MVP

| Behavior | Detail |
|----------|--------|
| Audit | Log create/update/delete/reorder of widgets |
| Safety | End users cannot author arbitrary queries; only approved catalog templates execute |

---

## User Experience

### Cadastro journey (Planning staff)

1. Open **Cadastros → Indicadores do Painel** (working title).
2. Select context **APS · Layout A** (fixed in MVP).
3. See ordered list of eight default widgets matching today's Painel.
4. Edit a widget: change title, pick a different metric from catalog search, open **Query detail** panel (read-only).
5. Click **Preview** with competência 2026-05 and optional UBS → see sample value.
6. Save → success toast; return to list.
7. Optionally run **Atualizar catálogo** after an import batch to pull new e-SUS rows into the picker.

### Painel journey (All authenticated users)

1. Open **Painel** (unchanged navigation).
2. Confirm **APS** profile and **Layout A** (default).
3. Set competência and unidade as today.
4. See six cards and two charts populated from configured widgets (visually identical to current release with seed defaults).
5. Missing metrics show em-dash / "Não apurado" — same as today for cobertura and equipes placeholders.

### Discoverability

- Cadastros grid gains a dedicated card with description clarifying difference from `/indicadores` analytics drill-down page.
- Planning roles see edit affordances; Visualizador sees Painel only.

### Accessibility

- Maintain existing mono/numeric formatting patterns and chart test IDs for regression testing.
- Form labels and preview errors must be readable without relying on color alone.

---

## High-Level Technical Constraints

- Must integrate with existing e-SUS import pipeline and `dados_consolidados` municipal aggregates already used by the Painel.
- Must honor JWT role model: configuration writes limited to Planning staff and Administrador.
- Must not expose patient-identifiable data through widget configuration; metrics are aggregate production counts only.
- Painel page load should remain acceptable for municipal review meetings (target: no perceptible regression vs current single JSON fetch — exact threshold in TechSpec).
- Must run in Docker Compose and local dev environments already used by SIMPA.
- Phase 0 schema (`painel_metricas_catalogo`, `painel_widgets`) is the foundation; MVP builds services and UI on top.

---

## Non-Goals (Out of Scope)

| Item | Rationale |
|------|-----------|
| Layouts B and C dynamic configuration | Different visual compositions; Phase 2 |
| MAC, Hospitalar, Misto profile widgets | Placeholder profiles today; Phase 2 |
| Free-form SQL editing by users | Governance risk; read-only preview only in MVP |
| Variable widget count / drag-and-drop grid builder | MVP keeps eight fixed slots for parity |
| Replacing `/indicadores` analytics page | Separate drill-down experience remains |
| Merging `indicadores` (quality catalog C1/B1) table in MVP | Phase 2 integration |
| Automatic catalog refresh on every import without user action | Manual trigger in MVP; automation Phase 2 |
| Mobile-native Painel layout redesign | Desktop-first managerial use |
| Publishing workflow (draft vs live) | Immediate visibility on save in MVP |

---

## Phased Rollout Plan

### Phase 0 — Schema and seed (complete)

- Tables and seed metrics/widgets for APS Layout A parity.
- Painel runtime still hardcoded.

**Exit criteria:** Migration applied; 10 catalog + 8 widget rows verified.

### MVP — Phase 1 (Cadastro + dynamic Painel together)

- Metric catalog list and manual discovery action.
- Full widget CRUD with preview and query detail panel.
- Dynamic APS Layout A rendering with filter scoping and fallback.
- Audit logging for widget changes.
- Tests: unit (services), component (Layout A), one E2E path (configure + verify Painel).

**Exit criteria:** Planning staff can swap a card's metric and all users see updated value on Painel within same session; default seed reproduces current Layout A numbers for reference competência.

### Phase 2 — Expand coverage

- Layouts B and C widget models.
- MAC, Hospitalar, Misto profiles.
- Auto-discovery hook after import completion.
- Optional link to regulated `indicadores` quality catalog.
- Variable slot counts / reorder UX improvements.

**Exit criteria:** Coordinator can configure at least one non-APS profile layout without developer.

### Phase 3 — Maturity

- Performance batching for multi-widget resolution.
- Metric ownership metadata and deprecation workflow.
- Consolidated documentation for PAS/programmatic indicator mapping.

---

## Success Metrics

| Metric | Target (3 months post-MVP) |
|--------|----------------------------|
| Painel configuration changes without IT ticket | ≥ 3 successful widget edits by Planning staff |
| Time to reflect new e-SUS metric on Painel | < 1 business day after import (manual catalog refresh + widget bind) |
| Painel parity regression | Zero user-reported numeric discrepancies vs previous hardcoded Layout A on seed competência |
| Adoption | ≥ 2 Planning staff users actively maintain widget list |
| Support burden | No increase in "wrong number on Painel" tickets vs baseline month |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Planning staff misconfigure widgets | Preview gate, seed defaults, role restriction, audit trail |
| Managers confused by `/indicadores` vs Painel cadastro | Distinct naming, cadastro description, optional in-app hint |
| Catalog grows too large to browse | Search, filter by report type, sort by occurrence |
| Municipal vs unit filter shows wrong scope | Document filter behavior per metric; preview with unit selected |
| Low adoption if Painel and cadastro ship separately | **Mitigated by decision C** — ship both in Phase 1 |
| Competing with federal Painel e-SUS APS | Position SIMPA as municipal complement integrating local SIA/SIH/imported CSV context |

---

## Architecture Decision Records

- [ADR-001: Curated Metric Catalog with Governed SQL Templates](adrs/adr-001.md) — Live database metrics via approved catalog templates; flat discovery list; SQL preview read-only; cadastro and dynamic Painel equal MVP priority.

---

## Open Questions

1. **Cadastros grid naming:** Final label — "Indicadores do Painel" vs "Widgets do Painel" vs replace existing "Indicadores e Metas" `/admin` card?
2. **Municipal ranking/histórico under unit filter:** When a single UBS is selected, should ranking chart hide or show single-unit view?
3. **Sparkline on odonto card:** Seed maps historico to atendimentos series with procedimentos delta — confirm acceptable or require separate historico metric per card in Phase 1?
4. **Immediate publish:** Confirmed for MVP — revisit draft/publish if coordination errors become frequent.
5. **Implementation module order:** Backlog modules A–J documented in design spec; TechSpec will propose sequence (suggested: executor → runtime API → Painel UI → CRUD API → cadastro UI → discovery → E2E).

---

*Next step after approval: create TechSpec with `cy-create-techspec`.*
