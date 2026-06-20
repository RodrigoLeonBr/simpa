---
status: completed
title: Auth frontend + login page
type: frontend
complexity: medium
dependencies:
  - task_04
  - task_09
---

# Task 10: Auth frontend + login page

## Overview

Implement JWT auth on the frontend: AuthContext, ProtectedRoute, api client with Bearer token, and the split login page matching SIMPA.dc.html. Per ADR-004, remove client-side perfil selection — perfil comes from server response only.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement AuthContext with localStorage persistence (simpa-auth)
- MUST implement ProtectedRoute redirecting to /login
- MUST port login layout from prototype (split panel, stats block)
- MUST intercept 401 in api client → logout + redirect
- MUST NOT send perfil in login POST body (ADR-004 correction vs prototype)
</requirements>

## Subtasks
- [x] 10.1 AuthContext + api/auth.ts
- [x] 10.2 ProtectedRoute wrapper
- [x] 10.3 Login page UI per design-system.md
- [x] 10.4 Wire routes: public /login, protected /*

## Implementation Details

See auth design spec Sections 4 and 12 (frontend artifacts).

### Relevant Files
- `simpa-frontend/src/contexts/AuthContext.tsx` — create
- `simpa-frontend/src/pages/Login/index.tsx` — create
- `SIMPA_ tela/SIMPA.dc.html` — login section lines 30–80

### Related ADRs
- [ADR-004: Basic JWT Auth](../adrs/adr-004.md)
- [ADR-005: React Port](../adrs/adr-005.md)

## Deliverables
- Working login against backend or mock
- Session persists across page reload
- Vitest tests for AuthContext

## Tests
- Unit tests:
  - [x] login() stores token and user in localStorage
  - [x] logout() clears storage
  - [x] ProtectedRoute redirects when token missing
- Integration tests:
  - [x] Login form submits and navigates to /
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Invalid credentials show inline "Credenciais inválidas"
