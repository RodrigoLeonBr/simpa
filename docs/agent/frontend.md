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

## API client (`src/api/`)

| Arquivo | Funções |
|---------|---------|
| `client.ts` | `apiFetch`, base URL, Authorization header |
| `auth.ts` | `login`, `getMe` |
| `dashboard.ts` | `fetchDashboard(competencia, { estabelecimentoId?, equipeId? })` |
| `cadastros.ts` | `fetchEstabelecimentos`, `fetchFormas`, `fetchCbos`, `updatePerfil`, `updateEnrichmentBySlug`, … |
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

`setPainelPerfil` zera `unidadeId` e `equipeId`. Perfis non-APS não chamam `fetchDashboard` (placeholder).

## Painel {#painel}

```
pages/Painel/
├── index.tsx              # ProfileSwitcher + LayoutSwitcher + layouts/placeholder
├── LayoutA.tsx, LayoutB.tsx, LayoutC.tsx
components/painel/
├── ProfileSwitcher.tsx    # APS | MAC | Hospitalar | Misto
├── PainelProfilePlaceholder.tsx
└── LayoutSwitcher.tsx
components/layout/
└── FilterBar.tsx          # competência, unidade, equipe (unidades do perfil)
```

- **Dashboard KPIs:** `fetchDashboard(competencia, { estabelecimentoId, equipeId })` quando **unidadeId e equipeId** estão setados em `useFilters`; visão municipal (sem IDs) quando filtros vazios ou só unidade selecionada.
- **Unidades:** `fetchEstabelecimentos({ perfil: painelPerfil })` → `mapEstabelecimentosToUnidades` (labels no FilterBar; não usados na query do dashboard).
- **Catálogo KPI:** `utils/dashboardView.ts` → `PAINEL_KPI_CATALOGS`; APS `ready`, demais `pending`.
- **Non-APS:** placeholder “Indicadores em definição”; sem flash de KPI APS (`isPainelCatalogReady`).
- Tipos: `types/contrato.ts`, `types/painel.ts`.
- 404 da API → `useDashboard.error` (sem crash).

## Importação {#importacao}

```
pages/Importacao/
├── index.tsx              # abas Importar | Mapeamentos (planning staff)
├── UploadZone.tsx         # preview gate, pickers, modal Todas
├── PreviewMappingRow.tsx  # badge status, e-SUS vs cadastro
├── TodasConflictModal.tsx
├── MapeamentosPanel.tsx   # CRUD de-para persistente
└── HistoricoCargas.tsx
```

- **Preview:** `POST /api/importacao/preview` → linhas com `mapeamento_status` (`resolved` | `pending` | `blocked`), sugestões de estabelecimento.
- **Upload:** botão Processar desabilitado enquanto houver `pending`; envia `resolucoes[]` em `POST /api/importacao/upload` (planning staff).
- **Helpers:** `utils/importacaoView.ts` — gate Process, `buildResolucoesUpload`, labels e-SUS/cadastro.
- **Tipos:** `types/importacao.ts`.

Ver **[backend-api.md](backend-api.md#importação)** e de-para em **[cadastros.md](cadastros.md#workflow-importacao-depara)**.

## Cadastros

```
pages/Cadastros/
├── index.tsx                  # router interno (estabelecimentos, procedimentos, formas, cbos, …)
├── EstabelecimentosPage.tsx
├── FormasPage.tsx             # read-only — formas_sia
├── CbosPage.tsx               # read-only — cbos_sia
├── EstabelecimentoDetailDrawer.tsx
config/cadastroEntities.ts     # CADASTRO_GRID_ITEMS (8 cards incl. formas/cbos)
components/cadastros/
├── ReadOnlyDataTable.tsx      # tabelas somente leitura (formas, cbos, procedimentos)
├── EnrichmentFormByPerfil.tsx
├── EnrichmentForm.tsx          # Hospitalar (leitos)
└── ...
```

- **Grid:** `/cadastros` lista cards de `CADASTRO_GRID_ITEMS`; `data-testid` `cadastro-card-formas` / `cadastro-card-cbos`.
- **Formas/CBOs:** busca com debounce via submit (`formas-search` / `cbos-search`); paginação; aviso de origem MySQL; sem edição.
- **Perfil:** select editável (planning staff); hint se `perfilDraft` ≠ persistido.
- **Enriquecimento:** form por perfil; readonly para Visualizador (`canViewEnrichment`).
- **SIA:** campos identidade permanecem locked.

Helpers: `utils/enrichmentView.ts` → `buildFormasQuery`, `buildCbosQuery`, `formatCatalogCount`.

Ver **[cadastros.md](cadastros.md)** e workflow forma/cbo em **[cadastros.md#workflow-forma-cbo-sia-sih](cadastros.md#workflow-forma-cbo-sia-sih)**.

## Componentes compartilhados

| Pasta | Exemplos |
|-------|----------|
| `components/layout/` | `AppShell`, `Sidebar`, `FilterBar` |
| `components/shared/` | `Toast`, modais |
| `components/painel/` | `ProfileSwitcher`, charts wrappers |

## Utils

| Arquivo | Função |
|---------|--------|
| `utils/dashboardView.ts` | KPIs, ranking, `PAINEL_KPI_CATALOGS`, `isPainelCatalogReady` |
| `utils/enrichmentByPerfil.ts` | payloads/forms por perfil |
| `utils/enrichmentView.ts` | `canViewEnrichment`, leitos |
| `utils/estabelecimentosView.ts` | query Painel por perfil |
| `utils/kpi.ts` | formatação KPI |

## Tipos

| Arquivo | Conteúdo |
|---------|----------|
| `types/contrato.ts` | Dashboard JSON v3.1.0 |
| `types/cadastros.ts` | Estabelecimento, `Forma`, `Cbo`, EnrichmentSlug, enrichment unions |
| `types/painel.ts` | `PainelPerfil`, `PainelCatalogStatus` |
| `types/importacao.ts` | preview enriquecido, `ResolucaoUpload`, mapeamentos |

## Estilo

- Tailwind 4 em `index.css`.
- Charts: echarts + echarts-for-react.

## Testes

- Vitest: `simpa-frontend/src/**/*.test.ts(x)` — ~235 testes.
- Playwright: `tests/e2e/perfil-painel.spec.ts`, `helpers.ts`.
- `npm run test:web` na raiz.
