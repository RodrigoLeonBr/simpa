---
status: completed
title: Migrate Formas/CBOs/Procedimentos to unified catalog
type: frontend
complexity: low
dependencies:
  - task_03
---

# Task 04: Migrate Formas/CBOs/Procedimentos to unified catalog

## Overview

Refactor three catalog pages to thin configuration wrappers around ReadOnlyCatalogPage + usePaginatedCatalog.

<requirements>
- MUST reduce each page to ~30–40 lines (columns, fetch, copy, testId)
- MUST preserve API calls: fetchFormas, fetchCbos, fetchProcedimentos
- MUST keep existing testIds or update Cadastros.test.tsx accordingly
- MUST run `npm run build` and Cadastros-related tests
</requirements>

## Subtasks

- [x] 4.1 Migrate FormasPage
- [x] 4.2 Migrate CbosPage
- [x] 4.3 Migrate ProcedimentosPage
- [x] 4.4 Update Cadastros.test.tsx if needed (não necessário — testIds preservados)

## Implementation Details

### Relevant Files
- `simpa-frontend/src/pages/Cadastros/FormasPage.tsx`
- `simpa-frontend/src/pages/Cadastros/CbosPage.tsx`
- `simpa-frontend/src/pages/Cadastros/ProcedimentosPage.tsx`

## Deliverables
- Three thin pages
- Tests green

## Success Criteria
- Each page < 50 lines
- Manual smoke: search + pagination on all three catalogs
