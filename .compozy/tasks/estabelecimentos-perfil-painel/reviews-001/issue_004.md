---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T19:30:18Z
status: resolved
file: simpa-frontend/tests/e2e/perfil-painel.spec.ts
line: 48
severity: high
author: claude-code
provider_ref:
---

# Issue 004: E2E de perfil pode passar sem validar linha editada

## Review Comment

O teste captura `firstRow` e `initialPerfil`, altera o perfil, filtra pelo chip `perfil-chip-${targetPerfil}` e asserta que a **primeira linha da tabela filtrada** tem o perfil alvo (linhas 81–83). Se já existir outro estabelecimento com esse perfil, o teste passa mesmo que o PUT tenha falhado ou a linha clicada não tenha sido atualizada. O cenário também altera permanentemente a seed Docker sem teardown, contaminando re-runs e outros specs.

**Correção sugerida:** capturar identificador estável da linha (ex.: `codigo_externo` ou `nome`) antes da edição; após salvar, assertar que **essa** linha mudou; restaurar perfil original em `afterEach` ou usar estabelecimento E2E dedicado (`E2E001` etc.).

## Triage

- Decision: `valid`
- Notes: Teste usa linha `E2E001`, asserta perfil na mesma linha filtrada por código, e restaura perfil original ao final do cenário.
