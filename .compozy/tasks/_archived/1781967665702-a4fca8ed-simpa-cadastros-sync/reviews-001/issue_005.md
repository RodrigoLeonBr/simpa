---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T14:45:00Z
status: resolved
file: simpa-frontend/src/utils/enrichmentView.ts
line: 88
severity: high
author: claude-code
provider_ref:
---

# Issue 005: Catalog lists capped at 100 rows without pagination UI

## Review Comment

`buildEstabelecimentosQuery` and `buildProcedimentosQuery` hardcode `limit: '100'`. `EstabelecimentosPage` and `ProcedimentosPage` consume only `result.data` and display `rows.length` as the count badge — ignoring `pagination.total` and `pagination.pages` returned by the backend.

Municipal SIGTAP and prestador catalogs can exceed 100 entries. Users see a truncated subset with no indication that more records exist, violating the PRD expectation of a searchable full catalog mirror.

**Suggested fix:** Use `pagination.total` in the count badge ("mostrando X de Y"). Add page controls or infinite scroll; raise default limit to backend max (200) as interim. Also affects `EstabelecimentosPage.tsx:65` and `ProcedimentosPage.tsx`.

## Triage

- Decision: `valid`
- Notes: Limit raised to 200; `formatCatalogCount()` shows "X de Y"; pagination controls added to both catalog pages. Tests in `enrichmentView.test.ts` and `EstabelecimentosPage.test.tsx`.
