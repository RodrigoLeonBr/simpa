---
status: pending
title: Widget preview modal and SQL detail panel
type: frontend
complexity: medium
dependencies:
  - task_14
---

# Task 15: Widget preview modal and SQL detail panel

## Overview

Add planning-staff preview: test competência/unidade, call preview API, show resolved value; collapsible read-only SQL panel from `sql_preview`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add Preview action on edit form or list row
- MUST collect preview scope: competencia (required), optional estabelecimento from select
- MUST call `previewPainelWidget` POST and display valueLabel, isNull, delta
- MUST show collapsible **Query detail** section with monospace `sql_preview` (read-only)
- MUST NOT allow editing SQL text in MVP
- MUST handle preview API errors with toast
</requirements>

## Subtasks
- [ ] 15.1 Preview modal with competencia input (default current filter or month picker)
- [ ] 15.2 Optional estabelecimento select populated from fetchEstabelecimentos APS
- [ ] 15.3 Display preview result fields
- [ ] 15.4 SQL detail collapsible panel
- [ ] 15.5 Tests for preview success and error paths

## Implementation Details

See PRD **Cadastro journey** steps 4–5 and TechSpec **sql_preview read-only**. Reuse `FilterBar` competencia patterns if helpful.

### Relevant Files
- `simpa-frontend/src/components/layout/FilterBar.tsx` — competencia UX reference
- `simpa-frontend/src/api/cadastros.ts` — fetchEstabelecimentos

### Dependent Files
- task_17 E2E may assert preview optional

### Related ADRs
- [ADR-003: SQL preview transparency](../adrs/adr-003.md)

## Deliverables
- Preview modal + SQL panel UI
- Tests **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] Preview button calls previewPainelWidget with competencia 2026-05
  - [ ] SQL panel renders sql_preview text when expanded
  - [ ] Preview error shows toast message
  - [ ] isNull preview shows em-dash styling
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Preview returns value for atendimentos widget against dev seed data
