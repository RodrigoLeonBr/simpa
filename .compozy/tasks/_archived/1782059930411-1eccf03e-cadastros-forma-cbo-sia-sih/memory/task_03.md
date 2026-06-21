# Task Memory: task_03.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Normalização forma/cbo, skip+log de linhas inválidas e proteção contra inativação por snapshot inconsistente — concluída.

## Important Decisions

- Normalizadores já existiam (task 02); task 03 reforçou docstrings, logging e guard de volume mínimo.
- `normalize_cbo_row` aceita até 8 chars de entrada (`prd_cbo`); `_canonical_code` trunca para 6.
- Proteção extra: `snapshot_allows_inactivation` com `CADASTRO_SNAPSHOT_MIN_RATIO` (default 0.25) em forma/cbo.

## Learnings

- Testes de ratio precisam isolar `formas_sia` (`DELETE FROM formas_sia`) — contagem global inclui resíduos de outros testes.
- `_count_active_rows` compara snapshot inteiro vs ativos totais na tabela (comportamento desejado em produção).

## Files / Surfaces

- `sync_cadastros_mysql.py` — logging, `load_snapshot_min_ratio`, `snapshot_allows_inactivation`, guards em `_inactivate_formas`/`_inactivate_cbos`
- `tests/test_sync_cadastros_mysql.py` — 10 testes novos (unit + integration)

## Errors / Corrections

- Integration test de ratio falhou por dados residuais no PG; resolvido com `DELETE FROM formas_sia` no setup.

## Ready for Next Run

- Task 04+ (APIs backend read-only) podem assumir códigos canônicos 6 chars e sync seguro já validado.
