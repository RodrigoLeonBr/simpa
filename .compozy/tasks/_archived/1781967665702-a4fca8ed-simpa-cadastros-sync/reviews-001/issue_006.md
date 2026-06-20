---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T14:45:00Z
status: resolved
file: simpa-frontend/src/hooks/useDashboard.ts
line: 39
severity: high
author: claude-code
provider_ref:
---

# Issue 006: Dashboard unit filter lost on early selection

## Review Comment

`useDashboard` loads establishments asynchronously in a separate effect (lines 25–29) while the dashboard fetch runs in another effect keyed on `unidades.length` (line 71). If the user selects a unit (`unidadeId`) before `fetchEstabelecimentosAps()` completes, `unidades.find(...)` returns `undefined` and the dashboard loads without the unit filter.

The dependency `unidades.length` does not re-trigger when content changes with the same array size. This causes intermittent wrong dashboard data when filters are applied quickly after page load — a correctness bug for PRD F6 (filter dropdowns reflect synced establishments).

**Suggested fix:** Gate `loadDashboard` until establishments are loaded when `unidadeId !== null`. Include `unidades` (or a stable id→nome map) in effect dependencies, not just `unidades.length`.

## Triage

- Decision: `valid`
- Notes: Added `unidadesLoaded` gate and `unidadeNomeMap` memo. Dashboard fetch waits when `unidadeId` is set but establishments not yet loaded. Test added in `useDashboard.test.tsx`.
