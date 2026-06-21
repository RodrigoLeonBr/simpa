---
status: completed
title: IndicadoresPainelPage widget list
type: frontend
complexity: medium
dependencies:
  - task_08
  - task_12
---

# Task 13: IndicadoresPainelPage widget list

## Overview

Create the cadastro page shell listing APS Layout A widgets in order with status, type badges, and actions to edit or deactivate (planning staff only).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `simpa-frontend/src/pages/Cadastros/IndicadoresPainelPage.tsx`
- MUST fetch widgets via `fetchPainelWidgets({ perfil: 'APS', layout: 'A' })`
- MUST display ordem, titulo, tipo, linked metric label, status
- MUST show read-only view for non-planning users (no edit/delete buttons)
- MUST use `canEditEnrichment` or equivalent planning staff check from auth context
- MUST include page header explaining difference from `/indicadores` analytics
- MUST wire route from task_12 to this page
</requirements>

## Subtasks
- [x] 13.1 Page layout with loading/error states
- [x] 13.2 DataTable or card list ordered by ordem
- [x] 13.3 Role-based action column visibility
- [x] 13.4 Link back to Cadastros hub
- [x] 13.5 Vitest render tests

## Implementation Details

See PRD **Cadastro journey** steps 1–3. Reuse `DataTable`, `Toast`, patterns from `EstabelecimentosPage` / `CadastroCrudPage`.

### Relevant Files
- `simpa-frontend/src/pages/Cadastros/EstabelecimentosPage.tsx`
- `simpa-frontend/src/components/cadastros/DataTable.tsx`
- `simpa-frontend/src/utils/enrichmentView.ts` — role helpers
- `simpa-frontend/src/contexts/AuthContext.tsx`

### Dependent Files
- task_14 edit form

## Deliverables
- `IndicadoresPainelPage.tsx` list view
- `IndicadoresPainelPage.test.tsx` **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Renders 8 seed widgets when API mocks list response
  - [x] Planning user sees Editar button
  - [x] Visualizador does not see Editar button
  - [x] Shows error banner when fetch fails
- Test coverage target: >=80%
- All tests must pass

### Validation evidence
- `npx vitest run src/pages/Cadastros/IndicadoresPainelPage.test.tsx src/pages/Cadastros/Cadastros.test.tsx` ✅ (14/14)
- `npx vitest run src/pages/Cadastros/IndicadoresPainelPage.test.tsx --coverage --coverage.include=src/pages/Cadastros/IndicadoresPainelPage.tsx` ✅ (`branches 82.14%`)
- `npx tsc --noEmit` ✅

## Success Criteria
- All tests passing
- Page reachable at `/cadastros/indicadores-painel`
