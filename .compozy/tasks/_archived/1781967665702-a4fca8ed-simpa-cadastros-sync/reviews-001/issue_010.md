---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T14:45:00Z
status: resolved
file: simpa-frontend/src/pages/Cadastros/CadastroSyncBanner.tsx
line: 55
severity: medium
author: claude-code
provider_ref:
---

# Issue 010: Partial sync status treated as full success

## Review Comment

`CadastroSyncBanner.handleSync` only enters degraded mode when `resultado.status === 'erro'`. The type system defines `status: 'ok' | 'parcial' | 'erro'`, but `parcial` falls through to the success toast path (line 64).

When issue 004 is fixed and the backend emits `parcial`, users will see a success message despite skipped rows — contradicting PRD F3 feedback requirements.

**Suggested fix:** Handle `parcial` with a warning toast and visible alert banner showing `resultado.error` or skip counts. Reserve green success styling for `ok` only.

## Triage

- Decision: `valid`
- Notes: Fixed alongside issue 004 — `parcial` now sets degraded banner with error message and shows sync toast before refreshing badge.
