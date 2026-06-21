---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T22:05:00Z
status: resolved
file: simpa-backend/src/services/importMappingService.js
line: 478
severity: low
author: claude-code
provider_ref:
---

# Issue 008: Mapping ultimo_uso_em never updated on reuse

## Review Comment

`esus_import_mapeamentos.ultimo_uso_em` is selected in `listMapeamentos` but never written when a saved mapping is applied during `resolveForUpload` / registry lookup on preview. The Mapeamentos panel always shows “—” for last use, reducing operational visibility into stale vs active de-paras.

**Suggested fix:** After successful lookup or upsert in the upload transaction, `UPDATE esus_import_mapeamentos SET ultimo_uso_em = now()` for matched registry rows.

## Triage

- Decision: `valid`
- Root cause: No write path for `ultimo_uso_em` on mapping reuse during upload.
- Fix: Added `touchMapeamentosForMeta()` — UPDATE on unit/equipe registry rows matching meta; invoked at end of `resolveForUpload` (inside transaction when client provided).
- Verification: Logic covered by service unit tests; panel will show timestamps after next upload with saved mapping.
