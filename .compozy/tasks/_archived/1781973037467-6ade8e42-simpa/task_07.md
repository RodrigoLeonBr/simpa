---
status: completed
title: SIA sync API
type: backend
complexity: medium
dependencies:
  - task_02
  - task_03
  - task_04
---

# Task 07: SIA sync API

## Overview

Expose REST endpoints to trigger SIA MySQL synchronization and query production data. The API spawns `sync_sia_mysql.py` and reflects connection status in dashboard MAC module.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement POST `/api/sia/sincronizar`, GET `/api/sia/sincronizacoes`, GET `/api/sia/producao`
- MUST connect to host XAMPP MySQL via env vars (ADR-003)
- MUST set dashboard `status_conexao` appropriately on sync success/failure
- MUST use read-only MySQL credentials only
</requirements>

## Subtasks
- [x] 7.1 SIA service spawning sync_sia_mysql.py
- [x] 7.2 Sync and history routes
- [x] 7.3 Producao query with competencia/unidade filters
- [x] 7.4 Health check optional MySQL probe

## Implementation Details

See Plano B sia routes and ADR-003.

### Relevant Files
- `simpa-backend/src/routes/sia.js` — create
- `simpa-backend/src/services/sia.js` — create

### Related ADRs
- [ADR-003: SIA MySQL via XAMPP Host](../adrs/adr-003.md)

## Deliverables
- SIA sync trigger endpoint
- Production listing for MAC sections in Painel
- Tests with mocked MySQL/subprocess

## Tests
- Unit tests:
  - [x] Sync service handles subprocess failure gracefully
- Integration tests:
  - [x] POST sincronizar records row in sia_sincronizacoes
  - [x] GET producao returns filtered rows from seed
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Dashboard ambulatorial_sia block shows CONNECTED after successful sync
