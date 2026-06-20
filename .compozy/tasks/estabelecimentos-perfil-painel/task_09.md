---
status: pending
title: "Painel profile switcher, KPI catalogs, and placeholder UX"
type: frontend
complexity: medium
dependencies:
  - task_08
---

# Task 09: Painel profile switcher, KPI catalogs, and placeholder UX

## Overview

Add `ProfileSwitcher` beside `LayoutSwitcher` on the Painel, introduce `PAINEL_KPI_CATALOGS` registry in `dashboardView.ts`, render full APS layouts A/B/C via existing builders, and show an informative placeholder for MAC/Hospitalar/Misto until Phase 2 indicator packs ship.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `ProfileSwitcher.tsx` mirroring `LayoutSwitcher` styles and a11y patterns
- MUST integrate switcher in `Painel/index.tsx` bound to `painelPerfil` / `setPainelPerfil`
- MUST implement `getPainelCatalogStatus(perfil)` returning `'ready'` for APS and `'pending'` for MAC/Hospitalar/Misto
- MUST route APS perfil through existing `buildPainelKpis`, `buildRanking`, `buildUnitTable` for layouts A/B/C
- MUST render `PainelProfilePlaceholder` when catalog status is `pending` (message: indicadores em definição)
- MUST pass `unidades` to `LayoutB` for consistency when APS active
- MUST add unit tests for catalog registry and placeholder visibility
</requirements>

## Subtasks
- [ ] 09.1 Build `ProfileSwitcher` component
- [ ] 09.2 Add `PAINEL_KPI_CATALOGS` / resolver functions in `dashboardView.ts`
- [ ] 09.3 Create `PainelProfilePlaceholder` component
- [ ] 09.4 Update `Painel/index.tsx` conditional render logic
- [ ] 09.5 Add CSS classes consistent with existing painel switcher styles

## Implementation Details

See TechSpec **ADR-004** and PRD **F4**. Do not implement MAC/Hospitalar/Misto KPI definitions in MVP — placeholder only.

### Relevant Files
- `simpa-frontend/src/pages/Painel/index.tsx`
- `simpa-frontend/src/components/painel/LayoutSwitcher.tsx` — style reference
- `simpa-frontend/src/components/painel/ProfileSwitcher.tsx` (create)
- `simpa-frontend/src/components/painel/PainelProfilePlaceholder.tsx` (create)
- `simpa-frontend/src/utils/dashboardView.ts`
- `simpa-frontend/src/pages/Painel/LayoutA.tsx`, `LayoutB.tsx`, `LayoutC.tsx`
- `simpa-frontend/src/index.css` — painel switcher styles if needed

### Dependent Files
- `tests/e2e/critical-flow.spec.ts` — task_10

### Related ADRs
- [ADR-001: Editable Establishment Profile with Phased Multi-Profile Dashboard](adrs/adr-001.md)
- [ADR-004: Painel Profile Axis in Global Filters + Client-Side KPI Catalogs](adrs/adr-004.md)

## Deliverables
- Profile switcher UI and catalog registry
- Placeholder UX for non-APS profiles
- Unit tests with 80%+ coverage on new dashboardView exports **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] `getPainelCatalogStatus('APS')` returns `'ready'`
  - [ ] `getPainelCatalogStatus('MAC')` returns `'pending'`
  - [ ] Painel page with `painelPerfil='APS'` renders `layout-a` test id
  - [ ] Painel page with `painelPerfil='Hospitalar'` renders placeholder test id, not APS KPI grid
  - [ ] ProfileSwitcher button click calls `setPainelPerfil`
- Integration tests:
  - [ ] `AppShell.integration.test.tsx` or Painel test: switch layout B under APS still shows APS KPI labels
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on new Painel profile modules
- APS layouts A/B/C behave as before when APS selected
- MAC/Hospitalar/Misto never show misleading APS KPI labels
