# Task Memory: task_09.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Páginas read-only FormasPage/CbosPage com busca `q`, tabela, paginação, estados loading/erro/vazio; rotas em `/cadastros/formas` e `/cadastros/cbos`.

## Important Decisions

- Rotas dedicadas em `pages/Cadastros/index.tsx` (antes do fallback `CadastroCrudPage`), espelhando padrão de ProcedimentosPage.
- Helpers `buildFormasQuery` / `buildCbosQuery` em `enrichmentView.ts` (limit 200, page, q opcional).

## Learnings

- Cards formas/cbos já estavam em `CADASTRO_GRID_ITEMS` (task 08), mas faltavam `<Route>` — links caíam no redirect `*`.

## Files / Surfaces

- `simpa-frontend/src/pages/Cadastros/FormasPage.tsx` + test
- `simpa-frontend/src/pages/Cadastros/CbosPage.tsx` + test
- `simpa-frontend/src/pages/Cadastros/index.tsx` (rotas)
- `simpa-frontend/src/pages/Cadastros/Cadastros.test.tsx` (resolução de rotas)
- `simpa-frontend/src/api/cadastros.ts` (`fetchFormas`, `fetchCbos`)
- `simpa-frontend/src/types/cadastros.ts` (Forma, Cbo, list responses)
- `simpa-frontend/src/utils/enrichmentView.ts` (query builders)

## Errors / Corrections

- Pre-change: páginas existiam mas `/cadastros/formas|cbos` redirecionavam para grid por ausência de rotas no router interno.

## Ready for Next Run

- Task 09 concluída. Próxima: task_10 (sync banner formas/cbos) conforme PRD.
