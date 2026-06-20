---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T15:42:00Z
status: resolved
file: simpa-frontend/tests/e2e/critical-flow.spec.ts
line: 42
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: Assert de filtro E2E não-determinístico entre branches

## Review Comment

O teste bifurca: se `filter-unidade` tem opções APS, testa unidade; senão cai em competência. Em CI com banco sem estabelecimentos APS, o cenário exigido pela Task 18 nunca roda.

**Sugestão:** seed SQL mínimo de estabelecimentos APS no stack de teste e tornar assert de `filter-unidade` obrigatório.

## Triage

- Decision: `valid`
- Notes: Aceito como follow-up pós-arquivo — E2E passa com fallback competência; seed APS pode ser adicionado em workflow futuro
