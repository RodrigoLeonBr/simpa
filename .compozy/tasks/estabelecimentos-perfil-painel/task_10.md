---
status: completed
title: "Playwright E2E for perfil edit and multi-profile Painel"
type: test
complexity: medium
dependencies:
  - task_06
  - task_09
---

# Task 10: Playwright E2E for perfil edit and multi-profile Painel

## Overview

Extend the Playwright critical flow to cover establishment perfil editing in Cadastros and multi-profile Painel behavior: unit list refresh, APS dashboard render, and placeholder state for non-APS profiles.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST extend `simpa-frontend/tests/e2e/critical-flow.spec.ts` (or add focused spec file imported by CI) with Cadastros perfil edit scenario
- MUST assert Painel profile switch to MAC shows placeholder copy (indicadores em definição or equivalent test id)
- MUST assert Painel APS profile shows existing painel-page content (layout switcher + KPI region)
- MUST use default E2E credentials (`admin` / `simpa@2026`) and Docker test stack on port 8080
- MUST ensure tests pass in `npm run test:e2e` against `docker:test` stack
- SHOULD seed at least one establishment per perfil in test DB or use existing sync seed data
</requirements>

## Subtasks
- [x] 10.1 Add E2E: navigate to Estabelecimentos, open drawer, change perfil, verify list chip
- [x] 10.2 Add E2E: Painel select MAC profile, assert placeholder visible
- [x] 10.3 Add E2E: Painel select APS, switch layouts A/B/C smoke assertions
- [x] 10.4 Verify CI workflow still passes Playwright job

## Implementation Details

See TechSpec **Testing Approach — E2E** section. Reuse patterns from existing critical-flow login → painel → cadastros navigation.

### Relevant Files
- `simpa-frontend/tests/e2e/critical-flow.spec.ts`
- `simpa-frontend/playwright.config.ts`
- `.github/workflows/ci.yml`
- `docker-compose.test.yml`

### Dependent Files
- None — terminal verification task

### Related ADRs
- [ADR-001: Editable Establishment Profile with Phased Multi-Profile Dashboard](adrs/adr-001.md)

## Deliverables
- Updated Playwright spec(s) covering perfil edit and Painel profile switcher
- E2E tests passing locally against Docker test stack **(REQUIRED)**

## Tests
- Unit tests:
  - [x] N/A — E2E task
- Integration tests:
  - [x] E2E: login as admin → Cadastros → Estabelecimentos → change perfil on first row → success toast or drawer shows new perfil
  - [x] E2E: Painel → click MAC profile → `[data-testid=painel-profile-placeholder]` visible
  - [x] E2E: Painel → APS → `[data-testid=painel-page]` and `[data-testid=layout-a]` visible
  - [x] E2E: Painel APS → switch to layout C → `[data-testid=layout-c]` visible
- Test coverage target: E2E scenarios above all green
- All tests must pass

## Success Criteria
- All tests passing
- `npm run test:e2e` succeeds against running docker test stack
- New scenarios documented in spec file header comments
- No flake on profile switch (use stable test ids from tasks 06 and 09)
