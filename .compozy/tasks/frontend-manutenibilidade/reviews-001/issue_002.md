---
provider: manual
pr:
round: 1
round_created_at: 2026-06-22T02:00:00Z
status: resolved
file: simpa-frontend/src/hooks/usePaginatedCatalog.ts
line: 48
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: Paginated catalog has no stale-response guard

## Review Comment

`carregar()` has no request sequencing or `AbortController`. If the user changes page/search quickly, a slow response for page 1 can arrive after page 2 and overwrite `rows`/`total` with stale data. Same pattern exists in `EstabelecimentosPage.tsx` (lines 41–64).

**Fix:** Increment a `requestId` ref before fetch and ignore results when `requestId !== latest`. Or abort the previous fetch via `AbortController` passed to `apiFetch`. Add a Vitest case simulating out-of-order responses.

## Triage

- Decision: `VALID`
- Notes:
  - `usePaginatedCatalog` não protege contra resposta fora de ordem e pode sobrescrever estado com payload stale.
  - Correção aplicada em `src/hooks/usePaginatedCatalog.ts`: `requestIdRef` para ignorar respostas stale em sucesso/erro/finalização.
  - Cobertura adicionada em `src/hooks/usePaginatedCatalog.test.ts` com cenário de respostas fora de ordem.
