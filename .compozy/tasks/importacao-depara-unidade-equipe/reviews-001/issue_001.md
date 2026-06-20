---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T22:05:00Z
status: resolved
file: simpa-frontend/src/utils/importacaoView.ts
line: 115
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Process gate ignores mapeamento_status pending

## Review Comment

Task 08 and the PRD preview gate require disabling **Processar** while any preview row has `mapeamento_status === 'pending'`. `hasPendingMapping()` exists but `canEnableProcess()` / `isRowReadyForProcess()` only check that `estabelecimento_id` is set, ignoring `mapeamento_status`.

When the backend marks a row `pending` because the team is not yet in the registry (but the establishment is resolved), the UI still enables Process — contradicting the spec and the Vitest case for establishment-pending only covers missing picker selection, not team-pending rows.

**Suggested fix:** In `isRowReadyForProcess`, return `false` when `item.mapeamento_status === 'pending'` unless you intentionally treat auto-create teams as resolved (then fix the backend status first — see issue 003). Wire `canEnableProcess` through that check so the gate matches PRD/task_08.

## Triage

- Decision: `valid`
- Root cause: `isRowReadyForProcess` treated any row with `estabelecimento_id > 0` as ready, ignoring `mapeamento_status === 'pending'` for team-unresolved rows.
- Fix: Added explicit `pending` branch requiring establishment selection via draft/preview; `blocked` branch unchanged (Todas confirm flow). Backend issue 003 aligns team auto-create rows to `resolved`.
- Verification: `UploadZone.test.tsx` — Process disabled for pending row; enabled only after picker selection.
