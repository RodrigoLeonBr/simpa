---
status: pending
title: App shell (Sidebar, Topbar, FilterBar)
type: frontend
complexity: medium
dependencies:
  - task_09
  - task_10
---

# Task 11: App shell (Sidebar, Topbar, FilterBar)

## Overview

Build the application chrome: 236px sidebar with labeled nav (7 modules), 58px topbar with Sala de Situação button and user profile, sticky FilterBar with competencia/unidade/equipe cascade, AppContext for theme and isSituacao state.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement Sidebar 236px with all nav items from estrutura_simpa.md
- MUST implement Topbar with screen title, breadcrumb, Sala de Situação trigger, avatar, logout
- MUST implement FilterBar with cascaded unidade → equipe options from API or mock
- MUST implement AppContext: theme toggle (localStorage simpa-theme), isSituacao flag
- MUST implement Logo component with img fallback monograma "S"
</requirements>

## Subtasks
- [ ] 11.1 Layout grid matching design-system.md shell diagram
- [ ] 11.2 Sidebar + nav active states
- [ ] 11.3 Topbar + user menu
- [ ] 11.4 FilterBar + useFilters context hook

## Implementation Details

See auth design spec Section 3 and SIMPA.dc.html app shell lines 135–195.

### Relevant Files
- `simpa-frontend/src/components/layout/Sidebar.tsx` — create
- `simpa-frontend/src/components/layout/Topbar.tsx` — create
- `simpa-frontend/src/components/layout/FilterBar.tsx` — create
- `simpa-frontend/src/contexts/AppContext.tsx` — create

### Related ADRs
- [ADR-005: React Port](../adrs/adr-005.md)

## Deliverables
- Navigable app shell with all routes stubbed
- Theme toggle working without flash (apply before render)
- Filter state shared via context

## Tests
- Unit tests:
  - [ ] Nav highlights active route
  - [ ] Filter cascade resets equipe when unidade changes
  - [ ] Theme persists in localStorage
- Integration tests:
  - [ ] Shell renders for authenticated user
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Shell visually matches prototype sidebar/topbar structure
