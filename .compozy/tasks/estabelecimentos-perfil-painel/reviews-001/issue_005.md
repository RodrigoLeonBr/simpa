---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T19:30:18Z
status: resolved
file: simpa-backend/src/services/estabelecimentosService.js
line: 90
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: validateLeitos aceita floats e Infinity

## Review Comment

`validateLeitos` (linhas 90–94) exige apenas `typeof value === 'number' && value >= 0`. Valores como `10.5` e `Infinity` passam na validação e são persistidos em JSONB. O TechSpec e o formulário frontend exigem **inteiros** ≥ 0 para leitos hospitalar/misto.

**Correção sugerida:** adicionar `Number.isInteger(value) && Number.isFinite(value)` na validação, alinhado a `validateEnrichmentForm` no frontend.

## Triage

- Decision: `valid`
- Notes: `validateLeitos` agora exige inteiros finitos ≥ 0. Teste `rejects non-integer leitos values` adicionado.
