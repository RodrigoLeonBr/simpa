---
status: completed
title: Repository guide docs/esus-sigtap-depara.md
type: docs
complexity: low
dependencies:
  - task_04
  - task_05
---

# Task 09: Repository guide docs/esus-sigtap-depara.md

## Overview

Write the repository how-to so operators and implementers understand the de-para catalog, seed provenance, CRUD maintenance, and the exact lookup contract used by export and consolidator. Complements in-app help from task_07.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST create `docs/esus-sigtap-depara.md` covering: purpose, tables, seed how-to, CRUD usage, lookup contract `(secao, descricao)`, silent-skip behavior, export API (JSON/CSV), consolidator field.
2. MUST document real e-SUS section names used in seed.
3. MUST document CSV column list and example curl for export.
4. MUST link to PRD/TechSpec/ADRs under `.compozy/tasks/esus-sigtap-depara/`.
5. SHOULD add a short pointer from `readme.md` to this guide.
6. MUST state that spreadsheet quantities are not stored; production quantities come from e-SUS loads.
7. Docs “tests” MUST include a checklist verifying links/paths exist and example commands match implemented routes.
</requirements>

## Subtasks
- [x] 9.1 Draft guide sections listed in requirements
- [x] 9.2 Add example export curl/CLI snippets matching task_05
- [x] 9.3 Link ADRs and schema/seed file paths
- [x] 9.4 Add readme pointer
- [x] 9.5 Run doc verification checklist (links, route paths, column names)

## Implementation Details

See TechSpec component `docs/esus-sigtap-depara.md` and PRD Core Features §4. Do not duplicate large TechSpec code blocks; reference sections by name.

**Delivered:**
- `docs/esus-sigtap-depara.md`
- Pointer in `readme.md`
- Verification: `tests/test_docs_esus_sigtap_depara.py` (8/8)

### Relevant Files
- `readme.md` — add link
- `docs/` — existing docs folder
- `.compozy/tasks/esus-sigtap-depara/_prd.md` / `_techspec.md` / `adrs/`

### Dependent Files
- In-app help (task_07) should stay consistent with this guide’s silent-skip wording

### Related ADRs
- [ADR-001](adrs/adr-001.md) through [ADR-004](adrs/adr-004.md) — cite in guide

## Deliverables
- `docs/esus-sigtap-depara.md`
- `readme.md` pointer
- Doc verification checklist completed **(REQUIRED)**
- Any link-check script covered at >=80% if introduced **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Doc checklist asserts export path `/api/procedimentos/export` appears in guide
  - [x] Doc checklist asserts CSV columns match TechSpec order
  - [x] Doc checklist asserts silent-skip is documented
- Integration tests:
  - [x] All relative links to ADRs/PRD/TechSpec/seed/schema resolve on disk
  - [x] Example curl matches mounted route in `app.js` after task_05
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- New engineer can apply seed, call export, and explain lookup after reading the guide alone
- Wording aligned with in-app help (silent skip, exact match)
