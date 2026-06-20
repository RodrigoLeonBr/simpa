---
status: completed
title: Agent docs — import de-para and schema reference
type: docs
complexity: low
dependencies:
  - task_09
---

# Task 10: Agent docs — import de-para and schema reference

## Overview

Update `docs/agent/` module docs to reflect migration 006, new import endpoints, mapping flow, and Panel ID-based dashboard query. Keep `CLAUDE.md` index accurate if new endpoints are material.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST update `docs/agent/database.md` with `esus_import_mapeamentos` and FK columns on `esus_cargas` / `dados_consolidados`
- MUST update `docs/agent/backend-api.md` Importação and Dashboard endpoint tables
- MUST update `docs/agent/frontend.md` Importação page and useDashboard ID behavior
- MUST mention migration 006 apply order after 005
- SHOULD add workflow subsection in `docs/agent/cadastros.md` linking de-para to estabelecimentos (one paragraph)
- MUST NOT exceed CLAUDE.md line budget; add pointer to docs/agent only if needed
</requirements>

## Subtasks
- [x] 10.1 Update database.md schema section
- [x] 10.2 Update backend-api.md import and dashboard routes
- [x] 10.3 Update frontend.md import and painel filter sections
- [x] 10.4 Optional one-line CLAUDE.md map entry for import de-para

## Implementation Details

See TechSpec **Development Sequencing** step 12 and PRD traceability table.

### Relevant Files
- `docs/agent/database.md`
- `docs/agent/backend-api.md`
- `docs/agent/frontend.md`
- `docs/agent/cadastros.md`
- `CLAUDE.md`

### Dependent Files
- None

### Related ADRs
- [ADR-001: Mapping Registry with Preview Gate](adrs/adr-001.md)
- [ADR-002: Cadastro keys on import storage](adrs/adr-002.md)

## Deliverables
- Updated agent documentation files
- Docs consistency check (manual): endpoint paths match implemented routes **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] N/A — documentation task
- Integration tests:
  - [x] Verify every documented endpoint path exists in `routes/importacao.js` and `routes/dashboard.js`
  - [x] Verify migration filename matches `docker-compose.yml` mount
- Test coverage target: N/A
- All verification checks must pass

## Success Criteria
- Agent docs accurately describe de-para import flow and ID-based Panel query
- New contributor can follow docs/agent to implement without reading full TechSpec
- CLAUDE.md remains ≤300 lines
