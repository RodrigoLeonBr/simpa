---
status: completed
title: Frontend Cadastros grid + sync banner
type: frontend
complexity: medium
dependencies:
  - task_04
---

# Task 07: Frontend Cadastros grid + sync banner

## Overview

Redesign Cadastros landing: replace six legacy cards with PRD-aligned set, add global **Update cadastros from SIA** button, show last sync timestamp and result toast. Update API client with sync functions.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST show cards: Establishments, Procedures, Teams, Amendments, Indicators & Metas (link to Admin)
- MUST remove cards: Unidades, Prestadores MAC, Hospitais as separate entries
- MUST implement sync button calling `POST /api/cadastros/sincronizar`
- MUST display last sync from `GET /api/cadastros/sincronizacoes/ultima`
- MUST show error state when MySQL unavailable (reuse SIA degraded messaging pattern)
- MUST update routes in `pages/Cadastros/index.tsx` for new sub-paths
</requirements>

## Subtasks
- [x] 7.1 Update `cadastroEntities.ts` / grid config for new card set
- [x] 7.2 Add `sincronizarCadastros()` and sync status to `api/cadastros.ts`
- [x] 7.3 Add sync banner component on Cadastros index
- [x] 7.4 Update navigation tests for new routes

## Implementation Details

See TechSpec **Frontend changes** — grid and sync banner. Reuse existing `CadastroGrid.tsx` and Toast patterns from Importação.

### Relevant Files
- `simpa-frontend/src/pages/Cadastros/CadastroGrid.tsx` — redesign
- `simpa-frontend/src/pages/Cadastros/index.tsx` — route updates
- `simpa-frontend/src/config/cadastroEntities.ts` — card definitions
- `simpa-frontend/src/api/cadastros.ts` — sync API functions
- `simpa-frontend/src/types/cadastros.ts` — create TypeScript contracts per TechSpec

### Dependent Files
- `simpa-frontend/src/pages/Cadastros/Cadastros.test.tsx` — update tests

### Related ADRs
- [ADR-001: Unified Establishment Mirror](adrs/adr-001.md)

## Deliverables
- New Cadastros landing with 4–5 cards + sync UI
- API client sync methods
- Vitest coverage for sync button and grid cards

## Tests
- Unit tests:
  - [ ] Grid renders Establishments card and not legacy Unidades/MAC/Hospitais cards
  - [ ] Sync button calls API and shows success toast with counts
  - [ ] Sync error displays degraded message without crash
- Integration tests:
  - [ ] Click sync refreshes last-sync badge from mocked ultima endpoint
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- User can trigger sync from Cadastros index and see timestamp update
