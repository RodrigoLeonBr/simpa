# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- Task 01 concluída: `migration_009_cadastros_forma_cbo.sql` + testes + docker-compose init 09.
- Task 02 concluída: `sync_cadastros_mysql.py` extrai forma/cbo, UPSERT em `formas_sia`/`cbos_sia`, payload JSON com blocos `formas`/`cbos` e audit ampliado.

## Shared Decisions

- Tabelas dedicadas `formas_sia` / `cbos_sia` (read-only espelho MySQL); join por código canônico 6 chars.

## Shared Learnings

- pytest integration: usar credenciais do `.env` (`PG_PASS=postgres`, porta 5433) — default conftest falha em skip.

## Open Risks

- Containers Postgres já existentes não recebem migration 009 automaticamente; aplicar via psql manual até refresh de volume.

## Handoffs

- Próximas tasks (backend APIs) dependem de migration 009 aplicada no ambiente alvo.
- Payload JSON do sync inclui `formas`/`cbos` com `{inserted, updated, inactivated}`; audit grava colunas `forma_*`/`cbo_*`.
