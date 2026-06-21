---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T22:05:00Z
status: resolved
file: simpa-backend/src/services/importMappingService.js
line: 400
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Preview marks auto-creatable teams as pending

## Review Comment

In `enrichPreviewItem`, `mapeamento_status` becomes `'pending'` when `hasTeamResolution` is false — i.e. when the team is not in `esus_import_mapeamentos` and is not `"Todas"`. Per PRD §Team auto-registration, specific teams missing from cadastro should be **auto-created on upload** via `ensureEquipe`, not treated as blocking unknowns.

Marking these rows `pending` triggers the wrong badge/picker UX (establishment suggestions reappear even when unit is already mapped) and conflicts with the preview gate semantics. Either status should be `'resolved'` once establishment linkage is known and the CSV carries a valid team code, or the UI must offer an explicit team confirmation step.

**Suggested fix:** After unit mapping is resolved, set `mapeamento_status: 'resolved'` when `esusEquipeCodigo` is present (team will be ensured on upload) or when `isTodasEquipe(...)`. Reserve `'pending'` for unknown **establishment** only.

## Triage

- Decision: `valid`
- Root cause: `hasTeamResolution` omitted non-empty `esusEquipeCodigo` as auto-create signal.
- Fix: Extended `hasTeamResolution` with `Boolean(String(esusEquipeCodigo || '').trim())`. `pending` reserved for unknown establishment; suggestions only when `mapeamentoStatus === 'pending'`.
- Verification: `importMapping.test.js` — “team will auto-create on upload” expects `resolved`; mock chain updated for equipe nome lookup + `detectTodasConflict`.
