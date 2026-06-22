---
provider: manual
pr:
round: 1
round_created_at: 2026-06-22T02:00:00Z
status: resolved
file: simpa-frontend/src/pages/Cadastros/EstabelecimentosPage.tsx
line: 41
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: EstabelecimentosPage duplicates usePaginatedCatalog logic

## Review Comment

PRD goal F1 requires a unified read-only catalog pattern. Formas/CBOs/Procedimentos use `usePaginatedCatalog` + `ReadOnlyCatalogPage`, but `EstabelecimentosPage` reimplements the same state machine (search, page, loading, error, `carregar`) inline (~30 lines). The only extra behavior is perfil chips — that filter could be an `extra` param in `buildPaginatedCatalogQuery` / hook options.

**Fix:** Extend `usePaginatedCatalog` with optional `extraFilters` or a thin `useEstabelecimentosCatalog` wrapper that delegates to the shared hook. Reuse `ReadOnlyCatalogPage` pagination/error UI where possible.

## Triage

- Decision: `INVALID`
- Notes:
  - A duplicação é intencional neste ponto: `EstabelecimentosPage` combina catálogo read-only com filtros por perfil, seleção de linha e drawer de edição/enriquecimento.
  - A página não é um catálogo estritamente read-only como Formas/CBOs/Procedimentos e, portanto, não encaixa totalmente no `ReadOnlyCatalogPage`.
  - Não há bug funcional ou regressão clara; manter estrutura atual reduz risco nesta etapa.
