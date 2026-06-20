---
status: completed
title: Importacao UI — mapping pickers, Process gate, Todas conflict modal
type: frontend
complexity: high
dependencies:
  - task_07
---

# Task 08: Importacao UI — mapping pickers, Process gate, Todas conflict modal

## Overview

Update Importação UI so preview rows show mapping status, establishment suggestions, and resolved cadastro targets. Block Process until all files are mapped; show Todas conflict confirmation modal; add mapeamentos management panel/tab for planning staff.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST disable Process button when any preview row has `mapeamento_status === 'pending'`
- MUST show establishment picker with suggestions and codigo_externo + nome on confirm
- MUST show e-SUS label alongside cadastro name in preview rows
- MUST show modal when `conflito_todas.requires_confirm` before upload proceeds
- MUST collect `ResolucaoUpload[]` and pass to `uploadCargas` on Process
- MUST add mapeamentos list/edit UI (planning staff only) on ImportacaoPage
- MUST extend Playwright E2E import flow with mapping step (seed establishment E2E001 or mock)
</requirements>

## Subtasks
- [x] 08.1 Refactor `UploadZone.tsx` for enriched preview rows and mapping pickers
- [x] 08.2 Implement Todas conflict confirmation modal component
- [x] 08.3 Add `MapeamentosPanel.tsx` (or tab) with list/edit for registry
- [x] 08.4 Wire planning-staff visibility using auth context perfil
- [x] 08.5 Add Vitest tests for UploadZone gate logic and E2E extension

## Implementation Details

See TechSpec **Impact Analysis** UploadZone/ImportacaoPage rows and PRD User Experience.

### Relevant Files
- `simpa-frontend/src/pages/Importacao/UploadZone.tsx`
- `simpa-frontend/src/pages/Importacao/ImportacaoPage.tsx` (or index)
- `simpa-frontend/src/contexts/AuthContext.tsx` — perfil check
- `simpa-frontend/tests/e2e/critical-flow.spec.ts`

### Dependent Files
- None blocking downstream except task_10 docs

### Related ADRs
- [ADR-001: Mapping Registry with Preview Gate](adrs/adr-001.md)

## Deliverables
- Updated Importação UI components
- Vitest component tests
- E2E test extension for import with mapping **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Process button disabled when any row pending mapping
  - [x] Process button enabled when all rows resolved
  - [x] Todas modal renders when `conflito_todas.requires_confirm` true
  - [x] Confirming modal sets `confirmar_remocao_todas: true` in resolucao
- Integration tests:
  - [x] E2E: upload CSV → select establishment mapping → preview rows visible → process succeeds
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on Importação UI components
- Manual: CAFI mapping flow completes without Panel 404 after import
