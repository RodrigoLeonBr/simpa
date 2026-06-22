---
status: completed
title: Refactor UsuariosPage with useEntityCrud
type: frontend
complexity: medium
dependencies:
  - task_08
---

# Task 09: Refactor UsuariosPage with useEntityCrud

## Overview

Replace bespoke CRUD state in UsuariosPage with useEntityCrud while preserving UX and testIds.

<requirements>
- MUST refactor `pages/Administracao/Usuarios.tsx` to use hook
- MUST keep Administracao.test.tsx passing (create, edit, inactivate flows)
- MUST preserve ConfirmDialog and FormDialog behavior
- Page SHOULD be ≤120 lines after refactor
</requirements>

## Subtasks

- [x] 9.1 Wire hook to admin API functions
- [x] 9.2 Simplify component to presentation + hook
- [x] 9.3 Fix/update Administracao.test.tsx if mocks change

## Success Criteria
- All Administracao tests pass
- Manual smoke: create/edit/inactivate usuario

## Verification (2026-06-21)

- `Usuarios.tsx` → 124 linhas; mappers em `adminView.ts`
- `useEntityCrud<AdminUsuario, UsuarioCreatePayload, UsuarioUpdatePayload>`
- Administracao.test.tsx: 12 passing
- `tsc -b` + build OK; main gzip 259.97 KB
