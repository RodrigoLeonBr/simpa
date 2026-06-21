---
status: completed
title: Widget edit form and metric catalog picker
type: frontend
complexity: medium
dependencies:
  - task_13
---

# Task 14: Widget edit form and metric catalog picker

## Overview

Add create/edit flow for widgets: form dialog with tipo, titulo, subtitulo, formato, metric picker from catalog search, optional spark metric, and save via CRUD API.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST extend IndicadoresPainelPage with FormDialog (or drawer) for create/edit
- MUST implement metric picker: async search via `fetchPainelMetricas({ q })`
- MUST show selected metric label, fonte_tipo, chave in picker summary
- MUST validate required fields: slug (on create), titulo, tipo, metrica_id
- MUST call create/update API and refresh list on success with toast
- MUST support soft-delete/inactivate with ConfirmDialog
- MUST restrict form to planning staff (same guard as list actions)
</requirements>

## Subtasks
- [x] 14.1 Edit form fields matching PainelWidgetConfig
- [x] 14.2 Metric catalog combobox with debounced search
- [x] 14.3 Create widget flow with slug input
- [x] 14.4 Inactivate confirmation flow
- [x] 14.5 Form validation and API error display tests

## Implementation Details

See PRD F2 and TechSpec cadastro fields. Do not use generic `CadastroCrudPage` — custom form for metric FK picker.

### Relevant Files
- `simpa-frontend/src/components/cadastros/FormDialog.tsx`
- `simpa-frontend/src/components/cadastros/ConfirmDialog.tsx`
- `simpa-frontend/src/hooks/useDebounce.ts`

### Dependent Files
- task_15 preview panel

## Deliverables
- Widget CRUD UI on IndicadoresPainelPage
- Extended tests **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] Submit disabled when titulo empty
  - [ ] Metric search calls API with debounced q
  - [ ] Successful update calls updatePainelWidget and closes dialog
  - [ ] Inactivate calls inactivatePainelWidget after confirm
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Planning user can change widget titulo and metric binding end-to-end in dev
