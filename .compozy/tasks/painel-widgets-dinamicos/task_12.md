---
status: completed
title: Cadastros grid entry and route wiring
type: frontend
complexity: low
dependencies:
  - task_08
---

# Task 12: Cadastros grid entry and route wiring

## Overview

Register the new cadastro module in navigation: grid card, route path `indicadores-painel`, and React Router entry under Cadastros.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add grid item in `cadastroEntities.ts`: title **Indicadores do Painel**, route `indicadores-painel`
- MUST add Route in `Cadastros/index.tsx` pointing to placeholder or page component
- MUST add `cadastroGridTestId('indicadores-painel')` compatible test id
- MUST NOT remove existing `/admin` Indicadores e Metas external card (coexist)
- MUST update `Cadastros.test.tsx` to expect new card
</requirements>

## Subtasks
- [x] 12.1 Add CADASTRO_GRID_ITEMS entry with description distinguishing from /indicadores page
- [x] 12.2 Register route (lazy or direct import stub until task_13)
- [x] 12.3 Update cadastro grid test
- [x] 12.4 Verify navigation from /cadastros grid works

## Implementation Details

See TechSpec **PRD Open Questions — Cadastro label**. Follow `equipes` / `emendas` routing pattern (dedicated page, not CadastroCrudPage).

### Relevant Files
- `simpa-frontend/src/config/cadastroEntities.ts`
- `simpa-frontend/src/pages/Cadastros/index.tsx`
- `simpa-frontend/src/pages/Cadastros/Cadastros.test.tsx`

### Dependent Files
- `IndicadoresPainelPage.tsx` — task_13

## Deliverables
- Updated cadastroEntities, Cadastros index route, tests **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Grid renders card `cadastro-card-indicadores-painel`
  - [x] Route `/cadastros/indicadores-painel` resolves without 404
- Test coverage target: >=80% on touched files
- All tests must pass

### Validation evidence
- `npx vitest run src/pages/Cadastros/Cadastros.test.tsx` ✅ (8/8)
- `npx vitest run src/pages/Cadastros/Cadastros.test.tsx src/config/cadastroEntities.test.ts --coverage --coverage.include=src/pages/Cadastros/index.tsx --coverage.include=src/config/cadastroEntities.ts --coverage.include=src/pages/Cadastros/IndicadoresPainelPage.tsx` ✅ (coverage 100% nos arquivos incluídos)
- `npx tsc --noEmit` ✅

## Success Criteria
- All tests passing
- Cadastros hub shows new card with correct copy
