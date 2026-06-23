---
status: completed
title: "Frontend: routing, navigation, preview badge"
type: frontend
complexity: low
dependencies:
  - task_07
  - task_02
---

# Task 08: Frontend: routing, navigation, preview badge

## Overview

Wires the new `PopulacaoPage` into the React application by adding a lazy route at `/painel/populacao` in `App.tsx`, adding a navigation entry in `navigation.ts`, and updating the import preview card in `ImportacaoPage` to display a `cidadaos_ativos` badge when the detected report type is `cadastro_individual`. These are the final integration points that make the feature visible and navigable to users.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC "Frontend Changes — App.tsx and navigation.ts" section
- FOCUS ON "WHAT" — routing, nav entry, and badge display; do not modify PopulacaoPage itself
- MINIMIZE CODE — three small, targeted changes to existing files
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST add lazy import for `PopulacaoPage` in `App.tsx`: `const PopulacaoPage = lazy(() => import('./pages/Painel/PopulacaoPage'))`.
2. MUST add route in `App.tsx` within the ProtectedRoute/AppShell block: `<Route path="/painel/populacao" element={<LazyModuleRoute Page={PopulacaoPage} />} />`.
3. MUST add navigation entry in `simpa-frontend/src/config/navigation.ts` for `/painel/populacao` with label "População Cadastrada" — visible to planning staff and admin roles.
4. MUST update `ImportacaoPage` preview card rendering to display `cidadaos_ativos` count as a badge when `tipo_relatorio === "cadastro_individual"`.
5. The route at `/painel/populacao` MUST be protected (within the existing `ProtectedRoute` block — same as all other routes).
6. The navigation entry MUST follow existing `NavItem` interface structure from `navigation.ts`.
7. Preview badge MUST only appear for `cadastro_individual` type — must not affect existing 6 report types' preview cards.
</requirements>

## Subtasks

- [x] 8.1 Add `PopulacaoPage` lazy import and `/painel/populacao` route in `App.tsx`.
- [x] 8.2 Add navigation entry for "População Cadastrada" in `navigation.ts`.
- [x] 8.3 Update import preview card in `ImportacaoPage` (or `PreviewMappingRow.tsx`) to show `cidadaos_ativos` badge for `cadastro_individual` type.
- [x] 8.4 Write tests for route existence and nav entry visibility.
- [x] 8.5 Write test for preview badge appearing for `cadastro_individual` and not for other types.

## Implementation Details

See TechSpec "Frontend Changes — App.tsx + navigation.ts" section. In `App.tsx`, the new route follows the same `<LazyModuleRoute Page={...} />` pattern as all other lazy routes. Do not add `requirePlanningStaff` prop — role access is enforced by the server on `/api/populacao`.

In `navigation.ts`, the `NavItem` interface requires `to`, `label`, and `icon` fields. Use an appropriate existing icon name (e.g., `'populacao'` or reuse `'cadastros'`). If the nav item should appear as a sub-item under Painel rather than a top-level item, check the current `NavItem` interface for a `children` field.

For the preview badge, the preview response from `POST /importacao/preview` will include `cidadaos_ativos` from task_02. The `PreviewMappingRow.tsx` component (or equivalent) renders each file's preview card. Add a conditional: if `item.tipo_relatorio === "cadastro_individual"` and `item.cidadaos_ativos`, show a badge like `"3.337 cidadãos"`.

### Relevant Files

- `simpa-frontend/src/App.tsx` — add lazy import + Route
- `simpa-frontend/src/config/navigation.ts` — add nav entry
- `simpa-frontend/src/pages/Importacao/PreviewMappingRow.tsx` — add cidadaos_ativos badge
- `simpa-frontend/src/pages/Importacao/index.tsx` — verify preview card rendering
- `simpa-frontend/src/pages/Painel/PopulacaoPage.tsx` — target of the route (task_07)

### Dependent Files

- `simpa-frontend/src/components/layout/AppShell.tsx` — may reference nav items for rendering sidebar

## Deliverables

- Updated `App.tsx` with new route
- Updated `navigation.ts` with new nav entry
- Updated `PreviewMappingRow.tsx` (or ImportacaoPage) with cidadaos_ativos badge
- Tests for routing, nav entry, and badge rendering
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests confirming navigation works **(REQUIRED)**

## Tests

- Unit tests:
  - [ ] `App.tsx` renders `PopulacaoPage` at `/painel/populacao` route (React Testing Library render with MemoryRouter at `/painel/populacao`)
  - [ ] `PreviewMappingRow` renders cidadaos_ativos badge `"3.337 cidadãos"` when `tipo_relatorio = "cadastro_individual"` and `cidadaos_ativos = 3337`
  - [ ] `PreviewMappingRow` does NOT render cidadaos_ativos badge when `tipo_relatorio = "atendimento_individual"`
  - [ ] `navigation.ts` `NAV_ITEMS` array includes an entry with `to: "/painel/populacao"`
- Integration tests:
  - [ ] Authenticated user can navigate to `/painel/populacao` without 404 (Playwright or React Testing Library + router)
  - [ ] `/painel/populacao` redirects to `/login` for unauthenticated user
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- Browser navigation to `/painel/populacao` renders `PopulacaoPage` without error
- Sidebar/nav shows "População Cadastrada" link
- Import preview for a cadastro_individual CSV shows cidadãos ativos count badge
- Import preview for atendimento_individual CSV shows no cidadãos ativos badge
