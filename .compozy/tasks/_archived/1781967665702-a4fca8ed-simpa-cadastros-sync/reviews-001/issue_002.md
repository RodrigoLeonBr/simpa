---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T14:45:00Z
status: resolved
file: simpa-backend/src/services/cadastrosSync.js
line: 72
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Subprocess sync errors surface as HTTP 502

## Review Comment

When `sync_cadastros_mysql.py` exits with code 1, it still prints a valid JSON body with `status: "erro"` and an `error` field (see `main()` lines 499–502). `cadastrosSync.js` rejects immediately on `code !== 0` without parsing stdout, mapping every failure to a generic 502.

This breaks the TechSpec `CadastroSyncResult` contract: the frontend `CadastroSyncBanner` expects structured `{ status: 'erro', error: '...' }` with HTTP 201, but production receives 502 and falls into the catch block. The existing route test mocks `sincronizar()` directly and does not cover the real subprocess path.

**Suggested fix:** On `close`, attempt `parseSyncOutput(stdout)` even when `code !== 0`. If JSON contains `status: 'erro'`, resolve (not reject) so the route can return 201 with the structured payload. Reserve 502 for truly unparseable output or spawn failures.

## Triage

- Decision: `valid`
- Notes: `cadastrosSync.js` now resolves structured JSON from stdout regardless of exit code. Test updated in `cadastrosSync.test.js`.
