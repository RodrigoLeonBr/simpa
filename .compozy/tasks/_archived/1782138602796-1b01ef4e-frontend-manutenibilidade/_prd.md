# PRD — Frontend Maintainability & Initial Load Performance

**Feature:** `frontend-manutenibilidade`  
**Version:** 1.0  
**Date:** 2026-06-21  
**Status:** Accepted  
**Parent product:** SIMPA — Secretaria de Saúde de Americana/SP  
**Inputs:** [`_idea.md`](_idea.md), build analysis (882 KB chunk), maintainability roadmap

---

## Overview

SIMPA's React frontend powers the municipal health BI platform: Painel, Cadastros, Importação, Metas, Indicadores, Relatórios, and Administração. The application **works correctly today**, but two pressures limit sustainable growth:

1. **End users** on slow connections wait for a large initial download because the entire SPA loads at once, even when they only need the Painel.
2. **The development team** spends extra time copying similar catalog and CRUD pages, navigating 200–400 line files, and reviewing risky diffs — slowing delivery of cadastro and planning features already on the roadmap.

This initiative improves **code health and load performance without changing what users can do** — same screens, same filters, same roles, same dashboard contract. Value is faster Painel-first load, safer evolution of Cadastros/Admin, and shorter time to add new read-only SIA catalogs or admin entities.

**Primary beneficiaries:** SIMPA developers and technical planning staff who maintain the frontend.  
**Secondary beneficiaries:** Gestores and analysts who open the Painel daily and benefit from quicker first paint.

---

## Goals

1. **Reduce initial JavaScript delivered on Painel-first visit** so managers on municipal networks see the dashboard sooner.
2. **Eliminate duplicate read-only catalog implementations** so new Forma/CBO/Procedimento-style pages require configuration, not copy-paste.
3. **Establish one CRUD interaction pattern** for Admin users and planning cadastros (usuários, indicadores do painel) without breaking specialized flows (import preview, establishment drawer).
4. **Bring source files to a reviewable size** so PRs touching enrichment, painel views, or admin are understandable in one sitting.
5. **Preserve quality gates** — all existing automated tests pass; no regression in role-based access or dashboard numbers.

**Timeline:** Four incremental phases; each phase is releasable independently. MVP = Phase 1 complete.

---

## User Stories

### Development team (primary)

- As a **frontend developer**, I want read-only catalog pages (search, pagination, table) built from shared configuration so that adding a new SIA mirror entity takes hours instead of duplicating a full page.
- As a **frontend developer**, I want a single CRUD state pattern for list/create/edit/inactivate flows so that Admin and Cadastros special pages behave consistently and I fix bugs once.
- As a **developer reviewing a PR**, I want changed files to stay under ~250 lines so that I can verify behavior without missing edge cases in a 400-line diff.
- As a **developer**, I want styles grouped by module (Painel, Cadastros, Admin) so that UI tweaks do not require scrolling a 3000-line global stylesheet.
- As a **developer onboarding to SIMPA**, I want agent documentation describing catalog, CRUD, and lazy-route conventions so that I follow project patterns on day one.

### Planning / Admin staff (configuration users)

- As an **Administrador** configuring usuários or indicadores do painel, I want the same dialog and confirmation patterns I already know so that refactoring does not force retraining.
- As **Planejamento staff** editing painel widgets, I want preview and discovery flows unchanged so that my curation workflow is uninterrupted.

### Dashboard consumers (secondary)

- As a **Gestor opening the Painel**, I want the first screen to become interactive sooner on a typical office connection so that I can filter competência and unidade without staring at a blank shell.
- As a **user navigating to Cadastros or Importação**, I accept a brief loading state when entering those modules if the Painel path stays lean — provided the transition feels intentional (clear loading feedback, no broken layout).

### Explicit non-personas

- This PRD does **not** change Importação business rules, SIA sync, or backend APIs — those users see no new capabilities here.

---

## Core Features

### F1 — Unified read-only catalog experience (Phase 1, MVP)

- **What:** One reusable catalog page pattern for Formas, CBOs, and Procedimentos (and future read-only entities).
- **Why:** Removes ~250 lines of duplication; standardizes search, empty states, errors, pagination.
- **Behavior:** User sees identical UX to today — search box, table columns per entity, back link to Cadastros grid, loading and error messages in Portuguese.

### F2 — Faster module loading (Phase 1–2)

- **What:** Application loads Painel and shared shell first; heavier modules (Cadastros subtree, Importação, Admin, analytics with charts) load when navigated to.
- **Why:** Addresses 882 KB monolithic chunk; aligns with industry route-based splitting practice.
- **Behavior:** User clicking sidebar item may see a short “Carregando módulo…” state; Painel default route avoids downloading admin/import weight upfront.

### F3 — Modular styling (Phase 1)

- **What:** Global CSS split by domain while preserving current visual design (tokens, dark theme, component look).
- **Why:** Developers locate Painel vs Cadastros styles quickly; reduces merge conflicts in one file.
- **Behavior:** No visual redesign — pixel-parity expected unless a bug is fixed incidentally.

### F4 — Standardized editable entity flows (Phase 2)

- **What:** Shared CRUD behavior for Usuários (Admin) and Indicadores do Painel (Cadastros), building on existing `FormDialog`, `ConfirmDialog`, `DataTable`.
- **Why:** Two bespoke 175–388 line pages share the same state machine today.
- **Behavior:** Create, edit, inactivate, toast feedback, and audit-sensitive actions unchanged from user perspective.

### F5 — Consistent analytics page framing (Phase 2)

- **What:** Shared loading/error wrapper for Painel, Metas, Indicadores, Relatórios.
- **Why:** Four pages duplicate `analytics-state` / `analytics-state-error` branches.
- **Behavior:** Same messages and filter integration; no new metrics or charts.

### F6 — Split large implementation files (Phase 3)

- **What:** Enrichment-by-perfil forms, dashboard/indicadores/import view helpers, and establishment detail drawer divided into focused units.
- **Why:** Highest regression risk today is editing 300–418 line files blind.
- **Behavior:** No change to enrichment fields, perfil rules, or drawer tabs — structural only.

### F7 — Cadastro registry and contributor docs (Phase 4)

- **What:** Metadata for all Cadastros grid entries (mode: readonly / crud / custom); agent frontend guide updated; oversized test file split by flow.
- **Why:** Onboarding and routing clarity; tests easier to update when UI changes.

---

## User Experience

### Primary flow — Gestor (unchanged capabilities, faster start)

1. User logs in → lands on **Painel** (default route).
2. Shell (sidebar, topbar, filters) appears; Painel content loads from leaner initial bundle.
3. User changes competência/unidade — same as today.
4. Optional: user opens Cadastros → brief module load → catalog or CRUD behaves as before.

### Primary flow — Administrador (unchanged capabilities)

1. User opens **Administração → Usuários** (or Backup, Configurações).
2. List, create, edit, inactivate dialogs work as today; confirmation labels unchanged.
3. User opens **Cadastros → Indicadores do Painel** — widget list, preview, discovery unchanged in outcome.

### UX requirements

- **Parity:** No removal of screens, columns, or actions covered by this refactor.
- **Loading feedback:** Any deferred module must show a accessible loading indicator (not a blank page).
- **Failure handling:** Chunk load failures (e.g., after deploy) should surface a recoverable message (retry or refresh) — detailed in TechSpec.
- **Accessibility:** Preserve existing labels, roles, and `data-testid` hooks used by Playwright.
- **Language:** UI copy remains Brazilian Portuguese.

---

## High-Level Technical Constraints

- Must remain compatible with **React 19 + Vite 8 + Tailwind 4** stack already in production.
- Must not alter **dashboard JSON contract v3.1.0** or API endpoints.
- Must keep **role-based navigation** (`navigation.ts`, `AuthContext`) — Admin-only routes stay protected.
- **ECharts** remains the chart library; optimization is load timing, not library replacement.
- **Docker/nginx** same-origin `/api` proxy unchanged.
- Performance work should target **Painel-first** entry; avoid lazy-loading Login or critical shell chrome.

*(Implementation choices — lazy boundaries, file paths, chunk config — belong in TechSpec.)*

---

## Non-Goals (Out of Scope)

- Rewriting the **Importação** module (upload, preview gate, mapeamentos).
- Replacing **ECharts** or redesigning Painel layouts A/B/C.
- **Backend**, PostgreSQL, ETL, or Docker changes (except docs if needed).
- Changing **JWT roles**, audit log schema, or admin backup API behavior.
- Visual **rebrand** or new design system.
- Merging **Estabelecimento drawer** or **Importação mapping** into generic CRUD abstractions.
- Mobile-native app or offline support.

---

## Phased Rollout Plan

### Phase 1 — MVP (Quick wins)

**Includes:** F1 unified catalog, F2 route-level lazy loading (Cadastros, Importação, Admin minimum), F3 modular CSS, consolidated TypeScript types for cadastros API.

**Success criteria to proceed:**

- Formas/CBOs/Procedimentos pages are thin config wrappers.
- `npm run build` succeeds; initial chunk gzip measurably reduced vs baseline 277 KB.
- Vitest green; Playwright smoke on Cadastros read-only paths.

### Phase 2 — Patterns & chunks

**Includes:** F4 `useEntityCrud` on Usuários + Indicadores Painel, F5 dashboard shell, F2 continued (ECharts lazy + vendor chunks).

**Success criteria:**

- Both CRUD pages use shared hook; no duplicate state machine.
- Metas/Indicadores/Relatórios/Painel use shared loading/error shell.
- Build output shows separate echarts/vendor chunks.

### Phase 3 — File splits

**Includes:** F6 enrichment split, view util partitions, establishment drawer split.

**Success criteria:**

- No production TS/TSX > 250 lines except tests.
- Enrichment and painel E2E still pass.

### Phase 4 — Registry & docs

**Includes:** F7 cadastro registry metadata, split large test files, `docs/agent/frontend.md` conventions.

**Success criteria:**

- All grid entities documented in registry.
- Agent docs describe catalog + CRUD + lazy route patterns.
- Workflow ready for `compozy archive` after review round.

---

## Success Metrics

| Metric | Baseline (2026-06-21) | Target |
|--------|------------------------|--------|
| Main JS bundle (gzip) | ~277 KB | Meaningful reduction; Painel-first route primary measure |
| Duplicate catalog LOC | ~360 across 3 pages | ~90% reduction via shared catalog |
| Files > 200 LOC (prod TS/TSX) | 13 | 0 after Phase 3 |
| `index.css` lines | ~2900 | Entry file ~imports only; domain files |
| Vitest + Playwright | Passing | 100% pass rate maintained |
| Time to add read-only catalog | ~1 page copy (~120 LOC) | Config-only (~30 LOC) |

**Qualitative:** Developers report PRs are easier to review; no user-reported “something moved” tickets after each phase.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Silent UI regression during refactor | Phase gates: Vitest, Playwright, manual smoke checklist per module |
| Stakeholders perceive “no visible feature” | Communicate Painel load improvement; track gzip metric |
| Scope creep into Importação rewrite | Non-goals enforced in TechSpec and task acceptance |
| Long-running branch conflicts | One phase per branch/PR; merge frequently |
| Over-abstraction slows future work | YAGNI — config-driven catalogs yes; generic import wizard no |
| Chunk load failure after deploy | User-visible retry; TechSpec to define error boundary |

---

## Architecture Decision Records

- [ADR-001: Incremental Four-Phase Refactor](adrs/adr-001.md) — Ship maintainability and performance in four phases; reject big-bang rewrite and performance-only scope.

*(Additional ADRs for catalog abstraction, code splitting strategy, CRUD hook, CSS layout, and utils partition will be created during TechSpec.)*

---

## Open Questions

1. **Baseline measurement:** Should Painel-first gzip be captured in CI artifact comparison, or manual before/after only? *(TechSpec)*
2. **Phase 2 scope for analytics routes:** Lazy-load Metas/Indicadores/Relatórios at route level in Phase 1 or Phase 2? *(Default: Phase 2 unless Phase 1 bundle still large)*
3. **Error boundary copy:** Exact Portuguese message for failed chunk load after deployment? *(UX polish in TechSpec)*

---

*Next step after approval: `/cy-create-techspec frontend-manutenibilidade`*
