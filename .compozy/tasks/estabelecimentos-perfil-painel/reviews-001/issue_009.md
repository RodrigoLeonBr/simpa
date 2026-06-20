---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T19:30:18Z
status: resolved
file: simpa-frontend/src/hooks/useDashboard.ts
line: 62
severity: medium
author: claude-code
provider_ref:
---

# Issue 009: Fetch APS desnecessário bloqueia placeholder em perfis pending

## Review Comment

`loadDashboard()` (linhas 62–104) chama `fetchDashboard` para todos os perfis, inclusive MAC/Hospitalar/Misto com catálogo `pending` e sem consumo do payload. Enquanto o fetch corre, `loading === true` faz `Painel/index.tsx` renderizar “Carregando painel…” em vez do placeholder “Indicadores em definição”.

**Correção sugerida:** em `useDashboard`, pular `fetchDashboard` quando `!isPainelCatalogReady(painelPerfil, layout)` (ou para qualquer perfil non-APS no MVP); definir `loading=false` imediatamente nesses casos. Arquivo relacionado: `simpa-frontend/src/pages/Painel/index.tsx` linha 22.

## Triage

- Decision: `valid`
- Notes: `useDashboard` pula `fetchDashboard` quando `!isPainelCatalogReady(painelPerfil)`; `Painel/index.tsx` só mostra spinner de loading quando `catalogReady`. Testes useDashboard atualizados.
