---
provider: manual
pr:
round: 2
round_created_at: 2026-06-22T23:57:33Z
status: resolved
file: sync_sia_mysql.py
line: 343
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Erro de batch deixa transação abortada e quebra status final

## Review Comment

Em `gravar_pg()`, erros de `execute_batch()` são capturados e atribuídos a `erros`, mas o código segue para `UPDATE sia_sincronizacoes` na mesma transação.

No PostgreSQL/psycopg2, uma falha de INSERT (ex.: violação de UNIQUE/FK) coloca a transação em estado abortado; qualquer comando seguinte falha com `InFailedSqlTransaction` até rollback. Resultado prático:

- o caminho que tenta marcar `status = 'parcial'`/`'erro'` não é confiável;
- a execução pode explodir antes de persistir metadados de sincronização;
- para reimportação, o comportamento observado depende do rollback implícito da conexão, não da lógica explícita do fluxo.

Sugestão: tratar chunk com `SAVEPOINT` por lote (rollback apenas do lote inválido) ou, ao capturar exceção, fazer `ROLLBACK`/reabrir transação e atualizar `sia_sincronizacoes` em transação limpa. Sem isso, o controle de status (`ok/parcial/erro`) fica inconsistente justamente no cenário crítico de falha de carga.

Arquivos também afetados por este mesmo problema de raiz:
- `tests/test_sync_sia_mysql.py` (não cobre comportamento de transação abortada após falha real de `execute_batch`)

## Triage

- Decision: `VALID`
- Notes:
  - O fluxo atual captura exceção de `execute_batch`, mas continua na mesma transação para atualizar `sia_sincronizacoes`; em PostgreSQL isso falha após qualquer erro de DML sem rollback.
  - O problema afeta confiabilidade de status (`ok/parcial/erro`) e auditoria da sincronização quando existe erro de lote.
  - Correção aplicada em `sync_sia_mysql.py`: cada chunk de batch é executado em `SAVEPOINT` dedicado; em falha ocorre `ROLLBACK TO SAVEPOINT` e continuidade dos próximos chunks, preservando a transação para update final de status.
  - Cobertura adicional implementada em `tests/test_sync_sia_mysql.py` (`test_gravar_pg_continua_apos_falha_de_chunk`) validando caminho parcial com rollback de chunk e continuidade.
  - Verificação executada: `python -m pytest -m "not integration"` (passou).
