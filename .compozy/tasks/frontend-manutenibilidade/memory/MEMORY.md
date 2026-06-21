# Workflow Memory — frontend-manutenibilidade

## Baseline (2026-06-21)

- Build: `npm run build --prefix simpa-frontend` OK
- Main JS chunk: **882 KB** minified, **~277 KB gzip**
- Vite warning: chunk > 500 KB
- Static imports in App.tsx for all routes

## Artifacts

- PRD: Accepted 2026-06-21
- TechSpec: Accepted 2026-06-21
- ADRs: 001–005
- Tasks: 16 (see _tasks.md)

## Gates per task

```powershell
npm test --prefix simpa-frontend
npm run build --prefix simpa-frontend
```

Record gzip after task_07 and task_13.

## Task 01 (completed 2026-06-21)

- Added `buildPaginatedCatalogQuery(q, page, extra?)` in `enrichmentView.ts`
- `buildFormasQuery`, `buildCbosQuery`, `buildProcedimentosQuery` delegate to unified helper
- `buildEstabelecimentosQuery` uses helper with optional `perfil` extra
- Tests: 12 passing in `enrichmentView.test.ts`

## Task 02 (completed 2026-06-21)

- Added `hooks/usePaginatedCatalog.ts` with generic paginated fetch state
- Tests: 5 passing in `usePaginatedCatalog.test.ts`
- Added hook to vite coverage include

## Task 03 (completed 2026-06-21)

- Added `components/cadastros/ReadOnlyCatalogPage.tsx` (header, search, table, pagination, states)
- Tests: 6 passing in `ReadOnlyCatalogPage.test.tsx`
- Preserves testIds pattern: page, search, pagination

## Task 04 (completed 2026-06-21)

- FormasPage, CbosPage, ProcedimentosPage → thin wrappers (~38 linhas cada)
- Padrão: `usePaginatedCatalog` + `ReadOnlyCatalogPage` + `build*Query`
- testIds inalterados; Cadastros.test.tsx sem mudanças
- Tests: 26 passing (Formas/Cbos/Procedimentos + Cadastros)

## Task 05 (completed 2026-06-21)

- `Equipe`, `Emenda`, `CadastroRecord` → `types/cadastros.ts` (fonte única)
- Removidos duplicatas de `api/cadastros.ts`; re-export `Equipe`, `Emenda`, `CadastroRecord` para compat
- `CadastroRecord` = `Equipe | Emenda` (procedimentos read-only, fora do registry CRUD)
- `tsc -b` + build OK; cadastros.test.ts 8 passing

## Task 06 (completed 2026-06-21)

- `index.css` → 10 linhas (tailwind + 7 imports)
- Criados `src/styles/{tokens,base,layout,painel,importacao,cadastros,admin}.css`
- Variáveis dark theme em `tokens.css`; classes preservadas (grep smoke)
- Build OK; testes Cadastros/Importacao/Admin 27 passing

## Task 07 (completed 2026-06-21)

- `React.lazy` para Cadastros, Importação, Admin; Login + Painel eager
- `ModuleLoadingFallback` + `ModuleLoadErrorBoundary` + `LazyModuleRoute`
- Chunks separados no build; main gzip **259.8 KB** (baseline **277.4 KB**, −17.6 KB)
- Lazy chunks: Cadastros 11.3 KB, Importação 5.7 KB, Admin 4.0 KB gzip
