---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T15:42:00Z
status: resolved
file: simpa-backend/src/routes/admin.js
line: 88
severity: medium
author: claude-code
provider_ref:
---

# Issue 006: Sem validação de força mínima de senha no admin

## Review Comment

POST/PUT de usuários aceitavam senhas curtas na API — fronteira de segurança fraca para gestão de contas.

**Correção aplicada:** `validateSenha()` exige mínimo 8 caracteres em create e update com senha.

## Triage

- Decision: `valid`
- Notes: Resolvido — `admin.js`, teste `rejects short password on create`
