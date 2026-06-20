---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T19:30:18Z
status: resolved
file: simpa-frontend/src/pages/Cadastros/EstabelecimentoDetailDrawer.tsx
line: 63
severity: medium
author: claude-code
provider_ref:
---

# Issue 008: Leitura de enriquecimento bloqueada para usuários somente-leitura

## Review Comment

`showEnrichment = canEditEnrichment(estabelecimento.perfil, canEdit)` (linha 63) exige `canEdit === true`. Usuários como Visualizador veem perfil readonly mas recebem apenas a mensagem genérica “Enriquecimento não disponível…”. Leitura e escrita estão acopladas na mesma função `canEditEnrichment`.

**Correção sugerida:** separar `canViewEnrichment(perfil)` de `canEditEnrichment(perfil, roleAllowed)`; renderizar dados em modo readonly (`readOnly={true}` no form ou seção de resumo) para perfis suportados sem permissão de edição.

## Triage

- Decision: `valid`
- Notes: `canViewEnrichment` separado de `canEditEnrichment`; drawer exibe seção readonly; forms renderizam resumo via `ReadonlyFieldList`. Testes drawer e enrichmentView atualizados.
