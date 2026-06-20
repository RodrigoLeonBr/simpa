---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T14:45:00Z
status: resolved
file: sync_cadastros_mysql.py
line: 435
severity: high
author: claude-code
provider_ref:
---

# Issue 004: Invalid MySQL rows silently discarded during sync

## Review Comment

In `sincronizar()`, `ValueError` from `normalize_prestador_row` and `normalize_procedimento_row` is caught and ignored with `continue` (lines 435–446). No skip counter, log, or `status: "parcial"` is emitted. The function always returns `status: "ok"` even when rows were dropped.

For a municipal catalog with malformed legacy rows, users see a successful sync with incomplete data and no visibility into what was skipped.

**Suggested fix:** Track `skipped_estabelecimentos` and `skipped_procedimentos` counts (and optionally sample codes). Return `status: "parcial"` when any skips occur; include counts in audit and stdout JSON. Add pytest coverage for rows that fail normalization.

## Triage

- Decision: `valid`
- Notes: Skip counters added; `status: "parcial"` with `skipped` and `error` fields. Pytest `test_invalid_mysql_rows_emit_parcial_status` added. Frontend `CadastroSyncBanner` handles `parcial` with warning state.
