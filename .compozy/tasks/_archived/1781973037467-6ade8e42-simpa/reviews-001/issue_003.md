---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T15:42:00Z
status: resolved
file: simpa-backend/src/routes/admin.js
line: 185
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Admin podia inativar a própria conta sem proteção

## Review Comment

`DELETE /api/admin/usuarios/:id` não impedia auto-inativação nem remoção do último administrador ativo.

**Correção aplicada:** guards 403 para self-delete e último admin; frontend bloqueia inativar linha do usuário logado.

## Triage

- Decision: `valid`
- Notes: Resolvido — `admin.js`, `Usuarios.tsx`, testes Jest
