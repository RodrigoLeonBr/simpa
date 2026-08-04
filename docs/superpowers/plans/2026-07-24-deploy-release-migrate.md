# Deploy release `--migrate` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tracking table + apply/baseline scripts + deploy `--migrate` + project name `simpa` + docs/tests.

**Architecture:** Pure shell/PowerShell against `docker compose -p` and `psql` in postgres container; shared logic tested via a small Python helper used by pytest (and optionally called from docs). Keep deploy scripts thin.

**Tech Stack:** bash, PowerShell, PostgreSQL, Docker Compose v2, pytest.

## Global Constraints

- No build on destination (`--no-build`).
- Default project name `simpa`.
- Baseline default documented as `012` (configurable).
- Do not commit unless user asks.

## File map

| File | Responsibility |
|------|----------------|
| `scripts/lib/migrations_lib.py` | Parse names, pending list, baseline list (pure) |
| `scripts/apply-migrations.sh` | Apply / baseline on Linux |
| `scripts/apply-migrations.ps1` | Apply / baseline on Windows |
| `scripts/deploy-release.sh` / `.ps1` | load + up + optional migrate |
| `scripts/docker-release-export.ps1` | Bundle apply scripts; stamp SIMPA_VERSION in example env |
| `.env.docker.example` | `COMPOSE_PROJECT_NAME=simpa` |
| `tests/test_migrations_lib.py` | Unit tests |
| `tests/test_docker_etl_scripts.py` | Assert apply scripts in export |
| `docs/agent/docker-env.md`, `restore-backup-e-release-docker.md` | Operator docs |

## Tasks

### Task 1: Library + unit tests (TDD)

- [ ] Write failing tests for parse / pending / baseline
- [ ] Implement `scripts/lib/migrations_lib.py`
- [ ] Green pytest

### Task 2: apply-migrations.sh / .ps1

- [ ] Implement both; use docker compose -p; create table; apply; baseline
- [ ] Smoke: dry logic already covered by unit tests

### Task 3: deploy-release flags + COMPOSE_PROJECT_NAME

- [ ] Parse `--migrate` / `-Migrate`; call apply; restart api
- [ ] Always pass `-p` from env file

### Task 4: Export + env example + docs + regression test

- [ ] Bundle apply scripts; stamp version in packaged `.env.docker.example`
- [ ] Update agent docs
- [ ] Extend package regression tests
- [ ] Run pytest for new/updated tests
