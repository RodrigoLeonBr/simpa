---
status: pending
title: Hook useEntityCrud extracted from CRUD pages
type: frontend
complexity: high
dependencies: []
---

# Task 08: Hook useEntityCrud extracted from CRUD pages

## Overview

Extract shared list/form/confirm/toast state machine from UsuariosPage and CadastroCrudPage into reusable hook per ADR-004.

<requirements>
- MUST create `hooks/useEntityCrud.ts` per TechSpec options interface
- MUST support create, update, inactivate flows with formOpen, editing, confirmOpen, busyId
- MUST integrate with useToast pattern
- MUST include comprehensive `useEntityCrud.test.ts`
- MUST NOT refactor consumer pages in this task (tasks 09–10)
</requirements>

## Subtasks

- [ ] 8.1 Extract state/handlers from UsuariosPage analysis
- [ ] 8.2 Implement hook with generic typing
- [ ] 8.3 Unit test all handler paths

## Related ADRs
- [ADR-004](../adrs/adr-004.md)

## Success Criteria
- Hook tests ≥80% coverage
- CadastroCrudPage unchanged (optional internal adoption deferred)
