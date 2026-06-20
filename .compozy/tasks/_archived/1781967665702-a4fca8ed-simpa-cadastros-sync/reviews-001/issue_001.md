---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T14:45:00Z
status: resolved
file: simpa-backend/src/services/estabelecimentosService.js
line: 190
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Enrichment allowed for non-hospital profiles

## Review Comment

`updateEnriquecimento` accepts PUT requests for any establishment profile. The PRD (F1) and workflow memory restrict enrichment to **Hospitalar** and **Misto** profiles only — APS/MAC establishments should not receive planning extensions via this endpoint.

Currently there is no profile check between validation and merge at lines 190–214. Integration tests even assert successful enrichment on an APS fixture (`INT-EST-05`), reinforcing the gap.

**Suggested fix:** After `getEstabelecimentoById`, reject with HTTP 403 when `current.perfil` is not in `['Hospitalar', 'Misto']`. Add route and unit tests for APS/MAC → 403 and Hospitalar/Misto → 200.

## Triage

- Decision: `valid`
- Notes: Added `ENRICHMENT_PERFIS` gate returning 403 for APS/MAC. Unit test in `estabelecimentos.test.js` and integration test for APS rejection added; enrichment round-trip now uses Hospitalar fixture.
