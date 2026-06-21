# TechSpec — Frontend Maintainability & Initial Load Performance

**Feature:** `frontend-manutenibilidade`  
**Version:** 1.0  
**Date:** 2026-06-21  
**Status:** Accepted  
**PRD:** [_prd.md](./_prd.md)

---

## Executive Summary

Refactor `simpa-frontend` incrementally in four phases: unify read-only catalogs and CSS (Phase 1), introduce `useEntityCrud` + route/chunk optimization (Phase 2), split god modules (Phase 3), extend cadastro registry and docs (Phase 4). **No backend changes.** Behavior and API contracts remain unchanged; work is structural and load-time optimization.

Primary patterns: config-driven `ReadOnlyCatalogPage`, shared `usePaginatedCatalog`, `useEntityCrud`, `DashboardPageShell`, `React.lazy` route boundaries, Vite `manualChunks`, domain CSS files. Verification gates: `npm test --prefix simpa-frontend`, `npm run build`, existing Playwright specs.

**Trade-off:** Multiple PRs and temporary pattern coexistence vs single risky rewrite (see ADR-001).

---

## System Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ App.tsx (eager: Login, Painel, AppShell)                         │
│   Suspense + lazy: Cadastros/*, Importacao, Admin/*              │
│   Phase 2 lazy: Metas, Indicadores, Relatorios                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
     ┌──────────────────────┼──────────────────────┐
     ▼                      ▼                      ▼
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│ Painel/*    │    │ Cadastros/*     │    │ Administracao/*  │
│ + EChart    │    │ ReadOnlyCatalog │    │ useEntityCrud    │
│ (lazy P2)   │    │ CadastroCrud    │    │ Backup, Usuarios │
└─────────────┘    │ IndicadoresPainel│    └──────────────────┘
                   └─────────────────┘
                            │
                   hooks/ + components/shared/
                   utils/ (partitioned P3)
```

**Data flow:** Unchanged — `apiFetch` → Express API; `useDashboard` / cadastros API clients unchanged.

---

## Implementation Design

### Core Interfaces

```typescript
// hooks/usePaginatedCatalog.ts
export interface PaginatedCatalogResult<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface UsePaginatedCatalogOptions<T> {
  fetchPage: (query: Record<string, string>) => Promise<PaginatedCatalogResult<T>>;
  buildQuery: (search: string, page: number) => Record<string, string>;
  errorMessage?: string;
}

// components/cadastros/ReadOnlyCatalogPage.tsx
export interface ReadOnlyCatalogPageProps<T> {
  title: string;
  subtitle: string;
  backTo: string;
  columns: ReadOnlyColumn[];
  catalog: UsePaginatedCatalogReturn<T>;
  searchPlaceholder: string;
  emptyMessage: string;
  testId: string;
}
```

```typescript
// hooks/useEntityCrud.ts
export interface UseEntityCrudOptions<T, TCreate, TUpdate> {
  fetchList: () => Promise<T[]>;
  createItem?: (payload: TCreate) => Promise<T>;
  updateItem: (id: number, payload: TUpdate) => Promise<T>;
  inactivateItem?: (id: number) => Promise<unknown>;
  mapRowForTable: (row: T) => Record<string, unknown>;
}
```

```typescript
// components/shared/DashboardPageShell.tsx
export interface DashboardPageShellProps {
  loading: boolean;
  error: string | null;
  loadingLabel?: string;
  children: React.ReactNode;
}
```

```typescript
// config/cadastroEntities.ts (Phase 4 extension)
export type CadastroEntityMode = 'readonly' | 'crud' | 'custom';

export interface CadastroEntityMeta {
  slug: string;
  mode: CadastroEntityMode;
  route: string;
  label: string;
}
```

### Lazy route pattern (App.tsx)

```typescript
const CadastrosPage = lazy(() => import('./pages/Cadastros'));
const ImportacaoPage = lazy(() => import('./pages/Importacao'));
const AdminPage = lazy(() => import('./pages/Administracao'));

// Inside Routes:
<Suspense fallback={<ModuleLoadingFallback />}>
  <Route path="/cadastros/*" element={<CadastrosPage />} />
</Suspense>
```

### Vite build (Phase 2)

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        echarts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
      },
    },
  },
},
```

### Utils partition (Phase 3)

| Source | Target files |
|--------|----------------|
| `utils/dashboardView.ts` | `utils/painel/kpiView.ts`, `rankingView.ts`, `tableView.ts`, `fallbackLayout.ts`, `index.ts` (re-export) |
| `utils/indicadoresView.ts` | `utils/metas/metasView.ts`, `utils/indicadores/qualidadeView.ts`, `utils/relatorios/comparativoView.ts`, `utils/shared/metaStatus.ts` |
| `utils/importacaoView.ts` | `utils/importacao/formatters.ts`, `permissions.ts`, `previewHelpers.ts` |

Keep temporary re-exports from original paths if needed for one PR, then remove in cleanup task.

### Enrichment split (Phase 3)

```
components/cadastros/enrichment/
  EnrichmentFormByPerfil.tsx   # PERFIL_COMPONENTS map
  EnrichmentApsForm.tsx
  EnrichmentMacForm.tsx
  EnrichmentHospitalarForm.tsx
  EnrichmentMistoForm.tsx
  enrichmentShared.tsx
```

---

## API Endpoints

**None.** Frontend-only refactor. All existing `/api/*` and `/auth/*` contracts unchanged.

---

## Integration Points

None external. Internal integration:

- `ReadOnlyCatalogPage` → `api/cadastros.ts` fetch functions (unchanged signatures).
- `useEntityCrud` → `api/admin.ts`, `api/painelWidgets.ts` (unchanged).
- Playwright E2E (`simpa-frontend/tests/e2e/`) must remain green.

---

## Impact Analysis

| Component | Impact | Risk | Action |
|-----------|--------|------|--------|
| `App.tsx` | modified | Medium — lazy load | Suspense + error boundary; test navigation |
| `Formas/Cbos/ProcedimentosPage` | modified | Low | Vitest page tests |
| `UsuariosPage`, `IndicadoresPainelPage` | modified | Medium | Administracao.test, painel-widgets E2E |
| `index.css` → `styles/*` | modified | Medium — visual | Manual smoke all modules |
| `EnrichmentFormByPerfil.tsx` | split | High | estabelecimentos E2E |
| `dashboardView.ts`, `indicadoresView.ts` | split | Medium | Painel/Metas unit tests |
| `vite.config.ts` | modified | Low | Compare build output size |
| `cadastroEntities.ts` | extended | Low | Docs only for custom routes |

---

## Testing Approach

### Unit Tests (Vitest)

- **New:** `usePaginatedCatalog.test.ts`, `ReadOnlyCatalogPage.test.tsx`, `useEntityCrud.test.ts`, `DashboardPageShell.test.tsx`
- **Update:** `FormasPage`/`CbosPage`/`ProcedimentosPage` tests if exist; `Administracao.test.tsx`; `Cadastros.test.tsx`
- **Pattern:** Mock API modules (`vi.mock('../../api/cadastros')`); assert loading/error/table/pagination

### Integration / E2E

- Run existing Playwright: `painel-widgets.spec.ts`, cadastros flows, admin login
- After Phase 1: optional new spec asserting Cadastros navigation shows loading then content (if stable)

### Build gate

Every task PR:

```powershell
npm test --prefix simpa-frontend
npm run build --prefix simpa-frontend
```

Record gzip size of entry chunk in task memory for Phase 1/2 comparison.

### Coverage

Maintain ≥80% thresholds on paths listed in `vite.config.ts` coverage `include`. New hooks/components must be in include list or covered via page tests.

---

## Development Sequencing

Aligned with `_tasks.md` (16 tasks):

1. **01** `buildPaginatedCatalogQuery` — no deps  
2. **02–04** catalog hook + component + migrate pages  
3. **05–07** types, CSS, lazy routes (parallel after 01)  
4. **08–10** useEntityCrud + page refactors  
5. **11–13** dashboard shell + vite chunks  
6. **14–15** enrichment + utils splits  
7. **16** drawer split + registry + docs  

---

## Monitoring and Observability

- **Build artifact size:** Compare `dist/assets/*.js` gzip before/after Phase 1 and 2 (manual or CI artifact note).
- **No runtime telemetry** added in this feature.
- **Chunk load errors:** Log to console in dev; user-facing retry in `ModuleLoadError` component.

---

## Technical Considerations

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| ADR-002 catalog abstraction | Removes highest duplication |
| ADR-003 route lazy first | Max gzip win for Painel users |
| ADR-004 hook not mega-CRUD page | Widget cadastro needs extensions |
| ADR-005 central styles/ | Matches global CSS usage today |
| Re-export barrels Phase 3 | Avoid 20-file import churn in one commit |

### Known Risks

| Risk | Mitigation |
|------|------------|
| CSS move breaks specificity | Move blocks verbatim; visual checklist |
| Lazy route breaks test imports | E2E uses real navigation; unit tests mock router |
| useEntityCrud too generic | Start with two consumers; don't merge CadastroCrudPage yet |
| Utils split breaks imports | Temporary re-exports; grep before removing |

---

## Architecture Decision Records

- [ADR-001: Incremental Four-Phase Refactor](adrs/adr-001.md)
- [ADR-002: ReadOnlyCatalogPage + usePaginatedCatalog](adrs/adr-002.md)
- [ADR-003: Route-Level Code Splitting](adrs/adr-003.md)
- [ADR-004: useEntityCrud Hook](adrs/adr-004.md)
- [ADR-005: Central styles/ Directory](adrs/adr-005.md)

---

*Next step: `/cy-create-tasks frontend-manutenibilidade` → `_tasks.md` + `task_01.md` …*
