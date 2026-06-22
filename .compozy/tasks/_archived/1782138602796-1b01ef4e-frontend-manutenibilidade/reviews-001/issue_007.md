---
provider: manual
pr:
round: 1
round_created_at: 2026-06-22T02:00:00Z
status: resolved
file: simpa-frontend/src/pages/Administracao/Usuarios.tsx
line: 88
severity: medium
author: claude-code
provider_ref:
---

# Issue 007: Admin can edit own account but not inactivate it

## Review Comment

`onInactivate` guards `original.username === user?.username`, but `onEdit` has no equivalent guard. An Administrador can open the edit dialog for their own row and change `ativo` to “não” or demote their `perfil`, potentially locking themselves out — inconsistent with the inactivate protection.

**Fix:** Skip edit button for the logged-in user (`onEdit` early return), or disable `ativo`/`perfil` fields in `FormDialog` when `editingRow.username === user?.username`. Add Vitest case in `Administracao.test.tsx`.

## Triage

- Decision: `VALID`
- Notes:
  - Há proteção para inativar o próprio usuário, mas não para editar o próprio registro.
  - Isso permite auto-demissão/auto-inativação por edição e pode bloquear acesso administrativo.
  - Correção aplicada em `src/pages/Administracao/Usuarios.tsx`: `onEdit` retorna cedo para o usuário logado.
  - Teste adicionado em `src/pages/Administracao/Administracao.test.tsx` para garantir bloqueio.
