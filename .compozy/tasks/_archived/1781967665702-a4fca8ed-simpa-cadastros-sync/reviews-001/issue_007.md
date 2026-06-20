---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T14:45:00Z
status: resolved
file: simpa-backend/src/services/cadastrosSync.js
line: 52
severity: medium
author: claude-code
provider_ref:
---

# Issue 007: No guard against concurrent manual sync

## Review Comment

`POST /api/cadastros/sincronizar` spawns a new Python subprocess on every request with no mutex, advisory lock, or in-flight flag. Two concurrent sync clicks (or parallel API calls) can run overlapping upserts and inactivations against `estabelecimentos` and `procedimentos`.

**Suggested fix:** Use a PG advisory lock (`pg_try_advisory_lock`) or in-memory mutex with timeout. Return HTTP 409 when a sync is already running. Add spawn timeout to prevent hung processes.

## Triage

- Decision: `valid`
- Notes: Added in-memory `syncInFlight` mutex with HTTP 409 on concurrent calls. Subprocess timeout via `CADASTRO_SYNC_TIMEOUT_MS` (default 5 min) kills hung processes with 504. Test in `cadastrosSync.test.js`.
