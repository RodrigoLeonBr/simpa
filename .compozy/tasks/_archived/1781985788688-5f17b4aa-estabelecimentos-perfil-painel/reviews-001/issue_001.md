---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T19:30:18Z
status: resolved
file: sync_cadastros_mysql.py
line: 277
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Snapshot vazio inativa todos os estabelecimentos ativos

## Review Comment

Em `_inactivate_estabelecimentos`, quando `snapshot_keys` está vazio, a query seleciona **todos** os registros com `status = 'ativo'` para inativação (linhas 278–284). Se `extrair_prestadores` retornar lista vazia por falha transitória de MySQL, filtro incorreto ou tabela vazia, um sync aparentemente bem-sucedido inativa o cadastro inteiro no PostgreSQL — inclusive linhas com `perfil_editado=true` que o PRD protege.

**Correção sugerida:** abortar o sync ou pular a inativação em massa quando `len(rows) == 0`; exigir um limiar mínimo de snapshot ou flag explícita de confirmação antes de inativar todos os ativos.

## Triage

- Decision: `valid`
- Notes: Confirmado. `_inactivate_estabelecimentos` e `_inactivate_procedimentos` agora retornam 0 sem executar query quando `snapshot_keys` está vazio. Testes unitários adicionados em `tests/test_sync_cadastros_mysql.py`.
