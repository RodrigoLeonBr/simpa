---
status: completed
title: Frontend Establishments + Procedures pages
type: frontend
complexity: high
dependencies:
  - task_05
  - task_07
---

# Task 08: Frontend Establishments + Procedures pages

## Overview

Replace legacy CRUD pages for units/MAC/hospitals with Establishments list (profile filters, locked synced fields, enrichment form for Hospitalar) and read-only Procedures search table. Supersedes Task 16 entity pages for synced resources.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement `/cadastros/estabelecimentos` list with profile filter chips (APS/MAC/Hospitalar/All)
- MUST show synced fields as read-only with lock indicator
- MUST implement enrichment editor for Hospitalar/Misto profiles (leitos, especialidades, habilitacoes, notas)
- MUST implement `/cadastros/procedimentos` read-only searchable table without Novo button
- MUST use ModalPortal for detail/enrichment panels (existing pattern)
- MUST remove routes/pages for unidades, prestadores-mac, hospitais
- MUST keep Teams and Emendas CRUD pages functional
</requirements>

## Subtasks
- [x] 8.1 Create `EstabelecimentosPage` list + detail drawer
- [x] 8.2 Create `EnrichmentForm` component for hospital fields
- [x] 8.3 Create `ProcedimentosReadOnlyPage` with search
- [x] 8.4 Refactor/remove legacy `CadastroCrudPage` usages for deprecated entities
- [x] 8.5 Rewrite Cadastros vitest suite for new UX

## Implementation Details

See TechSpec **Frontend changes** and PRD **User Experience** — enrichment flow.

Reuse `DataTable`, `ModalPortal` from existing Task 16 components where applicable.

### Relevant Files
- `simpa-frontend/src/pages/Cadastros/EstabelecimentosPage.tsx` — create
- `simpa-frontend/src/pages/Cadastros/ProcedimentosPage.tsx` — create
- `simpa-frontend/src/components/cadastros/EnrichmentForm.tsx` — create
- `simpa-frontend/src/components/cadastros/CadastroCrudPage.tsx` — keep for equipes/emendas only
- `simpa-frontend/src/api/cadastros.ts` — fetchEstabelecimentos, updateEnriquecimento

### Dependent Files
- `simpa-frontend/vite.config.ts` — update coverage includes for new pages

### Related ADRs
- [ADR-001](adrs/adr-001.md), [ADR-003](adrs/adr-003.md)

## Deliverables
- Establishments and Procedures sub-routes functional against real/mock API
- Enrichment save persists via PUT enriquecimento
- Updated vitest suite

## Tests
- Unit tests:
  - [ ] Establishments list hides Novo button
  - [ ] Enrichment form validates numeric leitos fields
  - [ ] Procedures page has no create action buttons
  - [ ] Locked synced fields are disabled inputs
- Integration tests:
  - [ ] Save enrichment calls PUT and refreshes row display
  - [ ] Profile filter chip filters API query param
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- PRD enrichment flow completable in UI for Hospitalar establishment
