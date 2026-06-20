---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T19:30:18Z
status: resolved
file: simpa-frontend/src/components/cadastros/EnrichmentFormByPerfil.tsx
line: 227
severity: medium
author: claude-code
provider_ref:
---

# Issue 010: useEffect com toValues instável reseta formulário

## Review Comment

`TextEnrichmentForm` depende de `[enrichment, toValues]` (linhas 227–230), mas `toValues` é passado como arrow inline pelo pai (`ApsEnrichmentForm`, `MacEnrichmentForm`, etc.), recriada a cada render. Re-renders do drawer (`perfilDraft`, toast, `savingPerfil`) disparam o effect e resetam valores digitados sem mudança real de `enrichment`.

**Correção sugerida:** estabilizar `toValues` com `useCallback` no pai ou remover `toValues` das deps e sincronizar apenas quando `enrichment` ou `perfil` mudarem.

## Triage

- Decision: `valid`
- Notes: `useEffect` em `TextEnrichmentForm` depende apenas de `[enrichment]`, evitando reset por re-render do pai.
