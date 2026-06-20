---
status: completed
title: "Backend estabelecimentos service — perfil and enrichment tables"
type: backend
complexity: high
dependencies:
  - task_01
---

# Task 03: Backend estabelecimentos service — perfil and enrichment tables

## Overview

Refactor `estabelecimentosService.js` to support `updatePerfil`, per-slug enrichment upserts into normalized tables, and detail GET with enrichment JOIN for the establishment's current perfil. Remove hospital-only `ENRICHMENT_PERFIS` gate and JSONB write path.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement `updatePerfil(id, perfil)` setting `perfil_editado=true` and validating against `VALID_PERFIS`
- MUST implement `upsertEnrichment(id, slug, body)` targeting `enriquecimento_{slug}` with slug/perfil alignment (403 on mismatch)
- MUST implement per-slug validation rules from TechSpec API Endpoints table
- MUST update `getEstabelecimentoById` to return `perfil_editado` and enrichment payload for current perfil
- MUST keep `listEstabelecimentos` without enrichment JOINs; support `perfil=Misto` filter
- MUST stop writing to `estabelecimentos.enriquecimento` JSONB column
- MUST include unit tests in `simpa-backend/tests/estabelecimentos.test.js`
</requirements>

## Subtasks
- [x] 03.1 Add `updatePerfil` with validation and DB update
- [x] 03.2 Add slug→table map and validators for aps/mac/hospitalar/misto/outro
- [x] 03.3 Refactor `getEstabelecimentoById` LEFT JOIN enrichment for active perfil
- [x] 03.4 Remove or redirect legacy `updateEnriquecimento` JSONB logic
- [x] 03.5 Expand unit tests for all slugs and perfil mismatch 403

## Implementation Details

See TechSpec **Core Interfaces** and **API Endpoints**. Map hospital validation from existing `validateEnrichmentPayload` / `mergeEnrichment` into hospitalar table handler.

### Relevant Files
- `simpa-backend/src/services/estabelecimentosService.js` — primary changes
- `simpa-backend/tests/estabelecimentos.test.js` — unit tests
- `migration_005_estabelecimentos_perfil_enrichment.sql` — table shapes

### Dependent Files
- `simpa-backend/src/routes/cadastros.js` — wired in task_04
- `simpa-frontend/src/api/cadastros.ts` — clients in task_05

### Related ADRs
- [ADR-002: Preserve Manual Perfil via perfil_editado Flag](adrs/adr-002.md)
- [ADR-003: Profile-Specific Enrichment in Four Physical Tables](adrs/adr-003.md)

## Deliverables
- Updated `estabelecimentosService.js` exports: `updatePerfil`, `upsertEnrichment`, updated getters
- Unit tests with 80%+ coverage on service module **(REQUIRED)**
- Integration tests in `cadastros.integration.test.js` prep **(REQUIRED)** — full route tests completed in task_04

## Tests
- Unit tests:
  - [x] `updatePerfil` with valid perfil sets `perfil_editado=true` in returned row
  - [x] `updatePerfil` rejects invalid perfil string with 400
  - [x] `upsertEnrichment` hospitalar: negative leitos value returns 400
  - [x] `upsertEnrichment` with slug `aps` on establishment with `perfil='Hospitalar'` returns 403
  - [x] `getEstabelecimentoById` includes enrichment object when hospitalar row exists
  - [x] `listEstabelecimentos` with `perfil=Misto` filters correctly
- Integration tests:
  - [x] Direct service call round-trip upsert hospitalar then GET detail
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on `estabelecimentosService.js`
- Legacy JSONB enrichment no longer written by service layer
- All five enrichment slugs validated independently
