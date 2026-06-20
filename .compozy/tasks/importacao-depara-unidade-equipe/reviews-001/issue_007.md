---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T22:05:00Z
status: resolved
file: simpa-frontend/src/pages/Cadastros/EstabelecimentoDetailDrawer.tsx
line: 0
severity: medium
author: claude-code
provider_ref:
---

# Issue 007: PRD link from Cadastros detail to de-para missing

## Review Comment

PRD §Persistent mapping registry specifies default UI in Importação **with link from Cadastros establishment detail**. Implementation delivers `MapeamentosPanel` under Importação tabs but `EstabelecimentoDetailDrawer` has no navigation/deeplink to view or edit mappings for the open establishment (`/importacao` → Mapeamentos tab filtered by unit, or inline list).

Operators fixing a wrong mapping must discover Importação separately, increasing support friction.

**Suggested fix:** Add a planning-staff-only link/button in the establishment drawer (e.g. “Mapeamentos e-SUS”) that routes to Importação mapeamentos with query/filter prefilled for `estabelecimento_id`.

## Triage

- Decision: `valid`
- Root cause: No cross-module navigation from establishment detail to de-para UI.
- Fix: Planning-staff link “Ver mapeamentos e-SUS →” in `EstabelecimentoDetailDrawer` → `/importacao?tab=mapeamentos&q={codigo_externo}`. `Importacao/index.tsx` reads `tab`/`q` search params; `MapeamentosPanel` accepts `initialQuery`.
- Verification: `EstabelecimentoDetailDrawer.test.tsx` wrapped with `MemoryRouter`; existing drawer tests pass.
