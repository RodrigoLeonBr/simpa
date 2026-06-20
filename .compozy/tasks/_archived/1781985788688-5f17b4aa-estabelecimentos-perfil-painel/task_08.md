---
status: completed
title: "FilterBar and useDashboard profile-aware unit loading"
type: frontend
complexity: medium
dependencies:
  - task_07
---

# Task 08: FilterBar and useDashboard profile-aware unit loading

## Overview

Replace hardcoded APS-only establishment fetching in `FilterBar` and `useDashboard` with parametric loads based on `painelPerfil`. Unit dropdowns and Painel rankings must reflect establishments registered under the active profile.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST replace `fetchEstabelecimentosAps()` with `fetchEstabelecimentos(buildEstabelecimentosPerfilQuery(painelPerfil))` in `useDashboard.ts`
- MUST update `FilterBar.tsx` to load units using `painelPerfil` from `useFilters`
- MUST re-fetch establishments when `painelPerfil` changes
- MUST map results via existing `mapEstabelecimentosToUnidades`
- MUST update `useDashboard.test.tsx` mocks for multiple perfis
- MUST NOT change `fetchDashboard` API call signature in MVP (APS contract only)
</requirements>

## Subtasks
- [x] 08.1 Wire `painelPerfil` dependency into `useDashboard` establishment effect
- [x] 08.2 Update FilterBar unit dropdown data source
- [x] 08.3 Clear stale dashboard data when perfil changes until reload completes
- [x] 08.4 Update unit tests for MAC/Hospitalar establishment lists

## Implementation Details

See TechSpec **Data flow — Painel**. Dashboard payload remains APS-centric until Phase 2; this task only changes unit list sourcing.

### Relevant Files
- `simpa-frontend/src/hooks/useDashboard.ts`
- `simpa-frontend/src/components/layout/FilterBar.tsx`
- `simpa-frontend/src/hooks/useDashboard.test.tsx`
- `simpa-frontend/src/utils/estabelecimentosView.ts`

### Dependent Files
- `Painel/LayoutA.tsx`, `LayoutC.tsx` — consume `unidades` in task_09

### Related ADRs
- [ADR-004: Painel Profile Axis in Global Filters + Client-Side KPI Catalogs](adrs/adr-004.md)

## Deliverables
- Profile-aware unit loading in dashboard hook and filter bar
- Unit tests with 80%+ coverage on changed hooks/components **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `useDashboard` with `painelPerfil='MAC'` calls fetch with `perfil=MAC`
  - [x] When `painelPerfil` changes from APS to Hospitalar, `unidades` array updates to mocked hospital list
  - [x] `FilterBar` renders unit options count matching mocked establishments for active perfil
- Integration tests:
  - [x] `useDashboard.test.tsx` full load cycle with perfil switch does not throw
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on `useDashboard.ts` and FilterBar changes
- Unit dropdown shows only establishments matching selected Painel perfil
- No remaining direct calls to `fetchEstabelecimentosAps` outside backward-compatible alias
