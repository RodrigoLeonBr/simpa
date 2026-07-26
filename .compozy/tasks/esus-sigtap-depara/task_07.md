---
status: completed
title: Cadastros UI for de-para + in-app help
type: frontend
complexity: medium
dependencies:
  - task_03
---

# Task 07: Cadastros UI for de-para + in-app help

## Overview

Add a Cadastros screen for Planning/billing to list, create, edit, and inactivate e-SUS→SIGTAP maps (and related procedimento fields), with short in-app help covering purpose, required fields, and silent-skip export behavior. UX must mirror existing Unidades patterns.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST add a Cadastros page for esus-procedimento-map (joined list) with search/filter by secao, text query, and status.
2. MUST support create, edit, and inactivate flows calling task_03 APIs.
3. MUST show `codigo_sigtap` in monospace and display secao + descricao_esus clearly.
4. MUST include short in-app help (purpose, required fields, silent-skip behavior) on the page.
5. MUST update routing/nav so the page is reachable under `/cadastros` (nested route or clear navigation between Unidades and Procedimentos).
6. SHOULD allow selecting/creating procedimento by codigo_sigtap when adding a map.
7. MUST follow existing dark Cadastros visual patterns (Unidades.tsx).
</requirements>

## Subtasks
- [x] 7.1 Create Procedimentos/de-para page component
- [x] 7.2 Wire list filters and CRUD form to API
- [x] 7.3 Add inactivate action with confirmation consistent with Unidades
- [x] 7.4 Add in-app help panel/section
- [x] 7.5 Update router and Sidebar/nav labels
- [x] 7.6 Add frontend tests for form validation and render

## Implementation Details

See TechSpec **User Experience** (PRD) and Cadastros patterns. Reference `Unidades.tsx` for FilterBar + table + form layout. Types may extend `contrato.ts`.

**Delivered:**
- `/cadastros/procedimentos` — `Procedimentos.tsx` + layout tabs in `Cadastros/index.tsx`
- Help panel with silent-skip; filters secao/q/status; CRUD + inativar
- Vitest + RTL (`Procedimentos.test.tsx` — 7 tests)
- Type `EsusProcedimentoMap` in `contrato.ts`

### Relevant Files
- `simpa-frontend/src/pages/Cadastros/Unidades.tsx` — UX reference
- `simpa-frontend/src/main.tsx` — routes
- `simpa-frontend/src/components/layout/Sidebar.tsx` — navigation
- `simpa-frontend/src/types/contrato.ts` — types

### Dependent Files
- None blocking; task_08 may link to export from elsewhere

### Related ADRs
- [ADR-001](adrs/adr-001.md) — CRUD for Planning/billing
- [ADR-002](adrs/adr-002.md) — dual entities in UI

## Deliverables
- Reachable Cadastros de-para UI with CRUD + help
- Router/nav updates
- Component tests **(REQUIRED)** — introduce Vitest/React Testing Library for app if missing
- Coverage >=80% on new page logic **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Submitting form without secao or descricao_esus shows validation error and does not POST
  - [x] Help text includes silent-skip wording
  - [x] Inativar calls DELETE endpoint and refreshes list omitting inactive by default
- Integration tests:
  - [x] Page loads list from mocked GET `/api/cadastros/esus-procedimento-map`
  - [x] Creating a map with codigo_sigtap posts expected body
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Analyst can create/edit/inactivate a mapping in under 2 minutes (PRD metric)
- Visual consistency with Unidades Cadastros screen
