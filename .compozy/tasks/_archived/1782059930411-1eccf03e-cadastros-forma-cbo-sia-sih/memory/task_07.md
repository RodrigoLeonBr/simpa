# Task Memory: task_07.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Testes backend para rotas `formas`/`cbos`, 405 read-only, e blocos `formas`/`cbos` em sincronizações.

## Important Decisions

- Suíte de rotas unificada em `formasCbos.routes.test.js` (mock de services); unit tests separados por service.
- Histórico de sync coberto em `cadastrosSync.test.js` (mapSyncRow/list/getLatest) e `cadastrosSync.routes.test.js` (GET/POST com mocks).
- Integração PG em `cadastros.integration.test.js` só para GET formas/cbos 200 e 405; sincronizações ficam nos route tests (determinístico).

## Learnings

- `npm test` com subset falha threshold global de cobertura; usar `npx jest <files> --coverage=false` para validar suíte da task.
- Cobertura dos arquivos tocados no suite completo: formasService/cbosService 100%, cadastrosSync ~99%, cadastros.js ~97%.

## Files / Surfaces

- `simpa-backend/tests/formasCbos.routes.test.js` (novo)
- `simpa-backend/tests/formas.test.js` (novo)
- `simpa-backend/tests/cbos.test.js` (novo)
- `simpa-backend/tests/cadastrosSync.test.js` (formas/cbos em mapSyncRow, listSyncHistory, getLatestSync, parseSyncOutput)
- `simpa-backend/tests/cadastrosSync.routes.test.js` (formas/cbos em sincronizar/sincronizacoes/ultima)
- `simpa-backend/tests/integration/cadastros.integration.test.js` (GET formas/cbos + 405)

## Errors / Corrections

- MEMORY.md handoff corrigido: task 07 era backend tests, não frontend.

## Ready for Next Run

- Task 08: cards Forma/CBO em `cadastroEntities` (frontend).
