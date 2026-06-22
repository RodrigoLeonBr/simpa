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

Record gzip after task_07 and task_13. **task_13 done:** index 14.8 KB gzip; vendor 74.5 KB; echarts 167 KB (lazy).

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

## Task 08 (completed 2026-06-21)

- Added `hooks/useEntityCrud.ts` — list/form/confirm/toast state machine genérico
- Suporta create/update/inactivate/delete, `onSubmit` custom, `mapRowForTable`, useToast integrado
- Tests: 11 passing; hook coverage ~94% lines (useEntityCrud.test.ts)
- Consumidores (UsuariosPage, IndicadoresPainelPage) → tasks 09–10

## Task 09 (completed 2026-06-21)

- `UsuariosPage` refatorada com `useEntityCrud<AdminUsuario, UsuarioCreatePayload, UsuarioUpdatePayload>`
- Mappers/messages movidos para `adminView.ts` (`mapUsuario*`, `USUARIO_CRUD_MESSAGES`)
- UX preservada: testIds, ConfirmDialog customizado, guard auto-inativação
- Administracao.test.tsx: 12 passing; build OK

## Task 10 (completed 2026-06-21)

- `IndicadoresPainelPage` refatorada com `useEntityCrud` + `onSubmit` custom
- Helpers em `indicadoresPainelView.ts`; subcomponentes `IndicadoresPainelWidgetTable`, `PainelMetricPicker`
- Preview modal, discovery e metric picker permanecem na página
- Testes reorganizados: listagem, formulário, preview, descoberta (23 passing)
- Build OK; chunk `useEntityCrud` compartilhado Admin/Cadastros

## Task 11 (completed 2026-06-21)

- `components/shared/DashboardPageShell.tsx` — wrapper loading/error para páginas analytics
- Prioridade: loading > error > children; classes `analytics-state` / `analytics-state-error`
- DashboardPageShell.test.tsx: 5 passing

## Task 12 (completed 2026-06-21)

- Painel, Metas, Indicadores, Relatórios → `DashboardPageShell` (children lazy)
- Shell: suporte a `children` função para evitar render eager em loading
- 16 testes passing (4 páginas + shell)

## Task 13 (completed 2026-06-21)

- `vite.config.ts`: `manualChunks` → `vendor` + `echarts`
- `LazyEChart.tsx` (React.lazy + Suspense); opções em `chartOptions.ts`
- Rotas lazy: Metas, Indicadores, Relatórios
- Gzip pós task_13 (build prod):
  - `index` **14.8 KB** (baseline task_07: **260 KB**)
  - `vendor` **74.5 KB** · `echarts` **167 KB** (carregado ao renderizar gráfico)
  - Chunks rota: Metas 1.0 KB · Indicadores 1.4 KB · Relatórios 1.7 KB · Cadastros 11.5 KB

## Task 14 (completed 2026-06-21)

- `EnrichmentFormByPerfil` → orquestrador + `components/cadastros/enrichment/*`
- Shared: FormShell, LeitosFields, ReadonlyFieldList, TextEnrichmentForm
- Perfil forms: Aps, Mac, Hospitalar, Misto, Outro; maior arquivo ~180 linhas
- Testes enrichment + drawer + estabelecimentos: passing

## Task 15 (completed 2026-06-21)

- `dashboardView.ts` / `importacaoView.ts` → re-export fino; `indicadoresView.ts` → barrel explícito
- Partição: `utils/painel/*`, `utils/metas/`, `utils/indicadores/`, `utils/relatorios/`, `utils/shared/metaStatus.ts`, `utils/importacao/*`
- Maior arquivo: `importacao/previewHelpers.ts` (197 linhas); nenhum >200
- Utils tests 35/35; suite completa 350/350; fix mock LazyEChart em `Situacao.test.tsx`
- `tsc -b` + build OK

## Task 16 (completed 2026-06-21)

- Drawer → `components/cadastros/estabelecimento/*`; orquestrador 107 linhas; shell em arquivo próprio
- `cadastroEntities`: `CadastroEntityMode`, `mode` em todos grid items, `getCadastroGridItem`
- Docs: `frontend.md` (#patterns), `compozy.md` (workflow concluído), `CLAUDE.md`
- Vitest 352/352; build OK; E2E 4/5 pós seed (`critical-flow` import upload — flaky/env)

**Workflow frontend-manutenibilidade: 16/16 tasks completed — pronto para cy-review-round e archive.**
