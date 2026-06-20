---
status: completed
title: "Global painelPerfil state in useFilters"
type: frontend
complexity: low
dependencies:
  - task_05
---

# Task 07: Global painelPerfil state in useFilters

## Overview

Add `painelPerfil` to the global filters context so Painel and FilterBar share the selected care-level profile (APS, MAC, Hospitalar, Misto). Changing profile resets `unidadeId` and `equipeId` to avoid stale unit selections.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add `painelPerfil: PainelPerfil` type and `setPainelPerfil` to `useFilters.tsx` per TechSpec Core Interfaces
- MUST default `painelPerfil` to `'APS'`
- MUST reset `unidadeId` and `equipeId` to `null` when `painelPerfil` changes
- MUST export `PainelPerfil` from `types/painel.ts` (new file)
- MUST add unit tests for context behavior
</requirements>

## Subtasks
- [x] 07.1 Create `types/painel.ts` with `PainelPerfil` and catalog status types
- [x] 07.2 Extend `FiltersContextValue` and provider state
- [x] 07.3 Implement `setPainelPerfil` with unit/equipe reset
- [x] 07.4 Add tests in `useFilters` test file or new test module

## Implementation Details

See TechSpec **ADR-004** decision on global filters. No API or Painel UI changes in this task.

### Relevant Files
- `simpa-frontend/src/hooks/useFilters.tsx`
- `simpa-frontend/src/types/painel.ts` (create)
- `simpa-frontend/src/hooks/useFilters.test.tsx` (create if missing)

### Dependent Files
- `FilterBar.tsx` — task_08
- `Painel/index.tsx` — task_09

### Related ADRs
- [ADR-004: Painel Profile Axis in Global Filters + Client-Side KPI Catalogs](adrs/adr-004.md)

## Deliverables
- Extended filters context and painel types
- Unit tests with 80%+ coverage on filter hook changes **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Initial `painelPerfil` is `'APS'`
  - [x] `setPainelPerfil('MAC')` updates context value
  - [x] Changing `painelPerfil` clears `unidadeId` and `equipeId` when previously set
  - [x] `setCompetencia` does not reset `painelPerfil`
- Integration tests:
  - [x] N/A
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on `useFilters.tsx`
- Consumers can read/write `painelPerfil` without prop drilling
- No regression to existing competência/unidade/equipe behavior
