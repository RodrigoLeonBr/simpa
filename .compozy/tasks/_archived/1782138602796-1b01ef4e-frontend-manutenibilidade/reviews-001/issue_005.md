---
provider: manual
pr:
round: 1
round_created_at: 2026-06-22T02:00:00Z
status: resolved
file: simpa-frontend/src/components/cadastros/ReadOnlyCatalogPage.tsx
line: 84
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: Read-only catalog error state has no retry action

## Review Comment

On fetch failure, the page renders `{error}` in a static `analytics-state-error` div. `UsePaginatedCatalogReturn` exposes `carregar()` but `ReadOnlyCatalogPage` does not destructure or wire it. Users must change search/page to retrigger fetch — poor UX for transient network errors.

**Fix:** Destructure `carregar` from `catalog` and add a “Tentar novamente” button in the error branch (same pattern as `ModuleLoadError`). Mirror in `EstabelecimentosPage` error branch for consistency.

## Triage

- Decision: `VALID`
- Notes:
  - O hook já expõe `carregar`, mas a UI de erro não oferece retry explícito.
  - Isso degrada UX em falhas transitórias e é simples de corrigir sem impacto de contrato.
  - Correção aplicada em `src/components/cadastros/ReadOnlyCatalogPage.tsx` com botão "Tentar novamente" no estado de erro.
