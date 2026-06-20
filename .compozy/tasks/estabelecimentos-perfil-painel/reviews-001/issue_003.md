---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T19:30:18Z
status: resolved
file: simpa-frontend/src/pages/Cadastros/EstabelecimentoDetailDrawer.tsx
line: 63
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Enriquecimento usa perfil persistido, não perfilDraft

## Review Comment

O `<select>` edita `perfilDraft` (linhas 147–151), mas `showEnrichment`, `enrichmentSectionTitle`, `EnrichmentFormByPerfil` e o `onSubmit` (linhas 63, 188–204) usam `estabelecimento.perfil`. Ao mudar o perfil no dropdown sem salvar, o usuário continua vendo o formulário do perfil antigo. Se salvar enriquecimento antes de salvar o perfil, a API recebe o slug do perfil persistido — payload potencialmente incorreto para a intenção do usuário.

**Correção sugerida:** derivar slug e formulário de `perfilDraft` (com hint “salve o perfil para persistir”); desabilitar submit de enriquecimento enquanto `perfilDraft !== estabelecimento.perfil`, ou salvar perfil automaticamente antes do enriquecimento.

## Triage

- Decision: `valid`
- Notes: Drawer usa `enrichmentPerfil = perfilDraft` para título/form; enriquecimento carregado só quando perfil salvo; submit bloqueado via `readOnly` enquanto `perfilUnsaved`; hint exibido ao usuário.
