# Task Memory: task_06.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Expor `GET /api/cadastros/formas` e `GET /api/cadastros/cbos` com JWT e 405 para escrita (read-only MVP).

## Important Decisions

- Reutilizado helper `createReadOnlyWriteHandler(resourceLabel)` (refatorado a partir do handler de procedimentos) para formas/cbos/procedimentos.
- Rotas registradas antes de `registerResource(ENTITIES)` — sem conflito (formas/cbos não estão no registry).

## Learnings

- Testes de integração formas/cbos passam com PG local (migration 009 aplicada); suite `cadastros.integration.test.js` falha no `afterAll` por FK preexistente (`esus_cargas_equipe_id_fkey`), não relacionado a esta task.

## Files / Surfaces

- `simpa-backend/src/routes/cadastros.js` — GET formas/cbos + 405 POST/PUT/DELETE
- `simpa-backend/tests/formasCbos.routes.test.js` — unit/route tests (12 casos)
- `simpa-backend/tests/integration/cadastros.integration.test.js` — GET 200 + 405 integration

## Errors / Corrections

- Nenhum bloqueio na implementação.

## Ready for Next Run

- Task 07: cards e rotas frontend para formas/cbos em Cadastros.
