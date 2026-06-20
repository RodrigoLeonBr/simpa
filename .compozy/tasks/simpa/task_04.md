---
status: pending
title: Auth JWT backend
type: backend
complexity: medium
dependencies:
  - task_03
---

# Task 04: Auth JWT backend

## Overview

Implement JWT authentication: `usuarios` table, bcrypt password hashing, login/logout/me routes, and `verifyJWT` middleware protecting all `/api/*` routes. Per ADR-004, perfil comes from DB record only (not client select).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement POST `/auth/login`, POST `/auth/logout`, GET `/auth/me`
- MUST apply `verifyJWT` to all `/api/*` routes
- MUST seed admin user (change password documented for production)
- MUST log login success/failure to `audit_log`
- MUST NOT implement API-level unit scoping in MVP (ADR-004)
</requirements>

## Subtasks
- [ ] 4.1 Create auth routes and bcrypt password verification
- [ ] 4.2 Implement verifyJWT middleware injecting req.user
- [ ] 4.3 Apply middleware to existing route registration pattern
- [ ] 4.4 Seed script for default admin user

## Implementation Details

See auth design spec Section 12 and TechSpec **API Endpoints — Auth**.

### Relevant Files
- `simpa-backend/src/routes/auth.js` — create
- `simpa-backend/src/middleware/verifyJWT.js` — create
- `migration_002_auth.sql` — from Task 01

### Dependent Files
- All `/api/*` route modules — require middleware

### Related ADRs
- [ADR-004: Basic JWT Auth](../adrs/adr-004.md)

## Deliverables
- Working login flow returning JWT + user object
- 401 on protected routes without token
- Integration tests for auth happy/error paths

## Tests
- Unit tests:
  - [ ] verifyJWT rejects expired/malformed tokens
  - [ ] bcrypt verifies correct password
  - [ ] login returns generic error for bad credentials (no user enumeration)
- Integration tests:
  - [ ] POST /auth/login → GET /auth/me with Bearer token
  - [ ] GET /api/v1/dashboard/planejamento without token → 401
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- JWT expires per JWT_EXPIRES_IN env (8h default)
