# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Migration PostgreSQL `formas_sia`, `cbos_sia` e contadores em `cadastros_sincronizacoes` — concluída.

## Important Decisions

- Seguiu padrão de `migration_006` (header, manual apply, IF NOT EXISTS).
- Índices nomeados `idx_formas_sia_*` / `idx_cbos_sia_*` conforme techspec.
- Fixture de teste aplica apenas `migration_004` como pré-requisito (tabela `cadastros_sincronizacoes`).

## Learnings

- Testes de integração exigem `PG_PASS=postgres` do `.env` local (conftest default `change_me_in_production` faz skip).

## Files / Surfaces

- `migration_009_cadastros_forma_cbo.sql` (novo)
- `tests/test_migration_009.py` (novo)
- `docker-compose.yml` (volume init 09)

## Errors / Corrections

- Nenhum.

## Ready for Next Run

- Task 02 pode assumir tabelas `formas_sia`/`cbos_sia` e colunas `forma_*`/`cbo_*` em `cadastros_sincronizacoes`.
- Banco Docker existente precisa aplicar migration manualmente (init só roda em volume novo).
