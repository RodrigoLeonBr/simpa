---
status: pending
title: Playwright E2E cadastro to Painel flow
type: test
complexity: medium
dependencies:
  - task_11
  - task_15
---

# Task 17: Playwright E2E cadastro to Painel flow

## Overview

Add end-to-end coverage: planning staff edits a widget title in cadastro and sees the updated title on the APS Painel Layout A.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `simpa-frontend/tests/e2e/painel-widgets.spec.ts` (or repo-root `tests/e2e/` per existing layout)
- MUST use existing E2E helpers for login as planning staff (`tests/e2e/helpers.ts`)
- MUST navigate Cadastros → Indicadores do Painel
- MUST edit first widget titulo to unique string and save
- MUST open Painel, APS Layout A, assert new titulo visible on KpiCard or chart heading
- MUST restore original titulo in afterEach or use unique reversible title
- MUST run in CI stack (:8080 + seed:e2e) per `docs/agent/testing-ci.md`
</requirements>

## Subtasks
- [ ] 17.1 Add spec file following `perfil-painel.spec.ts` patterns
- [ ] 17.2 Implement login + cadastro edit flow
- [ ] 17.3 Assert Painel reflects change
- [ ] 17.4 Verify spec passes locally against docker stack
- [ ] 17.5 Document any new data-testid requirements added in tasks 11–15

## Implementation Details

See TechSpec **E2E** section. Coordinate test ids with LayoutA and IndicadoresPainelPage implementations.

### Relevant Files
- `simpa-frontend/tests/e2e/perfil-painel.spec.ts` or `tests/e2e/` at repo root
- `tests/e2e/helpers.ts`
- `docs/agent/testing-ci.md`

### Dependent Files
- task_18 may reference E2E in testing-ci update

## Deliverables
- Playwright spec **(REQUIRED)**
- Any minimal `data-testid` additions for stable selectors

## Tests
- E2E tests:
  - [ ] Planning staff login succeeds
  - [ ] Cadastro page lists widgets
  - [ ] Edit widget title persists after save
  - [ ] Painel Layout A displays updated widget title
  - [ ] Cleanup restores seed title (no permanent data drift)
- All tests must pass in `npm run test:e2e`

## Success Criteria
- All E2E tests passing against Docker :8080
- CI pipeline includes new spec without flakiness on retry
