---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T14:45:00Z
status: resolved
file: simpa-backend/src/services/estabelecimentosService.js
line: 198
severity: medium
author: claude-code
provider_ref:
---

# Issue 009: Enrichment merge prevents clearing saved fields

## Review Comment

`updateEnriquecimento` merges `{ ...current.enriquecimento, ...body }` (lines 198–202). The frontend `formValuesToEnrichment` omits empty arrays/objects, so clearing leitos or especialidades in the UI does not remove previously saved values.

Users cannot undo enrichment data once entered — a functional gap for hospital planning workflows.

**Suggested fix:** Support explicit null/empty sentinels to delete keys, or replace (not merge) when the client sends a full enrichment object. Align `enrichmentView.ts` form serialization with the chosen contract.

## Triage

- Decision: `valid`
- Notes: `mergeEnrichment()` deletes keys when empty arrays/objects/strings are sent. Form always submits full snapshot. Tests in `estabelecimentos.test.js`, `enrichmentView.test.ts`, and component tests updated.
