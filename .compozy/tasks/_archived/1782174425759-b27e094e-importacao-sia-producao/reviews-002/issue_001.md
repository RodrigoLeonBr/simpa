---
provider: manual
pr:
round: 2
round_created_at: 2026-06-22T23:57:33Z
status: resolved
file: consolidate_dashboard.py
line: 232
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Fallback de unidade nula mistura produção entre estabelecimentos

## Review Comment

No caminho com `estabelecimento_id`, a query de `fetch_sia_rows()` aceita:

- `estabelecimento_id = %s`
- **ou** `estabelecimento_id IS NULL AND (unidade = %s OR unidade IS NULL OR unidade = '')`

Esse fallback inclui também linhas órfãs com `unidade` nula/vazia em **qualquer** consolidação por estabelecimento, o que pode inflar métricas do módulo `ambulatorial_sia` em múltiplas unidades ao mesmo tempo. Basta existir produção com CNES órfão e `re_cnome` ausente para contaminar consolidações de estabelecimentos sem relação.

Sugestão: restringir fallback apenas ao `unidade = %s` (sem `IS NULL`/`''`) ou direcionar linhas órfãs para um bucket explícito fora da consolidação por estabelecimento. Se a regra de negócio realmente exigir inclusão de órfãos, ela precisa de critério determinístico (ex.: match por CNES ou flag dedicada), não um OR aberto para unidade nula.

## Triage

- Decision: `VALID`
- Notes:
  - Reproduzível por inspeção estática da cláusula SQL: no caminho por `estabelecimento_id`, o `OR (unidade IS NULL OR unidade = '')` captura linhas órfãs não vinculáveis ao estabelecimento consolidado.
  - Impacto é de corretude (agregação cruzada entre unidades), podendo inflar produção em múltiplos dashboards.
  - Correção aplicada em `consolidate_dashboard.py`: no ramo com IDs, fallback órfão agora é somente `estabelecimento_id IS NULL AND unidade = %s`.
  - Teste atualizado em `tests/test_consolidate.py` para garantir que a cláusula antiga com `unidade IS NULL OR unidade = ''` não aparece mais nesse fallback.
  - Verificação executada: `python -m pytest -m "not integration"` (passou).
