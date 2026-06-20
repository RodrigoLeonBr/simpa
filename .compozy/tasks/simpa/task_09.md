---
status: pending
title: Frontend scaffold + design system
type: frontend
complexity: high
dependencies: []
---

# Task 09: Frontend scaffold + design system

## Overview

Bootstrap `simpa-frontend/` with Vite, React 18, TypeScript, Tailwind, React Router, and the IBM Plex design system from `docs/design-system.md`. Define ContratoDashboard types and json-server mock for parallel development.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create Vite React TS project per Plano C
- MUST implement CSS custom properties in index.css matching design-system.md (light + dark)
- MUST define `src/types/contrato.ts` with ContratoDashboard v3.1.0 including indicadores_qualidade
- MUST provide json-server mock on port 3100 with fixture from PRD Section 5
- MUST configure IBM Plex fonts in index.html
</requirements>

## Subtasks
- [ ] 9.1 Initialize Vite project and Tailwind
- [ ] 9.2 Port design tokens to index.css (:root and [data-theme="dark"])
- [ ] 9.3 Create contrato.ts types and mock/db.json
- [ ] 9.4 Setup React Router skeleton with placeholder routes

## Implementation Details

See auth design spec Section 2 and Plano C Task 1.

### Relevant Files
- `simpa-frontend/src/index.css` — create
- `simpa-frontend/src/types/contrato.ts` — create
- `simpa-frontend/mock/db.json` — create
- `docs/design-system.md` — token reference

### Related ADRs
- [ADR-005: React Port of SIMPA.dc.html](../adrs/adr-005.md)

## Deliverables
- Dev server on 5173 with themed shell
- Mock API on 3100 serving dashboard contract
- Vitest setup for utility functions

## Tests
- Unit tests:
  - [ ] Theme toggle sets data-theme on documentElement
  - [ ] Contrato types compile against mock fixture
- Integration tests:
  - [ ] fetch mock dashboard returns 200
- Test coverage target: >=80% on utils
- All tests must pass

## Success Criteria
- All tests passing
- Visual tokens match SIMPA.dc.html login brand colors
