# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- Task 01 concluída: `migration_009_cadastros_forma_cbo.sql` + testes + docker-compose init 09.
- Task 02 concluída: `sync_cadastros_mysql.py` extrai forma/cbo, UPSERT em `formas_sia`/`cbos_sia`, payload JSON com blocos `formas`/`cbos` e audit ampliado.
- Task 03 concluída: normalização reforçada, logging de linhas inválidas, guard `CADASTRO_SNAPSHOT_MIN_RATIO` para inativação forma/cbo.
- Task 04 concluída: `cadastrosSync.js` expõe blocos `formas`/`cbos` em histórico e último sync (`mapSyncRow` + SELECTs `forma_*`/`cbo_*`).
- Task 05 concluída: `formasService.js` / `cbosService.js` com listagem paginada (`q`, `status`, `page`, `limit`; formas também `grupo`/`subgrupo`).
- Task 06 concluída: `GET /api/cadastros/formas` e `/cbos` em `cadastros.js`; escrita retorna 405 via `createReadOnlyWriteHandler`.
- Task 07 concluída: testes backend formas/cbos/sync em `simpa-backend/tests/*` (route, unit, integração GET/405).
- Task 08 concluída: cards `formas`/`cbos` em `CADASTRO_GRID_ITEMS` (frontend).
- Task 09 concluída: páginas read-only FormasPage/CbosPage, client API.
- Task 10 concluída: rotas `/cadastros/formas|cbos` em CadastrosPage + testes grid/navegação (8 cards).
- Task 11 concluída: `GET /api/sia/producao` enriquecido com `descricao_forma`/`descricao_cbo` via `siaProducaoService` + `cadastroReferenciaService`.
- Task 12 concluída: docs agent (`backend-api`, `cadastros`, `frontend`, `database`, `etl-python`) + `CLAUDE.md`; workflow `#workflow-forma-cbo-sia-sih` com contrato SIH.

## Shared Decisions

- Tabelas dedicadas `formas_sia` / `cbos_sia` (read-only espelho MySQL); join por código canônico 6 chars.
- CBO: entrada até 8 chars (`prd_cbo`) truncada para 6 via `_canonical_code` (equivale a `left(prd_cbo, 6)`).
- Inativação forma/cbo: snapshot vazio nunca inativa; ratio mínimo `CADASTRO_SNAPSHOT_MIN_RATIO` (default 0.25).

## Shared Learnings

- pytest integration: usar credenciais do `.env` (`PG_PASS=postgres`, porta 5433) — default conftest falha em skip.

## Open Risks

- Containers Postgres já existentes não recebem migration 009 automaticamente; aplicar via psql manual até refresh de volume.

## Handoffs

- Task 07 concluída: testes backend formas/cbos/sync (route + unit + integração GET/405).
- Task 08 concluída: cards `formas`/`cbos` em `CADASTRO_GRID_ITEMS` (frontend).
- Task 09 concluída: `FormasPage`/`CbosPage` + `fetchFormas`/`fetchCbos`.
- Task 10 concluída: rotas formas/cbos no router interno + `Cadastros.test.tsx` (8 cards, resolução e click-through).
- Task 12 concluída: documentação técnica forma/cbo (sync, API, UI, SIA, contrato SIH em `cadastroReferenciaService`).
- Migration 009 ainda manual em containers existentes.
