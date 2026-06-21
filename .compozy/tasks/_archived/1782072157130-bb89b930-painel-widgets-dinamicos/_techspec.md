# TechSpec — Dynamic Painel Indicators (Cadastro + Runtime)

**Feature:** `painel-widgets-dinamicos`  
**Version:** 1.0  
**Date:** 2026-06-20  
**Status:** Accepted  
**PRD:** [_prd.md](./_prd.md)

---

## Executive Summary

Phase 0 delivered `painel_metricas_catalogo` and `painel_widgets` (migration 008) with seed parity for APS Layout A. MVP adds a **server-side metric executor**, **cadastro CRUD APIs**, a **dedicated Painel runtime endpoint**, and **frontend cadastro + dynamic LayoutA** — shipped together per PRD.

Implementation follows existing SIMPA patterns: thin Express routes → `services/*.js` → `db.query`, planning-staff middleware, dedicated Cadastros page (not generic `CadastroCrudPage`), Vitest/Jest/pytest alignment with repo CI.

**Primary trade-off:** A separate `/painel-layout` endpoint plus N SQL queries per Painel load trades a second HTTP round-trip and DB work for governed, configurable metrics without bloating ContratoDashboard v3.1.0 or exposing SQL to the browser. Batching optimization deferred to Phase 3.

---

## System Architecture

### Component Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Frontend (simpa-frontend)                                                 │
│  Painel/LayoutA.tsx ── usePainelLayout + useDashboard (parallel)         │
│  Cadastros/IndicadoresPainelPage.tsx ── api/painelWidgets.ts             │
│  utils/painelWidgetsView.ts (map API → KpiCard / EChart)                │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
         GET /v1/dashboard/painel-layout          /api/cadastros/painel-*
                             │                             │
┌────────────────────────────▼─────────────────────────────▼───────────────┐
│ Backend (simpa-backend)                                                   │
│  routes/dashboard.js          routes/cadastros.js (+ requirePlanningStaff)│
│  services/painelMetricsService.js   (bindTemplate, executeMetric)         │
│  services/painelWidgetsService.js   (CRUD, resolveLayout, discover)       │
│  services/auditService.js         (widget mutations)                      │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │ pg
┌────────────────────────────▼─────────────────────────────────────────────┐
│ PostgreSQL (existing)                                                     │
│  painel_metricas_catalogo · painel_widgets (migration 008)                │
│  esus_cargas · esus_indicadores_raw · dados_consolidados · estabelecimentos│
└──────────────────────────────────────────────────────────────────────────┘
```

**Data flow — Painel view:** `useFilters` → parallel fetch `/planejamento` + `/painel-layout` → `LayoutA` renders cards/charts from resolved widgets; `ModuleStatusBar` still uses `/planejamento`.

**Data flow — Cadastro edit:** `IndicadoresPainelPage` → CRUD `/api/cadastros/painel-widgets` → preview POST with test competência → audit log.

**Data flow — Discovery:** Planning staff → `POST /api/cadastros/painel-metricas/descobrir` → scan `esus_indicadores_raw` → UPSERT catalog entries.

---

## Implementation Design

### Core Interfaces

```typescript
// simpa-frontend/src/types/painelWidgets.ts

export type PainelWidgetTipo = 'card' | 'grafico_linha' | 'grafico_ranking' | 'grafico_barra';
export type PainelWidgetFormato = 'numero' | 'percentual' | 'moeda' | 'texto' | 'fracao';

export interface PainelMetricaCatalogo {
  id: number;
  chave: string;
  fonte_tipo: 'esus_raw' | 'sia' | 'consolidado' | 'meta' | 'placeholder';
  label: string;
  descricao: string | null;
  tipo_relatorio: string | null;
  agregacao: string;
  sql_template: string;
  ocorrencias: number;
  status: string;
}

export interface PainelWidgetConfig {
  id: number;
  slug: string;
  perfil: string;
  layout: string;
  ordem: number;
  tipo: PainelWidgetTipo;
  titulo: string;
  subtitulo: string | null;
  formato: PainelWidgetFormato;
  metrica_id: number | null;
  metrica?: PainelMetricaCatalogo;
  fonte_config: Record<string, unknown>;
  spark_metrica_id: number | null;
  spark_config: Record<string, unknown> | null;
  sql_preview: string | null;
  delta_config: Record<string, unknown> | null;
  status: string;
}

export interface ResolvedPainelWidget {
  slug: string;
  ordem: number;
  tipo: PainelWidgetTipo;
  titulo: string;
  subtitulo: string | null;
  formato: PainelWidgetFormato;
  value: number | null;
  valueLabel: string;
  isNull: boolean;
  delta?: { label: string; direction: 'up' | 'down' | 'flat' };
  sparkSeries?: number[];
  series?: Array<{ competencia: string; valor: number }>;
  ranking?: Array<{ label: string; valor: number; valueLabel: string; estabelecimento_id?: number }>;
}

export interface PainelLayoutResponse {
  perfil: string;
  layout: string;
  competencia: string;
  widgets: ResolvedPainelWidget[];
}
```

```javascript
// simpa-backend/src/services/painelMetricsService.js (exports)

/**
 * @param {number} metricaId
 * @param {{ competencia: string, estabelecimentoId?: number|null, equipeId?: number|null }} scope
 * @returns {Promise<{ rows: object[], single: number|null }>}
 */
async function executeMetric(metricaId, scope) { /* bindTemplate + query */ }

/**
 * Scan esus_indicadores_raw; upsert painel_metricas_catalogo.
 * @returns {Promise<{ inserted: number, updated: number }>}
 */
async function discoverMetricsFromRaw() { /* ... */ }

function bindTemplate(sql, scope) { /* ADR-003 */ }
```

```javascript
// simpa-backend/src/services/painelWidgetsService.js (exports)

async function listWidgets({ perfil, layout, includeInactive }) { /* JOIN metrica */ }
async function getWidgetById(id) { /* ... */ }
async function createWidget(body, user) { /* validate FKs */ }
async function updateWidget(id, body, user) { /* ... */ }
async function reorderWidgets(perfil, layout, orderedIds, user) { /* transaction */ }
async function inactivateWidget(id, user) { /* status=inativo */ }

/**
 * Resolve all active widgets for Painel runtime.
 */
async function resolvePainelLayout({ perfil, layout, competencia, estabelecimentoId, equipeId }) {
  /* load widgets → executeMetric per slot → apply fallback/delta/spark/fracao */
}
```

### Data Models

Phase 0 schema (no migration changes in MVP unless bugfix):

| Table | Purpose |
|-------|---------|
| `painel_metricas_catalogo` | Governed metrics + `sql_template` |
| `painel_widgets` | Layout slots; FK `metrica_id`, `spark_metrica_id` |

**Discovery-generated `chave` pattern:**

`esus.{tipo_relatorio}.{slug(secao)}.{slug(descricao)}.{campo_json}`

Slug helper: lowercase, ASCII fold, dots for segments, max 160 chars.

**Widget resolution rules (server):**

| `formato` | Behavior |
|-----------|----------|
| `numero` | `formatKpi` equivalent server-side or raw number + client format |
| `fracao` | Execute primary metric + `fonte_config.par_chave` → `"X / Y"` label |
| `texto` | String from first column or fixed delta label |
| `placeholder` | Always null → client shows EM_DASH / "Não apurado" |

| `tipo` | Behavior |
|--------|----------|
| `card` | Single value + optional spark from `spark_metrica_id` |
| `grafico_linha` | Rows with `competencia` + `valor` |
| `grafico_ranking` | Rows with `unidade` + `valor`, limit from `fonte_config.limite` (default 6) |

**Fallback:** If `fonte_config.fallback_chave` set and primary returns null, resolve by catalog `chave`.

**Delta (`delta_config`):**

- `tipo: 'competencia_anterior'` — re-run primary metric for previous month (reuse `computeDelta` logic ported to service).
- `tipo: 'fixo'` — static label (cobertura, metas subtitle).

**Unit filter behavior (PRD open question — default for MVP):**

- Scalar cards: scope SQL with `estabelecimento_id` / `equipe_id` when set.
- `grafico_ranking`: when unit selected, return single-row ranking or empty list with `isNull: true` (no fake municipal bars).
- `grafico_linha`: municipal historico templates unchanged; unit-scoped historico deferred unless seed template added.

### API Endpoints

#### Runtime — `routes/dashboard.js`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/dashboard/painel-layout` | JWT | Resolved widgets |

**Query:** `competencia` (required, YYYY-MM), `perfil` (default `APS`), `layout` (default `A`), `estabelecimento_id`, `equipe_id`

**Response 200:** `PainelLayoutResponse`

**Errors:** 400 invalid competência; 404 no widgets for profile/layout; 500 executor failure

#### Cadastro — `routes/cadastros.js`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cadastros/painel-widgets` | JWT | List widgets (`perfil`, `layout` query) |
| GET | `/api/cadastros/painel-widgets/:id` | JWT | Detail + joined metric |
| POST | `/api/cadastros/painel-widgets` | planning staff | Create |
| PUT | `/api/cadastros/painel-widgets/:id` | planning staff | Update |
| PATCH | `/api/cadastros/painel-widgets/reorder` | planning staff | Body: `{ perfil, layout, orderedIds: number[] }` |
| DELETE | `/api/cadastros/painel-widgets/:id` | planning staff | Soft-delete (`status=inativo`) |
| POST | `/api/cadastros/painel-widgets/preview` | planning staff | Body: widget draft or id + scope → resolved preview |
| GET | `/api/cadastros/painel-metricas` | JWT | Catalog list (`q`, `fonte_tipo`, `page`, `limit`) |
| GET | `/api/cadastros/painel-metricas/:id` | JWT | Catalog detail |
| POST | `/api/cadastros/painel-metricas/descobrir` | planning staff | Run discovery job |

**Audit actions:** `painel_widget_create`, `painel_widget_update`, `painel_widget_reorder`, `painel_widget_inactivate`, `painel_metricas_descobrir`

---

## Integration Points

| System | Integration |
|--------|-------------|
| PostgreSQL | All reads/writes via `services/db.js` `query()` |
| e-SUS raw | Discovery reads `esus_indicadores_raw` ⋈ `esus_cargas` |
| Consolidado | Seed templates query `dados_consolidados` JSONB |
| JWT / roles | Reads: any authenticated user; writes: `requirePlanningStaff` |
| `/planejamento` | Unchanged; LayoutA keeps fetching for module status + fallback KPI path |

No MySQL, Python, or ETL changes in MVP.

---

## Impact Analysis

| Component | Impact | Risk | Action |
|-----------|--------|------|--------|
| `migration_008` | existing | Low | No change |
| `dashboard.js` | modified | Low | Add `painel-layout` route |
| `cadastros.js` | modified | Med | Add painel-* routes |
| `painelMetricsService.js` | **new** | Med | Template binding tests mandatory |
| `painelWidgetsService.js` | **new** | Med | Core resolution logic |
| `LayoutA.tsx` | modified | Med | Dynamic render + fallback |
| `useDashboard.ts` | minor | Low | Optional: export filter builder for layout hook |
| `dashboardView.ts` | retained | Low | Fallback path unchanged |
| `cadastroEntities.ts` | modified | Low | New grid card `indicadores-painel` |
| `Cadastros/index.tsx` | modified | Low | New route |
| `docs/agent/*.md` | modified | Low | backend-api, cadastros, frontend, database |
| `CLAUDE.md` | modified | Low | One-line feature pointer |

---

## Testing Approach

### Unit Tests

**Backend (`simpa-backend/tests/`):**

- `painelMetricsService.test.js` — `bindTemplate` token order, rejection of bad SQL, null ID handling
- `painelWidgetsService.test.js` — mock `executeMetric`; fracao, fallback, delta, spark mapping
- Route smoke tests with supertest mocks

**Frontend (`simpa-frontend/src/`):**

- `painelWidgetsView.test.ts` — map `ResolvedPainelWidget` → `PainelKpi` shape
- `LayoutA.test.tsx` — renders dynamic widgets; fallback when layout fetch fails
- `IndicadoresPainelPage.test.tsx` — list, preview button, planning guard

### Integration Tests

- Optional PG test (`describe.skipIf(!process.env.PG_HOST)`) executing seed templates against Docker PG + `seed_esus` fixture competência
- Verify 8 widgets resolve non-null for atendimentos on known seed data

### E2E (Playwright)

- Extend or add `tests/e2e/painel-widgets.spec.ts`:
  1. Login as planning staff
  2. Open Cadastros → Indicadores do Painel
  3. Edit widget title
  4. Open Painel → assert new title visible

---

## Development Sequencing

### Build Order

1. **`painelMetricsService.js`** (`bindTemplate`, `executeMetric`) — no dependencies  
2. **`painelWidgetsService.js`** (`resolvePainelLayout`, CRUD, discovery) — depends on **1**  
3. **Unit tests for 1–2** — depends on **1–2**  
4. **`GET /v1/dashboard/painel-layout`** in `dashboard.js` — depends on **2**  
5. **Cadastro routes** `/api/cadastros/painel-*` + audit — depends on **2**  
6. **Frontend types + `api/painelWidgets.ts`** — depends on **4–5**  
7. **`usePainelLayout.ts` + dynamic `LayoutA.tsx`** with hardcoded fallback — depends on **6**  
8. **`IndicadoresPainelPage.tsx` + cadastro grid/route** — depends on **6**  
9. **Discovery endpoint + UI button** — depends on **5**  
10. **E2E + docs** (`docs/agent`, `CLAUDE.md`) — depends on **7–9**

### Technical Dependencies

- Migration 008 applied on target DB (done in dev Docker)
- No new npm/pip packages required for MVP
- Planning staff test user in seed for E2E

---

## Monitoring and Observability

| Signal | Implementation |
|--------|----------------|
| Slow layout resolution | Log `painel.layout.resolve` with `durationMs`, `widgetCount`, `competencia` |
| Template errors | Log `painel.metric.error` with `metricaId`, `chave` (no SQL text in prod logs) |
| Discovery runs | Log `painel.metric.discover` with counts inserted/updated |
| Audit | Existing `audit_log` for widget mutations |

**Alert threshold (manual review):** layout p95 > 2s with 8 widgets on municipal view.

---

## Technical Considerations

### Key Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Separate `/painel-layout` (ADR-002) | Keeps v3.1.0 contract stable | Extra HTTP request |
| Named placeholder binding (ADR-003) | Readable SQL preview | Custom binder maintenance |
| Hardcoded fallback in LayoutA | PRD F3 resilience | Dual code path until Phase 2 removes legacy |
| Fixed 8 widget slots MVP | PRD non-goal: variable grid | CSS grid unchanged |
| Cadastro page dedicated | Complex preview/SQL UX | Not reusing `CadastroCrudPage` |
| Discovery manual trigger | PRD Phase 1 | Staff must remember post-import |

### Known Risks

| Risk | Mitigation |
|------|------------|
| N+1 queries (8 widgets × 1–3 SQL each) | Accept MVP; batch in Phase 3 |
| Seed odonto spark uses atendimentos historico | Document in UI; separate metric Phase 2 |
| Ranking wrong under unit filter | ADR default: single-unit or empty |
| Catalog duplicate keys on discovery | UPSERT on `chave` UNIQUE |

### PRD Open Questions — TechSpec Defaults

1. **Cadastro label:** `Indicadores do Painel` (route `indicadores-painel`); keep `/admin` card separate.  
2. **Unit + ranking:** show at most one bar when filtered.  
3. **Odonto spark:** keep seed mapping Phase 1.  
4. **Build order:** steps 1–10 above (executor → runtime → cadastro UI together in one MVP branch).

---

## Architecture Decision Records

- [ADR-001: Curated Metric Catalog with Governed SQL Templates](adrs/adr-001.md) — Product-level: catalog + templates, planning-only config, cadastro and Painel equal priority.
- [ADR-002: Dedicated Painel Layout Runtime Endpoint](adrs/adr-002.md) — `GET /v1/dashboard/painel-layout` separate from `/planejamento`.
- [ADR-003: Server-Side Named Placeholder Binding for SQL Templates](adrs/adr-003.md) — `:competencia` → `$n` binding with whitelist; no client-side SQL.

---

*Next step after approval: `cy-create-tasks` to decompose into implementation task files.*
