# TechSpec — Establishment Profile, Enrichment & Multi-Profile Painel

**Feature:** `estabelecimentos-perfil-painel`  
**Version:** 1.0  
**Date:** 2026-06-20  
**Status:** Accepted  
**PRD:** [_prd.md](./_prd.md)

---

## Executive Summary

This feature extends the existing `estabelecimentos` mirror with **editable `perfil`**, **sync-safe classification** via a `perfil_editado` flag, **profile-specific enrichment in five normalized tables**, and a **Painel profile axis** (`APS | MAC | Hospitalar | Misto`) orthogonal to layouts A/B/C. Backend changes concentrate in `estabelecimentosService.js`, `sync_cadastros_mysql.py`, and a new migration; frontend changes extend Cadastros drawer/forms, `useFilters`, `FilterBar`, and `dashboardView` KPI catalogs.

**Primary trade-off:** Normalized enrichment tables and a global `painelPerfil` filter increase schema and JOIN complexity versus keeping JSONB, but deliver stronger per-profile validation and a clear path to Phase 2 indicator packs without rewriting the hospital enrichment model.

**MVP scope:** Full Cadastros stack + Painel profile selector with **APS-complete** KPI builders; MAC/Hospitalar/Misto show unit lists and an explicit placeholder state. No dashboard consolidator or API changes in Phase 1.

---

## System Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (simpa-frontend)                                       │
│  EstabelecimentosPage / DetailDrawer  →  api/cadastros.ts       │
│  useFilters (painelPerfil)  →  FilterBar + useDashboard         │
│  Painel/index + ProfileSwitcher + LayoutA/B/C                   │
│  dashboardView.ts (PAINEL_KPI_CATALOGS)                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST /api/cadastros/*
┌───────────────────────────▼─────────────────────────────────────┐
│ Backend (simpa-backend)                                         │
│  cadastros.js routes + requirePlanningStaff                     │
│  estabelecimentosService.js (perfil, enrichment per table)      │
│  cadastrosSync.js → spawn sync_cadastros_mysql.py               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│ PostgreSQL                                                      │
│  estabelecimentos (+ perfil_editado)                            │
│  enriquecimento_{aps,mac,hospitalar,misto,outro}                │
└───────────────────────────▲─────────────────────────────────────┘
                            │ UPSERT (conditional perfil)
┌───────────────────────────┴─────────────────────────────────────┐
│ sync_cadastros_mysql.py ← MySQL prestador (read-only)           │
└─────────────────────────────────────────────────────────────────┘
```

**Data flow — Cadastros edit:** Drawer → `PUT /perfil` → sets `perfil_editado=true` → enrichment form targets table for active perfil → `PUT /enriquecimento/:slug`.

**Data flow — Sync:** Planning staff → `POST /sincronizar` → Python upsert → identity fields always updated; `perfil` updated only if `perfil_editado=false`.

**Data flow — Painel:** `painelPerfil` in context → fetch establishments by perfil → `fetchDashboard` unchanged (APS contract) → `dashboardView` selects catalog by perfil+layout.

---

## Implementation Design

### Core Interfaces

```typescript
// simpa-frontend/src/types/cadastros.ts
export type EstabelecimentoPerfil =
  | 'APS' | 'MAC' | 'Hospitalar' | 'Misto' | 'Outro';

export type EnrichmentSlug =
  | 'aps' | 'mac' | 'hospitalar' | 'misto' | 'outro';

export interface Estabelecimento {
  id: number;
  codigo_externo: string;
  nome: string;
  perfil: EstabelecimentoPerfil;
  perfil_editado: boolean;
  tipouni?: string | null;
  status: string;
  enrichment?: EnrichmentAps | EnrichmentMac | EnrichmentHospitalar | EnrichmentMisto | EnrichmentOutro;
}
```

```typescript
// simpa-frontend/src/types/painel.ts
export type PainelPerfil = 'APS' | 'MAC' | 'Hospitalar' | 'Misto';

export type PainelCatalogStatus = 'ready' | 'pending';

export interface PainelViewContext {
  perfil: PainelPerfil;
  layout: PainelLayout;
  catalogStatus: PainelCatalogStatus;
}
```

```javascript
// simpa-backend/src/services/estabelecimentosService.js (exports)
async function updatePerfil(id, perfil, user) { /* ... */ }
async function upsertEnrichment(id, slug, body, user) { /* ... */ }
async function getEstabelecimentoById(id) { /* JOIN enrichment for perfil */ }
```

### Data Models

#### Migration `migration_005_estabelecimentos_perfil_enrichment.sql`

```sql
ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS perfil_editado BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS enriquecimento_aps (
  estabelecimento_id BIGINT PRIMARY KEY REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  notas_territorio TEXT,
  cobertura_populacional VARCHAR(200),
  vinculo_esus TEXT,
  prioridades_planejamento TEXT,
  notas TEXT,
  atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enriquecimento_mac (
  estabelecimento_id BIGINT PRIMARY KEY REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  capacidades TEXT[] NOT NULL DEFAULT '{}',
  relacionamento_referencia TEXT,
  autorizacoes TEXT,
  notas TEXT,
  atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enriquecimento_hospitalar (
  estabelecimento_id BIGINT PRIMARY KEY REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  leitos JSONB NOT NULL DEFAULT '{}',
  especialidades TEXT[] NOT NULL DEFAULT '{}',
  habilitacoes TEXT[] NOT NULL DEFAULT '{}',
  capacidade_notas TEXT,
  notas TEXT,
  atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enriquecimento_misto (
  estabelecimento_id BIGINT PRIMARY KEY REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  leitos JSONB NOT NULL DEFAULT '{}',
  capacidades_ambulatoriais TEXT[] NOT NULL DEFAULT '{}',
  notas_mac TEXT,
  notas TEXT,
  atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enriquecimento_outro (
  estabelecimento_id BIGINT PRIMARY KEY REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  notas TEXT,
  atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);
```

**Backfill script** (same migration file or `scripts/migrate_enrichment_jsonb.sql`):

- For rows with `perfil IN ('Hospitalar','Misto')` and non-empty `estabelecimentos.enriquecimento`, INSERT into `enriquecimento_hospitalar` / `enriquecimento_misto` from JSONB keys.
- Leave legacy `enriquecimento` column in place; stop writing after deploy.

#### Sync UPSERT change (`sync_cadastros_mysql.py`)

Replace unconditional `perfil = EXCLUDED.perfil` with:

```sql
ON CONFLICT (codigo_externo) DO UPDATE SET
  nome = EXCLUDED.nome,
  ...
  perfil = CASE
    WHEN estabelecimentos.perfil_editado THEN estabelecimentos.perfil
    ELSE EXCLUDED.perfil
  END,
  ...
```

New inserts set `perfil_editado = false` explicitly.

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cadastros/estabelecimentos` | JWT | Unchanged; `?perfil=` filter supports `Misto` |
| GET | `/api/cadastros/estabelecimentos/:id` | JWT | Returns `perfil_editado` + enrichment for current perfil |
| PUT | `/api/cadastros/estabelecimentos/:id/perfil` | `requirePlanningStaff` | Body: `{ "perfil": "APS" }`; sets `perfil_editado=true` |
| PUT | `/api/cadastros/estabelecimentos/:id/enriquecimento/:slug` | `requirePlanningStaff` | Upsert into matching enrichment table; slug must match establishment perfil (403 otherwise) |
| PUT | `/api/cadastros/estabelecimentos/:id/enriquecimento` | — | **Deprecated** → 410 or proxy to `hospitalar` for one release |

**Response codes:** 400 validation, 403 wrong role or perfil/slug mismatch, 404 not found, 200 with full `Estabelecimento`.

**Validation highlights:**

| Slug | Rules |
|------|-------|
| `hospitalar` | `leitos` values integers ≥ 0; arrays of strings for specialties |
| `aps` | All fields optional strings; max length 2000 |
| `mac` | `capacidades` string array |
| `misto` | Same leitos rules as hospitalar when `leitos` present |
| `outro` | `notas` string only |

---

## Integration Points

| System | Integration |
|--------|-------------|
| MySQL `prestador` | Read-only via `sync_cadastros_mysql.py`; conditional perfil update |
| `cadastrosSync.js` | No change to spawn contract; sync tests extended |
| Dashboard API | Unchanged MVP; Phase 2 optional `?perfil=` |
| Audit | Log `estabelecimento_perfil_update` and `estabelecimento_enriquecimento_update` via existing `auditService` on PUT success |

---

## Impact Analysis

| Component | Impact | Risk | Action |
|-----------|--------|------|--------|
| `migration_005_*.sql` | New | Medium | Add to docker init chain |
| `sync_cadastros_mysql.py` | Modified | High | Integration test preserve perfil |
| `estabelecimentosService.js` | Modified | High | New perfil + per-table enrichment |
| `cadastros.js` routes | Modified | Medium | New routes + middleware |
| `EstabelecimentoDetailDrawer.tsx` | Modified | Medium | Editable perfil + dynamic form |
| `EnrichmentForm.tsx` | Replaced/split | Medium | Per-profile forms |
| `useFilters.tsx` | Modified | Low | Add `painelPerfil` |
| `FilterBar.tsx` | Modified | Medium | Parametric perfil fetch |
| `useDashboard.ts` | Modified | Medium | Same |
| `Painel/index.tsx` | Modified | Low | ProfileSwitcher |
| `dashboardView.ts` | Modified | Medium | Catalog registry |
| `estabelecimentos.enriquecimento` JSONB | Deprecated | Low | Read-only after migration |

---

## Testing Approach

### Unit Tests

**Backend (`simpa-backend/tests/`):**

- `updatePerfil` sets `perfil_editado=true`; rejects invalid perfil; 403 without planning role (route test with mocked user).
- `upsertEnrichment` per slug validates shapes; 403 when slug ≠ establishment perfil.
- `listEstabelecimentos` filter `perfil=Misto`.

**Python (`tests/test_sync_cadastros_mysql.py`):**

- After manual perfil + `perfil_editado=true`, re-sync does not change perfil.
- New insert still derives perfil from tipouni.
- Enrichment tables untouched by sync.

**Frontend (`simpa-frontend/src/`):**

- `enrichmentView` / new `enrichmentByPerfil` helpers.
- `dashboardView` returns `pending` for non-APS catalogs.
- `useFilters` resets unidade/equipe on perfil change.

### Integration Tests

- `cadastros.integration.test.js`: round-trip PUT perfil + PUT enrichment_aps + GET detail.
- Existing enrichment tests updated for hospitalar table path.

### E2E (Playwright — extend critical flow)

- Open estabelecimento drawer, change perfil (as admin seed user), save, verify chip filter.
- Painel: switch profile to MAC, assert placeholder visible, unit dropdown populated from cadastro.

---

## Development Sequencing

### Build Order

1. **Migration 005 + backfill** — no code dependencies.
2. **Python sync conditional perfil** — depends on step 1 (`perfil_editado` column).
3. **Backend `updatePerfil` + enrichment table services** — depends on step 1.
4. **Backend routes + `requirePlanningStaff` on enrichment** — depends on step 3.
5. **Backend tests** — depends on step 4.
6. **Frontend types + `api/cadastros.ts` clients** — depends on step 4.
7. **Cadastros drawer: editable perfil + per-profile forms** — depends on step 6.
8. **`useFilters` + `painelPerfil`** — independent of 7; can parallelize after step 6.
9. **`FilterBar` + `useDashboard` parametric fetch** — depends on step 8.
10. **`ProfileSwitcher` + `dashboardView` catalogs + Painel placeholder** — depends on steps 8–9.
11. **E2E + smoke** — depends on steps 7 and 10.

### Technical Dependencies

- Migration applied before backend deploy (docker-compose init scripts updated).
- Planning staff seed user for UAT (`admin` / `simpa@2026`).
- APS KPI catalog frozen per PRD open question #5 before step 10.

---

## Monitoring and Observability

| Signal | Implementation |
|--------|----------------|
| Perfil updates | `audit_log` action `estabelecimento_perfil_update` |
| Enrichment updates | `estabelecimento_enriquecimento_update` with `slug` in details |
| Sync perfil skips | Log count in sync JSON: `perfil_preserved_count` (optional field on sync result) |
| Painel placeholder views | Frontend analytics hook deferred; manual UAT checklist for MVP |

---

## Technical Considerations

### Key Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| `perfil_editado` boolean | Explicit sync rule, testable | Extra column |
| Five enrichment tables | Stakeholder-requested normalization | More JOINs vs JSONB |
| Dedicated `PUT /perfil` | Matches enrichment route pattern | Two calls if user edits both |
| `painelPerfil` in `useFilters` | FilterBar + Painel stay aligned | Global state blast radius |
| Client-side KPI catalogs | No consolidator change for MVP | Phase 2 needs catalog + data alignment |

### Known Risks

| Risk | Mitigation |
|------|------------|
| Legacy clients call old enrichment PUT | 307/410 with message; update frontend in same release |
| Large JOIN on list endpoint | List endpoint does **not** join enrichment; detail only |
| Perfil change leaves orphan enrichment rows | Intentional retention; document in drawer help text |
| Phase 2 MAC indicators need SIA slices | Tech debt ticket; consolidator extension in separate spec |

### Phase 2 Hooks (out of MVP build)

- `GET /api/v1/dashboard/planejamento?perfil=MAC`
- `PAINEL_KPI_CATALOGS.MAC|Hospitalar|Misto` implementations
- Optional `POST /estabelecimentos/:id/perfil/revert-derived`

---

## Architecture Decision Records

- [ADR-001: Editable Establishment Profile with Phased Multi-Profile Dashboard](adrs/adr-001.md) — Product approach: editable perfil, phased Painel indicators.
- [ADR-002: Preserve Manual Perfil via `perfil_editado` Flag](adrs/adr-002.md) — Conditional sync UPSERT for perfil preservation.
- [ADR-003: Profile-Specific Enrichment in Four Physical Tables](adrs/adr-003.md) — Normalized enrichment tables (+ `enriquecimento_outro`).
- [ADR-004: Painel Profile Axis in Global Filters + Client-Side KPI Catalogs](adrs/adr-004.md) — `painelPerfil` in `useFilters`; MVP APS-only KPI builders.

---

**Next step:** Decompose into implementation tasks with `cy-create-tasks` from this TechSpec and the PRD.
