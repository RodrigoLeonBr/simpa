# Frontend — SIMPA

React 19 + Vite 8 + Tailwind 4. Raiz: `simpa-frontend/src/`.

## Bootstrap

| Arquivo | Função |
|---------|--------|
| `main.tsx` | ReactDOM, providers |
| `App.tsx` | React Router, rotas protegidas |
| `contexts/AuthContext.tsx` | JWT, usuário, logout |
| `config/navigation.ts` | Menu lateral por role |

## Rotas (`App.tsx`)

| Path | Página | Role |
|------|--------|------|
| `/login` | `LoginPage` | público |
| `/` | `Painel/index` | autenticado |
| `/cadastros` | redirect | — |
| `/cadastros/estabelecimentos` | `EstabelecimentosPage` | — |
| `/cadastros/procedimentos` | `ProcedimentosPage` | — |
| `/cadastros/formas` | `FormasPage` | read-only, espelho MySQL |
| `/cadastros/cbos` | `CbosPage` | read-only, espelho MySQL |
| `/importacao` | `ImportacaoPage` | — |
| `/metas` | `MetasPage` | — |
| `/indicadores` | `IndicadoresPage` | — |
| `/relatorios` | `RelatoriosPage` | placeholder |
| `/admin/usuarios` | `UsuariosPage` | Admin |
| `/admin/auditoria` | `AuditoriaPage` | Admin / Planejamento |

### Lazy loading (`App.tsx`)

| Eager | Lazy (`LazyModuleRoute` + `Suspense`) |
|-------|----------------------------------------|
| `LoginPage`, `PainelPage` | `CadastrosPage`, `ImportacaoPage`, `AdminPage`, `MetasPage`, `IndicadoresPage`, `RelatoriosPage` |

- Wrapper: `components/shared/ModuleLoadError.tsx` — `ModuleLoadingFallback`, `ModuleLoadErrorBoundary`.
- Gráficos: `components/charts/LazyEChart.tsx` (chunk `echarts` separado via `vite.config.ts` `manualChunks`).

## Padrões reutilizáveis {#patterns}

| Padrão | Onde | Uso |
|--------|------|-----|
| `ReadOnlyCatalogPage` | `components/cadastros/` | Catálogos paginados somente leitura (Formas, CBOs, Procedimentos) |
| `usePaginatedCatalog` | `hooks/` | Estado fetch + paginação; `buildQuery` de `enrichmentView` |
| `useEntityCrud` | `hooks/` | CRUD genérico — `UsuariosPage`, `IndicadoresPainelPage` |
| `DashboardPageShell` | `components/shared/` | Loading/error em Painel, Metas, Indicadores, Relatórios |
| `CadastroCrudPage` | `components/cadastros/` | Equipes/Emendas via `CADASTRO_ENTITIES` |

**Read-only catalog:** página fina → `usePaginatedCatalog({ fetchPage, buildQuery })` → `ReadOnlyCatalogPage` com `columns`, `testId`, `searchPlaceholder`.

**CRUD hook:** `useEntityCrud({ fetchList, createItem?, updateItem, inactivateItem?, mapRowForTable, onSubmit? })` — toast e confirm integrados.

**Registry:** `config/cadastroEntities.ts` — `CADASTRO_GRID_ITEMS` com `mode`: `readonly` | `crud` | `custom`; helpers `getCadastroGridItem`, `getCadastroEntity`.


| Arquivo | Funções |
|---------|---------|
| `client.ts` | `apiFetch`, base URL, Authorization header |
| `auth.ts` | `login`, `getMe` |
| `dashboard.ts` | `fetchDashboard(competencia, { estabelecimentoId?, equipeId? })` |
| `cadastros.ts` | `fetchEstabelecimentos`, `fetchFormas`, `fetchCbos`, `updatePerfil`, `updateEnrichmentBySlug`, … |
| `sia.ts` | `sincronizarSiaProducao`, `fetchSiaSincronizacoes`, `fetchSiaSincronizacaoExiste` |
| `sih.ts` | `sincronizarSih`, `getSihSincronizacoes`, `getSihSincronizacaoExiste`, `getSihSyncProgress`; exporta `SihConflictError` + `isSihConflictError` |
| `importacao.ts` | `previewUpload`, `uploadCargas(files, resolucoes)`, mapeamentos CRUD, cargas |
| `admin.ts` | usuários, audit log |
| `config.ts` | feature flags |

Dev: Vite proxy `/api` e `/auth` → `http://localhost:3001` (`vite.config.ts`).

## Hooks (`src/hooks/`)

| Hook | Uso |
|------|-----|
| `useFilters.ts` | competência, unidade, equipe, **`painelPerfil`** (default APS); sessionStorage |
| `useDashboard.ts` | dashboard + unidades por `painelPerfil`; fetch por IDs de cadastro |
| `useImportBadge.ts` | badge importação pendente |
| `useDebounce.ts` | busca em listas |
| `usePaginatedCatalog.ts` | catálogos read-only paginados |
| `useEntityCrud.ts` | state machine CRUD (admin, widgets painel) |
| `usePainelLayout.ts` | layout dinâmico Painel APS |

`setPainelPerfil` zera `unidadeId` e `equipeId`. Perfis MAC/Misto → sem fetch de dashboard (placeholder). **Hospitalar A** → `isPainelCatalogReady('Hospitalar', 'A') = true` desde task_08 (migration_013 seeds); `usePainelLayout` retorna `null` para Hospitalar (early return `perfil !== 'APS'`), então `LayoutA` usa fallback `buildPainelKpis`.

## Painel {#painel}

```
pages/Painel/
├── index.tsx              # ProfileSwitcher + LayoutSwitcher + layouts/placeholder
├── LayoutA.tsx            # dinâmico via usePainelLayout + fallback dashboardView
├── LayoutB.tsx, LayoutC.tsx
hooks/
├── usePainelLayout.ts     # fetchPainelLayout(competencia, filtros, perfil, layout)
components/painel/
├── KpiCard.tsx            # data-testid kpi-card-{slug}
├── ProfileSwitcher.tsx
├── PainelProfilePlaceholder.tsx
└── LayoutSwitcher.tsx
utils/painelWidgetsView.ts # mapWidgetToKpi, trend, ranking
api/painelWidgets.ts       # fetchPainelLayout + cadastro CRUD/preview/discovery
```

- **Layout A dinâmico:** `usePainelLayout('A')` em paralelo com `useDashboard`; `LayoutA` mapeia widgets resolvidos → `KpiCard` / `LazyEChart`. Se `layoutError` ou lista vazia → fallback `buildPainelKpis`, `buildTrendSeries`, `buildRanking`.
- **Dashboard legado:** `fetchDashboard` + `ModuleStatusBar` inalterados (`/planejamento`).
- **Unidades:** `fetchEstabelecimentos({ perfil: painelPerfil })` → FilterBar.
- **Non-APS:** placeholder “Indicadores em definição”.
- Tipos: `types/painelWidgets.ts`, `types/contrato.ts`, `types/painel.ts`.

## Importação {#importacao}

```
pages/Importacao/
├── index.tsx              # abas Importar | Mapeamentos (planning staff)
├── UploadZone.tsx         # preview gate, pickers, modal Todas
├── PreviewMappingRow.tsx  # badge status, e-SUS vs cadastro
├── TodasConflictModal.tsx
├── MapeamentosPanel.tsx   # CRUD de-para persistente
├── HistoricoCargas.tsx
└── SihImportSection.tsx   # sync SIHD: seletor competência, progresso, histórico, 409 ConfirmDialog
```

- **Preview:** `POST /api/importacao/preview` → linhas com `mapeamento_status` (`resolved` | `pending` | `blocked`), sugestões de estabelecimento.
- **Upload:** botão Processar desabilitado enquanto houver `pending`; envia `resolucoes[]` em `POST /api/importacao/upload` (planning staff).
- **Helpers:** `utils/importacaoView.ts` — gate Process, `buildResolucoesUpload`, labels e-SUS/cadastro.
- **Tipos:** `types/importacao.ts`.

Ver **[backend-api.md](backend-api.md#importação)** e de-para em **[cadastros.md](cadastros.md#workflow-importacao-depara)**.

## Cadastros

```
pages/Cadastros/
├── index.tsx                  # router interno
├── IndicadoresPainelPage.tsx  # custom — useEntityCrud + preview/discovery
├── EstabelecimentosPage.tsx   # custom — drawer perfil/enriquecimento
├── FormasPage.tsx             # readonly — ReadOnlyCatalogPage
├── CbosPage.tsx               # readonly
├── ProcedimentosPage.tsx      # readonly
├── EstabelecimentoDetailDrawer.tsx  # orquestrador (~100 linhas)
├── EstabelecimentosPageShell.tsx
config/cadastroEntities.ts     # CADASTRO_GRID_ITEMS + mode (readonly/crud/custom)
components/cadastros/
├── ReadOnlyCatalogPage.tsx    # catálogo paginado read-only
├── CadastroCrudPage.tsx       # equipes/emendas
├── estabelecimento/           # drawer split
│   ├── EstabelecimentoDrawerChrome.tsx
│   ├── EstabelecimentoSyncedSection.tsx
│   ├── EstabelecimentoPerfilEditor.tsx
│   └── EstabelecimentoEnrichmentPanel.tsx
├── enrichment/                # forms por perfil (EnrichmentFormByPerfil)
└── ...
```

- **Grid:** `/cadastros` → `CADASTRO_GRID_ITEMS` (8 cards); cada item tem `mode` e `route`.
- **Banner SIA produção:** `SiaProducaoSyncBanner` abaixo de `CadastroSyncBanner` (somente perfis planning staff); seletor `input type=”month”`, histórico por competência, badge “Já importada” e fluxo 409 com `ConfirmDialog` + retry `reimportar:true`.
- **Badge SIHD:** `SihSyncStatusBadge` (read-only) abaixo do banner SIA; dot status verde/âmbar/vermelho + competência + link para `/importacao`; `data-testid=”sih-sync-badge”`; busca via `getSihSincronizacoes()` (sync mais recente com status 'ok').
- **Read-only:** Formas, CBOs, Procedimentos — `ReadOnlyCatalogPage` + `usePaginatedCatalog`.
- **CRUD:** Equipes, Emendas — `CadastroCrudPage` + `CADASTRO_ENTITIES`.
- **Custom:** Estabelecimentos (drawer SIA/perfil/enriquecimento), Indicadores do Painel (`useEntityCrud` estendido).
- **Indicadores do Painel:** planning staff — ver [cadastros.md#workflow-painel-widgets-dinamicos](cadastros.md#workflow-painel-widgets-dinamicos).
- **Estabelecimentos drawer:** chrome + seção SIA locked + editor perfil + painel enriquecimento por perfil.
- **Enriquecimento:** `components/cadastros/enrichment/*`; readonly para Visualizador (`canViewEnrichment`).

Helpers: `utils/enrichmentView.ts` → `buildPaginatedCatalogQuery`, `buildFormasQuery`, `buildCbosQuery`.

Ver **[cadastros.md](cadastros.md)** e workflow forma/cbo em **[cadastros.md#workflow-forma-cbo-sia-sih](cadastros.md#workflow-forma-cbo-sia-sih)**.

## Componentes compartilhados

| Pasta | Exemplos |
|-------|----------|
| `components/layout/` | `AppShell`, `Sidebar`, `FilterBar` |
| `components/shared/` | `Toast`, `DashboardPageShell`, `ModuleLoadError` |
| `components/painel/` | `ProfileSwitcher`, charts wrappers |

## Utils

| Arquivo | Função |
|---------|--------|
| `utils/dashboardView.ts` | re-export → `utils/painel/*` (KPIs, ranking, catalog) |
| `utils/indicadoresView.ts` | barrel → `metas/`, `indicadores/`, `relatorios/`, `shared/metaStatus` |
| `utils/importacaoView.ts` | re-export → `utils/importacao/*` |
| `utils/painelWidgetsView.ts` | map API widgets → KpiCard / charts |
| `utils/enrichmentByPerfil.ts` | payloads/forms por perfil |
| `utils/enrichmentView.ts` | `buildPaginatedCatalogQuery`, leitos |
| `utils/estabelecimentosView.ts` | query Painel por perfil |
| `utils/kpi.ts` | formatação KPI |

## Tipos

| Arquivo | Conteúdo |
|---------|----------|
| `types/contrato.ts` | Dashboard JSON v3.1.0; `ModuloSIHD` com `status_importacao`, `total_aih`, `pct_diarias_uti`, `taxa_mortalidade`, `internacoes_por_capitulo_cid` |
| `types/cadastros.ts` | Estabelecimento, `Forma`, `Cbo`, EnrichmentSlug, enrichment unions |
| `types/painel.ts` | `PainelPerfil`, `PainelCatalogStatus` |
| `types/painelWidgets.ts` | catálogo, widget config, layout response |
| `types/importacao.ts` | preview enriquecido, `ResolucaoUpload`, mapeamentos |
| `types/sih.ts` | `SihSincronizacao`, `SihImportResult`, `SihConflictError`, `SihSyncExistsResponse`, `SihProgress`, `SihInternacao`, `SihProcedimento` |

## Estilo

- `index.css` importa Tailwind 4 + `src/styles/{tokens,base,layout,painel,importacao,cadastros,admin}.css`.
- Tokens dark theme em `styles/tokens.css`; classes legadas preservadas por domínio.
- Charts: `LazyEChart` → chunk `echarts` (Vite `manualChunks`: `vendor`, `echarts`).

## Testes

- Vitest: `simpa-frontend/src/**/*.test.ts(x)`.
- Playwright: `perfil-painel.spec.ts`, `painel-widgets.spec.ts`, `sih-import.spec.ts`, `sih-painel-hospitalar.spec.ts`, `helpers.ts` (`login`, …).
- `npm run test:web` na raiz.
