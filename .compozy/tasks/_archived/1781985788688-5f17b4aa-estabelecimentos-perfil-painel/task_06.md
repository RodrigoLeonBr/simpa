---
status: completed
title: "Cadastros UI — editable perfil and per-profile enrichment forms"
type: frontend
complexity: high
dependencies:
  - task_05
---

# Task 06: Cadastros UI — editable perfil and per-profile enrichment forms

## Overview

Update the establishments cadastro so planning staff can edit Perfil in the detail drawer, see profile-appropriate enrichment forms, and filter the list including a Misto chip. Gate edit controls by user role (Administrador, Gestor Secretaria, Planejamento).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST replace locked Perfil field with editable select for planning roles in `EstabelecimentoDetailDrawer.tsx`
- MUST call `updatePerfil` on save and refresh list row on success
- MUST render profile-specific enrichment form components (APS, MAC, Hospitalar, Misto, Outro) keyed to current perfil
- MUST add Misto chip to `EstabelecimentosPage.tsx` filter bar
- MUST hide edit controls for users without planning staff role (use AuthContext / adminView helpers)
- MUST update or split `EnrichmentForm.tsx` into per-profile forms with validation mirroring backend rules
- MUST include component tests for drawer and enrichment helpers
</requirements>

## Subtasks
- [x] 06.1 Add editable perfil control with role gate and save handler
- [x] 06.2 Create `EnrichmentFormAps`, `EnrichmentFormMac`, etc. (or single switch component)
- [x] 06.3 Wire `updateEnrichmentBySlug` on submit per active perfil
- [x] 06.4 Add Misto filter chip and update page tests
- [x] 06.5 Update `enrichmentView.ts` / add `enrichmentByPerfil.ts` helpers

## Implementation Details

See PRD **User Experience — Cadastros** and TechSpec **Impact Analysis** (drawer, EnrichmentForm). Reuse `LockedField` for SIA identity fields; perfil is editable, not locked.

### Relevant Files
- `simpa-frontend/src/pages/Cadastros/EstabelecimentoDetailDrawer.tsx`
- `simpa-frontend/src/pages/Cadastros/EstabelecimentosPage.tsx`
- `simpa-frontend/src/components/cadastros/EnrichmentForm.tsx`
- `simpa-frontend/src/utils/enrichmentView.ts`
- `simpa-frontend/src/contexts/AuthContext.tsx`
- `simpa-frontend/src/pages/Cadastros/EstabelecimentosPage.test.tsx`

### Dependent Files
- `simpa-frontend/tests/e2e/critical-flow.spec.ts` — task_10

### Related ADRs
- [ADR-001: Editable Establishment Profile with Phased Multi-Profile Dashboard](adrs/adr-001.md)
- [ADR-003: Profile-Specific Enrichment in Four Physical Tables](adrs/adr-003.md)

## Deliverables
- Updated drawer, list page, and per-profile enrichment forms
- Unit/component tests with 80%+ coverage on changed Cadastros modules **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Drawer renders perfil as disabled input for non-planning user
  - [x] Drawer renders perfil select for planning user
  - [x] `canEditEnrichment` (or replacement) returns true for all five perfis when role allows
  - [x] Hospitalar form rejects negative leito values client-side before submit
  - [x] Misto chip sets `perfil=Misto` in list query
- Integration tests:
  - [x] `EstabelecimentosPage.test.tsx`: mock API perfil update refreshes table row
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on Cadastros components touched
- Planning user can change perfil and save enrichment per profile in manual UAT
- SIA fields remain read-only with lock affordance
