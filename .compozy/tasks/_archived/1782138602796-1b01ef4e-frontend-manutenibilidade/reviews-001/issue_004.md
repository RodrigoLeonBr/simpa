---
provider: manual
pr:
round: 1
round_created_at: 2026-06-22T02:00:00Z
status: resolved
file: simpa-frontend/src/components/shared/ModuleLoadError.tsx
line: 52
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: ModuleLoadErrorBoundary catches all runtime errors

## Review Comment

`ModuleLoadErrorBoundary` (used by every `LazyModuleRoute`) sets `hasError: true` for **any** child render error — not only chunk-load failures. A bug in Cadastros/Admin runtime logic surfaces as “Não foi possível carregar esta página” with F5 reload, masking the real defect and preventing React error overlays in dev.

**Fix:** In `getDerivedStateFromError` / `componentDidCatch`, only handle chunk-load errors (`error.name === 'ChunkLoadError'`, `message.includes('Failed to fetch dynamically imported module')`). Re-throw or use a nested boundary for app logic errors. Keep full-page fallback for true lazy-load failures.

## Triage

- Decision: `VALID`
- Notes:
  - O boundary atualmente converte qualquer erro de runtime em erro de carregamento de módulo.
  - Isso mascara bugs de lógica em produção e dificulta diagnóstico.
  - Correção aplicada em `src/components/shared/ModuleLoadError.tsx` com detector `isChunkLoadError`.
  - Erros de chunk continuam exibindo fallback; erros de runtime são repropagados.
  - Testes atualizados em `src/components/shared/ModuleLoadError.test.tsx`.
