---
status: completed
title: Docker Compose + PostgreSQL init
type: infra
complexity: high
dependencies: []
---

# Task 01: Docker Compose + PostgreSQL init

## Overview

Establish the single-server deployment foundation: Docker Compose services (postgres, api, web), PostgreSQL initialization from `schema_full.sql`, and migrations for auth and Phase 2 cadastros tables. This unblocks all backend and ETL work.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST provide `docker-compose.yml` with services postgres, api, web (nginx)
- MUST init database from `schema_full.sql` plus `migration_002_auth.sql` and `migration_003_cadastros_fase2.sql`
- MUST include `.env.example` with PG, JWT, MySQL (XAMPP), and upload path variables
- MUST configure `host.docker.internal` for api → XAMPP MySQL (ADR-001, ADR-003)
- SHOULD include `docker-compose.dev.yml` override for local Vite HMR
</requirements>

## Subtasks
- [x] 1.1 Create Dockerfiles for api (Node+Python) and web (nginx multi-stage frontend build)
- [x] 1.2 Write compose file with persistent postgres volume and network aliases
- [x] 1.3 Author SQL migrations for usuarios, audit_log, and cadastro Phase 2 tables
- [x] 1.4 Document `docker compose up` workflow in readme

## Implementation Details

See TechSpec **Build Order step 1** and **System Architecture**.

### Relevant Files
- `schema_full.sql` — base schema v3.1.0
- `docker-compose.yml` — create
- `migration_002_auth.sql` — create
- `migration_003_cadastros_fase2.sql` — create

### Dependent Files
- All backend and ETL tasks depend on postgres availability

### Related ADRs
- [ADR-001: Docker Compose Single-Server Deployment](../adrs/adr-001.md)

## Deliverables
- Working `docker compose up` with healthy postgres
- Migrations applied automatically on first boot
- `.env.example` committed (no secrets)
- Smoke script verifying PG connection from api container

## Tests
- Unit tests:
  - [x] N/A for infra — validation via compose healthchecks
- Integration tests:
  - [x] `docker compose up` → postgres accepts connections
  - [x] Schema tables exist (`esus_cargas`, `usuarios`, `estabelecimentos`)
- Test coverage target: healthcheck scripts pass
- All tests must pass

## Success Criteria
- All tests passing
- `docker compose ps` shows all services healthy
- Fresh clone + `.env` + compose up yields empty but valid database
