# Task Memory: task_08.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- Cards `formas` e `cbos` em `CADASTRO_GRID_ITEMS` com descrições MySQL/read-only — concluída.

## Important Decisions

- `CadastroEntityKey` mantido (`equipes` | `emendas`); formas/cbos são grid read-only como procedimentos, sem entrada em `CADASTRO_ENTITIES`.
- Cards inseridos após `procedimentos` (catálogos SIA sincronizados).
- Teste de grid em `Cadastros.test.tsx` atualizado de 6 para 8 links.

## Learnings

- Vitest no Windows (Node 24) pode dar timeout em workers paralelos; `--fileParallelism=false --maxWorkers=1` estabiliza execução.

## Files / Surfaces

- `simpa-frontend/src/config/cadastroEntities.ts`
- `simpa-frontend/src/config/cadastroEntities.test.ts`
- `simpa-frontend/src/pages/Cadastros/Cadastros.test.tsx`

## Errors / Corrections

- Nenhum.

## Ready for Next Run

- Task 09: client API + páginas read-only FormasPage/CbosPage.
- Task 10: rotas `/cadastros/formas` e `/cadastros/cbos` em `pages/Cadastros/index.tsx`.
