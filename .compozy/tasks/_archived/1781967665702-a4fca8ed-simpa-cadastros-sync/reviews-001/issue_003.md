---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T14:45:00Z
status: resolved
file: sync_cadastros_mysql.py
line: 418
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Failed sync runs not persisted to audit table

## Review Comment

`insert_sync_audit()` is only called on successful sync with `--pg-write` (line 460–461). Early returns via `_error_result()` for MySQL unavailability (line 419) or extraction failures (line 430) never open a PG connection or write an audit row.

The PRD (F3) requires showing sync errors and timestamps; the TechSpec defines `cadastros_sincronizacoes.status=erro` for monitoring. Operators cannot query failure history when MySQL is down because no row is inserted.

**Suggested fix:** When `--pg-write` is active, connect to PG even on error paths and call `insert_sync_audit(conn_pg, _error_result(...))` before returning. Ensure `getLatestSync` or a new endpoint can surface the most recent attempt regardless of status.

## Triage

- Decision: `valid`
- Notes: Added `_persist_audit_if_writing()` called on MySQL-unavailable and extraction error paths. Integration pytest `test_mysql_unavailable_persists_audit_on_pg_write` added.
