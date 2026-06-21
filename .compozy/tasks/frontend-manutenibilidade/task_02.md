---
status: completed
title: Hook usePaginatedCatalog with tests
type: frontend
complexity: medium
dependencies:
  - task_01
---

# Task 02: Hook usePaginatedCatalog with tests

## Overview

Extract shared pagination/search state machine used by Formas, CBOs, and Procedimentos into a reusable hook.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- TESTS REQUIRED
</critical>

<requirements>
- MUST create `hooks/usePaginatedCatalog.ts` per TechSpec interface
- MUST expose: search, appliedSearch, page, rows, total, pages, loading, error, carregar, handleSearch, setPage
- MUST accept injected `fetchPage` and `buildQuery` functions
- MUST include `usePaginatedCatalog.test.ts` with mocked fetch
</requirements>

## Subtasks

- [x] 2.1 Implement hook with useCallback/useEffect load cycle
- [x] 2.2 Handle error path clearing rows/total
- [x] 2.3 Write unit tests for search reset page and fetch invocation

## Implementation Details

### Relevant Files
- `simpa-frontend/src/hooks/usePaginatedCatalog.ts` — new
- `simpa-frontend/src/hooks/usePaginatedCatalog.test.ts` — new

### Dependent Files
- `simpa-frontend/src/pages/Cadastros/FormasPage.tsx` — consumer in task_04

## Deliverables
- Hook + tests
- Export types from hook file

## Tests
- Mock fetch resolves/rejects
- Search submit sets appliedSearch and page 1
- Page change triggers refetch

## Success Criteria
- Hook test coverage ≥80%
- No page component changes in this task
