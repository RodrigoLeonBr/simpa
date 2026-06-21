---
status: completed
title: Unify buildPaginatedCatalogQuery in enrichmentView
type: refactor
complexity: low
dependencies: []
---

# Task 01: Unify buildPaginatedCatalogQuery in enrichmentView

## Overview

Replace three identical query builder functions with one shared helper for paginated read-only catalog API calls. Foundation for tasks 02–04.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add `buildPaginatedCatalogQuery(q, page, extra?)` returning `Record<string, string>` with limit 200
- MUST refactor `buildFormasQuery`, `buildCbosQuery`, `buildProcedimentosQuery` to delegate to the unified helper (or deprecate with re-export)
- MUST preserve `buildEstabelecimentosQuery` perfil filter behavior unchanged
- MUST update any unit tests in `enrichmentView.test.ts` if present
</requirements>

## Subtasks

- [x] 1.1 Add unified query builder with optional extra params
- [x] 1.2 Wire existing three builders to delegate
- [x] 1.3 Add/update unit tests for query shape

## Implementation Details

### Relevant Files
- `simpa-frontend/src/utils/enrichmentView.ts` — query builders
- `simpa-frontend/src/utils/enrichmentView.test.ts` — tests if exists

### Related ADRs
- [ADR-002](../adrs/adr-002.md) — ReadOnlyCatalogPage decision

## Deliverables
- Unified query helper
- Unit tests passing
- No behavior change to API query strings

## Tests
- Unit: empty search, trimmed search, page number, extra filters
- `npm test --prefix simpa-frontend` green

## Success Criteria
- All tests passing
- Grep shows single implementation of limit/page/q logic
