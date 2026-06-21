---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T22:05:00Z
status: resolved
file: simpa-backend/src/services/importMappingService.js
line: 535
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: ensureEquipeWithClient skips empty codigo validation

## Review Comment

`ensureEquipe()` throws HTTP 400 when a specific team lacks `esusEquipeCodigo` (lines 198–203). The transactional twin `ensureEquipeWithClient()` omits the same guard and may `INSERT INTO equipes` with an empty `codigo` string, creating duplicate or invalid rows and violating the team auto-registration contract.

Upload paths use `ensureEquipeWithClient` inside `resolveForUpload`, so this is the production code path.

**Suggested fix:** Share validation — reject empty/non-specific team codes before insert, matching `ensureEquipe()` behavior.

## Triage

- Decision: `valid`
- Root cause: `ensureEquipeWithClient` lacked the empty-codigo guard present in `ensureEquipe`.
- Fix: Added same validation — throws 400 when specific team (non-Todas) has empty/whitespace `esusEquipeCodigo` before INSERT.
- Verification: Covered by existing `ensureEquipe` tests pattern; upload path uses guarded function.
