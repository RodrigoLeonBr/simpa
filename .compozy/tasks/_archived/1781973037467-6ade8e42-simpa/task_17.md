---
status: completed
title: Administração UI
type: frontend
complexity: medium
dependencies:
  - task_08
  - task_11
---

# Task 17: Administração UI

## Overview

Implement Administração module with sub-pages for Usuários e Perfis (CRUD), Auditoria/Logs (read-only table), and Configurações Gerais (competencia padrão and system params).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement Usuarios CRUD with perfil select and password reset
- MUST implement AuditLog read-only paginated table
- MUST implement Configuracoes form for default competencia
- MUST restrict module visibility to Administrador (and optionally Planejamento for audit read)
- MUST match prototype admin generic screen structure
</requirements>

## Subtasks
- [x] 17.1 Administracao index with sub-nav
- [x] 17.2 Usuarios page
- [x] 17.3 AuditLog page
- [x] 17.4 Configuracoes page

## Implementation Details

See auth design spec Section 11 and estrutura_simpa.md Section 3.7.

### Relevant Files
- `simpa-frontend/src/pages/Administracao/Usuarios.tsx` — create
- `simpa-frontend/src/pages/Administracao/AuditLog.tsx` — create
- `simpa-frontend/src/pages/Administracao/Configuracoes.tsx` — create
- `simpa-frontend/src/pages/Administracao/index.tsx` — sub-nav + rotas
- `simpa-frontend/src/api/admin.ts` — client API admin
- `simpa-frontend/src/utils/adminView.ts` — gating por perfil
- `simpa-backend/src/middleware/requireAdminOrPlanning.js` — GET audit-log para Planejamento

### Related ADRs
- [ADR-004: Basic JWT Auth](../adrs/adr-004.md)

## Deliverables
- Admin module accessible from sidebar
- User management wired to admin API
- Tests for perfil-gated route visibility

## Tests
- Unit tests:
  - [x] Non-admin user redirected from /admin/usuarios
  - [x] Audit log renders empty state
- Integration tests:
  - [x] Create user form submits to API mock
- Test coverage target: >=80%
- All tests must pass (160 Vitest frontend, admin Jest backend)

## Success Criteria
- All tests passing
- Admin can create user and see login audit entry
