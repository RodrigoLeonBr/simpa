---
status: completed
title: Lazy route loading in App.tsx + ModuleLoadingFallback
type: frontend
complexity: medium
dependencies: []
---

# Task 07: Lazy route loading in App.tsx + ModuleLoadingFallback

## Overview

Implement route-level code splitting for Cadastros, Importação, and Admin per ADR-003.

<requirements>
- MUST use React.lazy for CadastrosPage, ImportacaoPage, AdminPage
- MUST wrap lazy routes in Suspense with `ModuleLoadingFallback` component
- MUST keep Login and PainelPage eager imports
- MUST add chunk load error UI (ErrorBoundary or route error element) with PT message + retry hint
- MUST verify build produces separate chunks
</requirements>

## Subtasks

- [x] 7.1 Create ModuleLoadingFallback + optional ModuleLoadError
- [x] 7.2 Refactor App.tsx lazy imports
- [x] 7.3 Record before/after gzip size in task memory

## Related ADRs
- [ADR-003](../adrs/adr-003.md)

## Relevant Files
- `simpa-frontend/src/App.tsx`
- `simpa-frontend/src/components/shared/ModuleLoadingFallback.tsx` (new)

## Tests
- App still renders Painel for authenticated user (existing tests)
- Build succeeds with multiple output chunks

## Success Criteria
- Initial bundle gzip reduced vs baseline ~277 KB
- Navigation to /cadastros shows fallback then content
