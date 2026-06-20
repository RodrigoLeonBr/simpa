---
status: completed
title: "Frontend API types and cadastros client methods"
type: frontend
complexity: low
dependencies:
  - task_04
---

# Task 05: Frontend API types and cadastros client methods

## Overview

Extend TypeScript types and `api/cadastros.ts` with `perfil_editado`, per-profile enrichment shapes, `updatePerfil`, and `updateEnrichmentBySlug`. Generalize establishment query helper for any perfil (replacing APS-only constant pattern).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add types `EstabelecimentoPerfil`, `EnrichmentSlug`, and per-profile enrichment interfaces in `types/cadastros.ts`
- MUST add `perfil_editado: boolean` to `Estabelecimento`
- MUST implement `updatePerfil(id, perfil)` calling `PUT .../perfil`
- MUST implement `updateEnrichmentBySlug(id, slug, body)` calling `PUT .../enriquecimento/:slug`
- MUST add `buildEstabelecimentosPerfilQuery(perfil)` in `estabelecimentosView.ts` (keep `ESTABELECIMENTOS_APS_QUERY` as alias or deprecate)
- MUST extend `EstabelecimentoPerfilFilter` to include `'Misto'`
- MUST add unit tests for API client URL construction and query builders
</requirements>

## Subtasks
- [x] 05.1 Update `types/cadastros.ts` with new types and fields
- [x] 05.2 Add client methods in `api/cadastros.ts`
- [x] 05.3 Generalize `estabelecimentosView.ts` query helper
- [x] 05.4 Update `cadastros.test.ts` and `estabelecimentosView` tests if present

## Implementation Details

See TechSpec **Core Interfaces** section. Do not implement UI in this task.

### Relevant Files
- `simpa-frontend/src/types/cadastros.ts`
- `simpa-frontend/src/api/cadastros.ts`
- `simpa-frontend/src/utils/estabelecimentosView.ts`
- `simpa-frontend/src/api/cadastros.test.ts`

### Dependent Files
- `EstabelecimentoDetailDrawer.tsx` — task_06
- `useDashboard.ts`, `FilterBar.tsx` — tasks_08–09

### Related ADRs
- [ADR-003: Profile-Specific Enrichment in Four Physical Tables](adrs/adr-003.md)

## Deliverables
- Updated types and API client functions
- Unit tests with 80%+ coverage on new exports **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `updatePerfil` calls `PUT /api/cadastros/estabelecimentos/{id}/perfil` with JSON body
  - [x] `updateEnrichmentBySlug` encodes slug in path segment
  - [x] `buildEstabelecimentosPerfilQuery('MAC')` includes `perfil=MAC` and limit 200
- Integration tests:
  - [x] N/A — MSW or fetch mock sufficient at this layer
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on modified client/utils files
- Typecheck passes with no `any` on new enrichment types
- Existing `fetchEstabelecimentosAps` callers still compile (alias preserved)
