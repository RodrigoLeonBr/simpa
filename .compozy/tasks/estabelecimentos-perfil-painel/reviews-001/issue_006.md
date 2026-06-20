---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T19:30:18Z
status: resolved
file: simpa-backend/src/services/estabelecimentosService.js
line: 221
severity: medium
author: claude-code
provider_ref:
---

# Issue 006: mergeLeitosField substitui objeto inteiro em update parcial

## Review Comment

`mergeLeitosField` (linhas 221–228) retorna `body.leitos` integralmente quando a chave está presente, sem deep-merge com `current.leitos`. Um PATCH enviando `{ leitos: { clinico: 20 } }` apaga outros tipos de leito existentes. Isso é inconsistente com `mergeScalarField`/`mergeArrayField`, que preservam campos não enviados.

**Correção sugerida:** fazer deep-merge `{ ...current.leitos, ...body.leitos }` filtrando chaves vazias, ou documentar e exigir payload completo na API.

## Triage

- Decision: `valid`
- Notes: `mergeLeitosField` faz spread de `current.leitos` com `body.leitos`. Teste `deep-merges partial leitos updates` adicionado.
