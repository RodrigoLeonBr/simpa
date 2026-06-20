---
status: completed
title: Cadastros & Admin API
type: backend
complexity: high
dependencies:
  - task_03
  - task_04
superseded_partially_by: simpa-cadastros-sync
---

> **Cadastro API atualizada** (2026-06-20) pelo workflow arquivado [`simpa-cadastros-sync`](../_archived/1781967665702-a4fca8ed-simpa-cadastros-sync/_prd.md).
> Endpoints legados (`/unidades`, `/prestadores-mac`, `/hospitais`) removidos. Nova superfície: sync, estabelecimentos read-only + enrichment, procedimentos read-only.
> **Admin routes desta task permanecem válidas** para task_17.

# Task 08: Cadastros & Admin API

## Overview

Implement CRUD REST APIs for all cadastro entities (Unidades, Equipes, Procedimentos, Prestadores MAC, Hospitais, Emendas) plus Admin endpoints for users, audit log, and system configuration.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement CRUD for all 6 cadastro resources per TechSpec
- MUST prefer soft inactivate over hard delete when historical FKs exist
- MUST implement admin usuarios CRUD with bcrypt on create/reset password
- MUST implement read-only paginated audit_log GET
- MUST restrict admin routes to Administrador perfil where applicable
</requirements>

## Subtasks
- [x] 8.1 Cadastros router with shared CRUD patterns
- [x] 8.2 Unidades and Equipes endpoints (existing schema)
- [x] 8.3 Phase 2 entity endpoints (procedimentos, prestadores, hospitais, emendas)
- [x] 8.4 Admin usuarios + audit + configuracoes routes

## Implementation Details

See `estrutura_simpa.md` Section 3.2 and auth design spec Sections 10–11.

### Relevant Files
- `simpa-backend/src/routes/cadastros.js` — create
- `simpa-backend/src/routes/admin.js` — create

### Related ADRs
- [ADR-004: Basic JWT Auth](../adrs/adr-004.md)

## Deliverables
- Full cadastro API surface for frontend CRUD pages
- Admin user management API
- Integration tests per resource

## Tests
- Unit tests:
  - [x] Validation rejects missing required CNES/SIGTAP fields
- Integration tests:
  - [x] CRUD round-trip for unidades_saude
  - [x] Inactivate preserves row with status flag
  - [x] Non-admin cannot DELETE usuarios
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- ~~All 6 cadastro cards in UI can load and mutate data~~ → Cadastros UI entregue via `simpa-cadastros-sync` (estabelecimentos/procedimentos sync + equipes/emendas CRUD)
