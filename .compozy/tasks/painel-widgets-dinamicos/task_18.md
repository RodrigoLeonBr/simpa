---
status: completed
title: Agent docs and design spec expansion
type: docs
complexity: low
dependencies:
  - task_11
  - task_16
  - task_17
---

# Task 18: Agent docs and design spec expansion

## Overview

Update agent documentation hub and expand the design spec file with full Phase 0 inventory + backlog status after MVP implementation.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST expand `docs/superpowers/specs/2026-06-20-painel-widgets-dinamicos-design.md` per `.cursor/plans/painel_widgets_spec_81aac582.plan.md` sections 1–5
- MUST update `docs/agent/backend-api.md` with all painel-* and painel-layout endpoints
- MUST update `docs/agent/cadastros.md` with Indicadores do Painel module
- MUST update `docs/agent/frontend.md` Painel section for dynamic LayoutA + hook
- MUST update `docs/agent/database.md` if any schema notes changed (likely reference only)
- MUST add one-line entry in `CLAUDE.md` under functional modules map
- MUST update `docs/agent/testing-ci.md` with E2E spec name from task_17
- SHOULD keep CLAUDE.md ≤300 lines
</requirements>

## Subtasks
- [x] 18.1 Expand design spec with implemented vs pending checklist
- [x] 18.2 Document API endpoints with auth matrix
- [x] 18.3 Document frontend routes and roles
- [x] 18.4 Update CLAUDE.md index line
- [x] 18.5 Cross-link Compozy task dir from design spec

## Implementation Details

See TechSpec **Impact Analysis** table for file list. Follow tone of existing `docs/agent/` files.

### Relevant Files
- `docs/superpowers/specs/2026-06-20-painel-widgets-dinamicos-design.md`
- `docs/agent/backend-api.md`
- `docs/agent/frontend.md`
- `docs/agent/cadastros.md`
- `CLAUDE.md`

### Dependent Files
- None — final documentation task

## Deliverables
- Updated agent docs listed above
- Expanded design spec

## Tests
- Unit tests:
  - [x] N/A — documentation task
- Integration tests:
  - [x] Verify documented endpoint paths match `routes/*.js` (manual checklist in PR)
  - [x] `npm test` still passes (no code regressions from doc-only if docs-only)
- Documentation review: peer or agent verifies links resolve

## Success Criteria
- All agent doc links valid
- New developer can locate painel-widgets feature from CLAUDE.md hub alone
- Design spec reflects post-MVP state
