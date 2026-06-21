---
status: completed
title: Catalog discovery action in cadastro UI
type: frontend
complexity: low
dependencies:
  - task_15
  - task_07
---

# Task 16: Catalog discovery action in cadastro UI

## Overview

Add **Atualizar catálogo** button for planning staff that triggers metric discovery and shows inserted/updated counts.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add toolbar button on IndicadoresPainelPage visible to planning staff only
- MUST call `discoverPainelMetricas()` and show toast with `{ inserted, updated }`
- MUST disable button while request in flight
- MUST refresh metric picker cache after discovery (if picker open, refetch)
- SHOULD show last discovery timestamp if returned by API (optional enhancement)
</requirements>

## Subtasks
- [x] 16.1 Button + loading state in page header
- [x] 16.2 Success/error toast handling
- [x] 16.3 Test discovery button visibility by role
- [x] 16.4 Test API invocation on click

## Implementation Details

See PRD F1 discovery manual trigger and TechSpec **Development Sequencing** step 9.

### Relevant Files
- `IndicadoresPainelPage.tsx`
- `api/painelWidgets.ts`

### Dependent Files
- task_18 docs mention discovery workflow

## Deliverables
- Discovery UI on cadastro page
- Tests **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Button hidden for Visualizador
  - [x] Click calls discoverPainelMetricas once
  - [x] Success toast shows inserted/updated counts from mock
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Discovery runnable from UI against dev backend
