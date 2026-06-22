---
status: pending
title: UI SiaProducaoSyncBanner e client api/sia
type: frontend
complexity: medium
dependencies:
  - task_04
---

# Task 05: UI SiaProducaoSyncBanner e client api/sia

## Overview

Criar client HTTP e banner com **seletor ano/mês** para importar produção SIA agregada de uma competência, histórico por mês, distinguindo de sync de cadastros.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
- Preserve data-testid for E2E
</critical>

<requirements>
- MUST create api/sia.ts with sincronizar(competencia YYYY-MM), fetchSincronizacoes, fetchUltimaSync
- MUST use input type="month" for ano/mês selection; convert to YYYY-MM for API
- MUST label clearly "Importar produção SIA" vs cadastros sync
- MUST toast aggregated row count (not raw MySQL line count)
- MUST show last sync per competencia in history list
- MUST handle MySQL unavailable degraded state
- MUST mount on Cadastros below CadastroSyncBanner; planning staff only
- MUST on 409 show ConfirmDialog: competencia já importada, reimportar substitui dados
- MUST retry POST with reimportar:true after user confirms
- MUST optionally call GET existe on month change to show badge "Já importada"
</requirements>

## Subtasks

- [ ] 5.1 Types `types/sia.ts`
- [ ] 5.2 API client functions
- [ ] 5.3 Banner component + CSS classes (reuse cadastro-sync-*)
- [ ] 5.4 Wire into Cadastros index page
- [ ] 5.5 RTL tests loading/success/error

## Implementation Details

### Relevant Files
- `simpa-frontend/src/api/sia.ts` — new
- `simpa-frontend/src/types/sia.ts` — new
- `simpa-frontend/src/pages/Cadastros/SiaProducaoSyncBanner.tsx` — new
- `simpa-frontend/src/pages/Cadastros/index.tsx` — mount banner

### Dependent Files
- `CadastroSyncBanner.tsx` — pattern reference

## Deliverables
- UI operacional + api client + Vitest

## Tests
- Unit tests:
  - [ ] Renders last sync when loaded
  - [ ] Shows syncing state on click
  - [ ] Month picker sends correct YYYY-MM to API
  - [ ] Toast mentions aggregated import count
  - [ ] ConfirmDialog shown on 409; confirm sends reimportar:true
  - [ ] Badge "Já importada" when GET existe returns true
- Integration tests:
  - [ ] (optional) E2E smoke cadastros sia sync
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Planejamento escolhe ano/mês e importa produção agregada pela UI
