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
| `dashboard.ts` | `fetchDashboard` |
| `cadastros.ts` | `fetchEstabelecimentos`, `updatePerfil`, `updateEnrichmentBySlug`, … |
| `importacao.ts` | preview, processar, cargas |
| `admin.ts` | usuários, audit log |
| `config.ts` | feature flags |

Dev: Vite proxy `/api` e `/auth` → `http://localhost:3001` (`vite.config.ts`).

## Hooks (`src/hooks/`)

| Hook | Uso |
|------|-----|
| `useFilters.ts` | competência, unidade, equipe, **`painelPerfil`** (default APS); sessionStorage |
| `useDashboard.ts` | dashboard APS + unidades filtradas por `painelPerfil` |
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

- **Dashboard KPIs:** contrato APS via `GET /api/v1/dashboard/planejamento` (MVP).
- **Unidades:** `fetchEstabelecimentos({ perfil: painelPerfil })` → `mapEstabelecimentosToUnidades`.
- **Catálogo KPI:** `utils/dashboardView.ts` → `PAINEL_KPI_CATALOGS`; APS `ready`, demais `pending`.
- **Non-APS:** placeholder “Indicadores em definição”; sem flash de KPI APS (`isPainelCatalogReady`).
- Tipos: `types/contrato.ts`, `types/painel.ts`.

## Cadastros

```
pages/Cadastros/
├── EstabelecimentosPage.tsx
├── EstabelecimentoDetailDrawer.tsx
components/cadastros/
├── EnrichmentFormByPerfil.tsx
├── EnrichmentForm.tsx          # Hospitalar (leitos)
└── ...
```

- **Perfil:** select editável (planning staff); hint se `perfilDraft` ≠ persistido.
- **Enriquecimento:** form por perfil; readonly para Visualizador (`canViewEnrichment`).
- **SIA:** campos identidade permanecem locked.

Ver **[cadastros.md](cadastros.md)**.

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
| `types/cadastros.ts` | Estabelecimento, EnrichmentSlug, enrichment unions |
| `types/painel.ts` | `PainelPerfil`, `PainelCatalogStatus` |

## Estilo

- Tailwind 4 em `index.css`.
- Charts: echarts + echarts-for-react.

## Testes

- Vitest: `simpa-frontend/src/**/*.test.ts(x)` — ~206 testes.
- Playwright: `tests/e2e/perfil-painel.spec.ts`, `helpers.ts`.
- `npm run test:web` na raiz.
