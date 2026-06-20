---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T15:42:00Z
status: resolved
file: simpa-frontend/src/hooks/useFilters.tsx
line: 27
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Competência padrão salva não era aplicada ao painel

## Review Comment

`Configuracoes.tsx` persistia `competencia_ativa_padrao`, mas `FiltersProvider` inicializava com `DEFAULT_COMPETENCIAS[0]` hardcoded — configuração write-only.

**Correção aplicada:** rota pública `GET /api/config/competencia-padrao` + `fetchCompetenciaPadrao()` no bootstrap do `FiltersProvider`.

## Triage

- Decision: `valid`
- Notes: Resolvido — `config.js`, `api/config.ts`, `useFilters.tsx`
