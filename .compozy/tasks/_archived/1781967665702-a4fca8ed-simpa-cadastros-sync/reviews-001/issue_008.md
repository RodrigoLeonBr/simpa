---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T14:45:00Z
status: resolved
file: simpa-backend/src/routes/cadastros.js
line: 27
severity: medium
author: claude-code
provider_ref:
---

# Issue 008: Sync endpoint lacks role-based authorization

## Review Comment

`POST /sincronizar` requires only a valid JWT (`verifyJWT` on `/api` in `app.js`). Any authenticated user can trigger a full MySQL→PostgreSQL catalog refresh. The PRD targets Planning Unit staff (Gestor Secretaria, Planejamento profile) as primary users of manual sync.

**Suggested fix:** Apply a profile/role middleware (similar to admin routes) restricting sync to planning roles. Return 403 for unauthorized profiles. Document allowed roles in API readme.

## Triage

- Decision: `valid`
- Notes: Added `requirePlanningStaff` middleware allowing Administrador, Gestor Secretaria, Planejamento. Route test for 403 with Gestor de Unidade. Documented in readme.md.
