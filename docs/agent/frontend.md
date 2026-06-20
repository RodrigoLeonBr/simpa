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
| `dashboard.ts` | `fetchDashboard`, `fetchEstabelecimentosAps` |
| `cadastros.ts` | estabelecimentos, procedimentos, enriquecimento |
| `importacao.ts` | preview, processar, cargas |
| `admin.ts` | usuários, audit log |
| `config.ts` | feature flags |

Dev: Vite proxy `/api` e `/auth` → `http://localhost:3001` (`vite.config.ts`).

## Hooks (`src/hooks/`)

| Hook | Uso |
|------|-----|
| `useFilters.ts` | competência, unidade, equipe; persistência sessionStorage |
| `useDashboard.ts` | fetch dashboard + lista unidades APS |
| `useImportBadge.ts` | badge importação pendente |
| `useDebounce.ts` | busca em listas |

**Workflow futuro:** `painelPerfil` em `useFilters` (task 07) — ver `compozy.md`.

## Painel {#painel}

```
pages/Painel/
├── index.tsx           # layout switch A/B/C
├── FilterBar.tsx       # filtros competência/unidade/equipe
├── KpiGrid.tsx
├── charts/             # ECharts wrappers
└── layouts/            # LayoutA, LayoutB, LayoutC
```

- Dados: `useDashboard` → `GET /api/v1/dashboard/planejamento`.
- Unidades: hoje só `fetchEstabelecimentosAps()` — filtra `perfil === 'APS'`.
- Tipos contrato: `types/contrato.ts` (v3.1.0).

**Planejado:** `ProfileSwitcher`, KPIs por perfil, layouts por perfil (tasks 08–09).

## Cadastros

```
pages/Cadastros/
├── EstabelecimentosPage.tsx
├── ProcedimentosPage.tsx
└── components/
    ├── EstabelecimentoDetailDrawer.tsx  # drawer edição
    ├── LockedField.tsx                  # campos somente leitura
    └── ...
```

- Perfil hoje: `LockedField` (bloqueado).
- Enriquecimento: forms Hospitalar/Misto em drawer.

Ver **[cadastros.md](cadastros.md)**.

## Componentes compartilhados

| Pasta | Exemplos |
|-------|----------|
| `components/layout/` | `AppShell`, `Sidebar`, `Header` |
| `components/shared/` | `DataTable`, `Badge`, `Modal` |
| `components/painel/` | widgets reutilizáveis |

## Utils

| Arquivo | Função |
|---------|--------|
| `utils/dashboardView.ts` | transformações para charts |
| `utils/enrichmentView.ts` | labels enriquecimento |
| `utils/kpi.ts` | formatação KPI |

## Tipos

| Arquivo | Conteúdo |
|---------|----------|
| `types/contrato.ts` | Dashboard JSON v3.1.0 |
| `types/cadastros.ts` | Estabelecimento, Procedimento, Enriquecimento |

## Estilo

- Tailwind 4 em `index.css`.
- Ícones: lucide-react.
- Charts: echarts + echarts-for-react.

## Testes

- Vitest: `simpa-frontend/src/**/*.test.ts(x)`.
- `npm run test:web` na raiz.
