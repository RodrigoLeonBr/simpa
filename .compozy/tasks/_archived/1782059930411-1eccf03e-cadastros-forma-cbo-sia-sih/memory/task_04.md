# Task Memory: task_04.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- Ampliar `cadastrosSync.js` para expor contadores `formas`/`cbos` no histórico e último sync.

## Important Decisions

- `mapSyncRow` usa `?? 0` em colunas `forma_*`/`cbo_*` para compatibilidade com linhas/mocks sem migration 009.

## Learnings

- `query()` em `getLatestSync` é chamado com um único argumento; `toHaveBeenCalledWith(..., undefined)` falha no Jest.

## Files / Surfaces

- `simpa-backend/src/services/cadastrosSync.js`
- `simpa-backend/tests/cadastrosSync.test.js`
- `simpa-backend/tests/cadastrosSync.routes.test.js`

## Errors / Corrections

- Assertion corrigida: checar só SQL string em `getLatestSync`, sem segundo arg `undefined`.

## Ready for Next Run

- Task 05+ (APIs formas/cbos) podem assumir shape de sync com quatro domínios no histórico.
