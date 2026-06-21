---
status: completed
title: Component ReadOnlyCatalogPage with tests
type: frontend
complexity: medium
dependencies:
  - task_02
---

# Task 03: Component ReadOnlyCatalogPage with tests

## Overview

Create config-driven read-only catalog page shell matching current Formas/CBOs UX (header, search, table, pagination, states).

<critical>
- TESTS REQUIRED
- Preserve data-testid patterns for E2E stability
</critical>

<requirements>
- MUST create `components/cadastros/ReadOnlyCatalogPage.tsx` per TechSpec props
- MUST reuse `ReadOnlyDataTable` and existing CSS classes (`cadastro-page`, etc.)
- MUST render loading, error, empty states in Portuguese
- MUST include `ReadOnlyCatalogPage.test.tsx` with mocked catalog hook return
</requirements>

## Subtasks

- [x] 3.1 Implement layout matching FormasPage structure
- [x] 3.2 Wire pagination controls
- [x] 3.3 Add RTL tests for empty and populated states

## Implementation Details

### Relevant Files
- `simpa-frontend/src/components/cadastros/ReadOnlyCatalogPage.tsx`
- `simpa-frontend/src/components/cadastros/ReadOnlyDataTable.tsx`

## Deliverables
- Component + tests

## Tests
- Renders columns and rows when loaded
- Shows empty state when rows length 0
- Search form calls handleSearch

## Success Criteria
- Component tests pass
- Visual parity with FormasPage when wired in task_04
