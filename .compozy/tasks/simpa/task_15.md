---
status: pending
title: Importação UI
type: frontend
complexity: medium
dependencies:
  - task_06
  - task_11
---

# Task 15: Importação UI

## Overview

Build the Importação module: drag-and-drop upload zone with preview, process action, and histórico de cargas table with reprocess/substitute/delete actions matching backend API.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement UploadZone with drag-and-drop and file type validation (.csv)
- MUST call preview endpoint before full upload
- MUST display detected tipo/competencia/unidade/equipe from preview
- MUST render HistoricoCargas table with status badges and row actions
- MUST show import badge count on sidebar nav when pending cargas exist
</requirements>

## Subtasks
- [ ] 15.1 api/importacao.ts client methods
- [ ] 15.2 UploadZone component
- [ ] 15.3 HistoricoCargas table with actions
- [ ] 15.4 Import page composing upload + history

## Implementation Details

See SIMPA.dc.html scrImport section and Plano C Importacao pages.

### Relevant Files
- `simpa-frontend/src/pages/Importacao/index.tsx` — create
- `simpa-frontend/src/pages/Importacao/UploadZone.tsx` — create
- `simpa-frontend/src/pages/Importacao/HistoricoCargas.tsx` — create

## Deliverables
- End-to-end CSV upload from UI to backend
- Cargas history refreshes after upload
- Component tests for upload validation

## Tests
- Unit tests:
  - [ ] Rejects non-CSV files client-side
  - [ ] Preview response renders metadata fields
- Integration tests:
  - [ ] Upload fixture triggers list refresh (mocked)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- User can upload repo sample CSV and see new carga row
