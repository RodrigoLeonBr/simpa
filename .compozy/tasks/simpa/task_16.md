---
status: pending
title: Cadastros UI (6 sub-rotas CRUD)
type: frontend
complexity: high
dependencies:
  - task_08
  - task_11
---

# Task 16: Cadastros UI (6 sub-rotas CRUD)

## Overview

Implement Cadastros landing grid (6 clickable cards) and sub-route CRUD pages for Unidades, Equipes, Procedimentos, Prestadores MAC, Hospitais, and Emendas Parlamentares. UI label is always "Cadastros" with actions Novo/Editar/Inativar/Excluir.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement /cadastros grid index with 6 cards per auth design spec Section 10
- MUST implement sub-routes: unidades, equipes, procedimentos, prestadores-mac, hospitais, emendas
- MUST use shared DataTable + FormDialog pattern for CRUD
- MUST confirm destructive actions with dialog
- MUST call cadastros API from Task 08
</requirements>

## Subtasks
- [ ] 16.1 Cadastros index grid page
- [ ] 16.2 Shared CRUD table/form components
- [ ] 16.3 Unidades + Equipes pages (priority)
- [ ] 16.4 Procedimentos, Prestadores, Hospitais, Emendas pages

## Implementation Details

See auth design spec Section 10 and SIMPA.dc.html scrGeneric cadastros cards.

### Relevant Files
- `simpa-frontend/src/pages/Cadastros/index.tsx` — create
- `simpa-frontend/src/pages/Cadastros/Unidades.tsx` — create
- (5 additional entity pages)

### Related ADRs
- [ADR-005: React Port](../adrs/adr-005.md)

## Deliverables
- All 6 cadastro sub-routes functional
- Consistent visual per design-system.md tables and forms
- Tests for form validation and table actions

## Tests
- Unit tests:
  - [ ] Form validates required CNES/SIGTAP fields
  - [ ] Delete confirmation dialog blocks immediate action
- Integration tests:
  - [ ] Create unidade appears in list (mocked API)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Grid matches prototype card layout
