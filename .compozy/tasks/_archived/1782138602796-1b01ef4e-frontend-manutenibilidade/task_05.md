---
status: completed
title: Consolidate api/cadastros types to types/cadastros
type: refactor
complexity: low
dependencies: []
---

# Task 05: Consolidate api/cadastros types to types/cadastros

## Overview

Remove duplicate TypeScript interfaces from API client; single source of truth in `types/cadastros.ts`.

<requirements>
- MUST remove duplicate entity interfaces from `api/cadastros.ts`
- MUST import types from `types/cadastros.ts` in API module
- MUST fix any broken imports across frontend
- MUST run `tsc -b` clean
</requirements>

## Subtasks

- [x] 5.1 Audit duplicates between api and types
- [x] 5.2 Consolidate and re-export if needed for backward compat
- [x] 5.3 Fix imports; run build

## Relevant Files
- `simpa-frontend/src/api/cadastros.ts`
- `simpa-frontend/src/types/cadastros.ts`

## Success Criteria
- No duplicate interface definitions in api/cadastros.ts
- Build passes
