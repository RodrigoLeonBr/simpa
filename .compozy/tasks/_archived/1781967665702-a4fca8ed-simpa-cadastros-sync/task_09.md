---
status: completed
title: Frontend FilterBar, dashboard filters, Equipes dropdown
type: frontend
complexity: medium
dependencies:
  - task_06
  - task_08
---

# Task 09: Frontend FilterBar, dashboard filters, Equipes dropdown

## Overview

Point global unit filters and Teams establishment dropdown to new establishments API. Remove dependency on deprecated `/api/cadastros/unidades` and legacy entity types.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST replace `fetchUnidades()` with `fetchEstabelecimentos({ perfil: 'APS' })` in FilterBar
- MUST update `useDashboard.ts` to use establishments API for filter cascade
- MUST update Equipes form select to load establishments (all active or APS-only per UX decision)
- MUST use `estabelecimento_id` field on equipe create/update payloads
- MUST update mocks in `mock/db.json` and `mock/routes.json` if still used for dev
- MUST remove frontend types/API functions for unidades, prestadores-mac, hospitais deprecated paths
</requirements>

## Subtasks
- [x] 9.1 Update `api/cadastros.ts` client functions
- [x] 9.2 Update `FilterBar.tsx` and tests
- [x] 9.3 Update `useDashboard.ts` / `useFilters` integration
- [x] 9.4 Update Equipes CRUD form select field to estabelecimento_id
- [x] 9.5 Update mock server routes for estabelecimentos

## Implementation Details

See TechSpec **Frontend changes** — FilterBar and useDashboard rows.

FilterBar currently imports `fetchUnidades` from `api/cadastros.ts`.

### Relevant Files
- `simpa-frontend/src/components/layout/FilterBar.tsx`
- `simpa-frontend/src/hooks/useDashboard.ts`
- `simpa-frontend/src/api/cadastros.ts`
- `simpa-frontend/src/config/cadastroEntities.ts` — equipes fields
- `simpa-frontend/mock/routes.json` — mock routes

### Dependent Files
- `simpa-backend` unidades compat shim — can remove after this task (task_10)

### Related ADRs
- [ADR-001](adrs/adr-001.md)

## Deliverables
- FilterBar populated from establishments API
- Equipes linked to estabelecimento_id in UI
- Updated unit/integration tests for FilterBar and useDashboard

## Tests
- Unit tests:
  - [ ] FilterBar fetches `/api/cadastros/estabelecimentos?perfil=APS` on mount
  - [ ] Equipe form submit sends `estabelecimento_id` not `unidade_id`
- Integration tests:
  - [ ] AppShell integration test passes with new mock endpoints
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Painel filters show synced establishment names after cadastro sync
