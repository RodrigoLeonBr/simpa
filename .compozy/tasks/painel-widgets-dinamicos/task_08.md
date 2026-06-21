---
status: completed
title: Frontend types and painelWidgets API client
type: frontend
complexity: medium
dependencies:
  - task_05
  - task_06
  - task_07
---

# Task 08: Frontend types and painelWidgets API client

## Overview

Add TypeScript contracts matching TechSpec response shapes and HTTP client functions for Painel layout runtime and cadastro CRUD/catalog APIs.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `simpa-frontend/src/types/painelWidgets.ts` per TechSpec Core Interfaces
- MUST create `simpa-frontend/src/api/painelWidgets.ts` using `apiFetch` from `client.ts`
- MUST export: `fetchPainelLayout`, `fetchPainelWidgets`, `fetchPainelWidget`, `createPainelWidget`, `updatePainelWidget`, `reorderPainelWidgets`, `inactivatePainelWidget`, `previewPainelWidget`, `fetchPainelMetricas`, `fetchPainelMetrica`, `discoverPainelMetricas`
- MUST pass competencia and filter IDs as query params matching backend
- MUST type error responses consistently with existing API modules
</requirements>

## Subtasks
- [x] 08.1 Define TS interfaces for catalog, widget config, resolved widget, layout response
- [x] 08.2 Implement runtime `fetchPainelLayout`
- [x] 08.3 Implement cadastro widget CRUD client functions
- [x] 08.4 Implement metric catalog + discover client functions
- [x] 08.5 Vitest tests mocking `apiFetch`

## Implementation Details

See TechSpec **Core Interfaces** (TypeScript block). Follow patterns in `api/dashboard.ts` and `api/cadastros.ts`.

### Relevant Files
- `simpa-frontend/src/api/client.ts`
- `simpa-frontend/src/api/dashboard.ts`
- `simpa-frontend/src/api/cadastros.ts`

### Dependent Files
- All frontend tasks 09–16

## Deliverables
- `types/painelWidgets.ts`
- `api/painelWidgets.ts`
- `api/painelWidgets.test.ts` **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `fetchPainelLayout` builds URL with competencia and optional estabelecimentoId
  - [x] `createPainelWidget` POSTs JSON body to correct path
  - [x] `discoverPainelMetricas` POSTs to descobrir endpoint
  - [x] Types compile under `npm run test:web` / tsc
- Test coverage target: >=80% on api module
- All tests must pass

### Validation evidence
- `npx vitest run src/api/painelWidgets.test.ts` ✅ (4/4 passing)
- `npx tsc --noEmit` ✅
- `npm run test:web` ⚠️ test files passed (245/245), but global branch coverage gate failed at 78.54% (<80%), not isolated to this task module.

## Success Criteria
- All tests passing
- API client callable from browser dev against local backend
