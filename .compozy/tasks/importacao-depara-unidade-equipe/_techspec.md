# TechSpec — e-SUS Import Unit & Team Mapping (De-para)

**Feature:** `importacao-depara-unidade-equipe`  
**Version:** 1.0  
**Date:** 2026-06-20  
**Status:** Accepted  
**PRD:** [_prd.md](./_prd.md)

---

## Executive Summary

This feature adds a **persistent mapping registry** (`esus_import_mapeamentos`), a **preview gate** that blocks upload until unit/team linkage is resolved, and **cadastro foreign keys** on `esus_cargas` and `dados_consolidados`. A new Node service (`importMappingService.js`) orchestrates de-para resolution, team auto-creation, `"Todas"` conflict handling, and passes `estabelecimento_id` / `equipe_id` into existing Python ETL via CLI flags. The Panel switches dashboard queries from text `unidade`/`equipe` to ID-based lookup (with legacy name fallback for unmigrated rows).

**Primary trade-off:** Adding FK columns and a new UNIQUE constraint on IDs requires migration `006` and coordinated changes across Node, Python, and frontend—but eliminates fragile name matching and aligns import data with Cadastros filters and future Metas joins. Keeping e-SUS text columns preserves auditability at the cost of wider tables.

**MVP scope (Phase 1 per PRD):** Full import mapping flow + ID-based Panel query for new imports. Phase 2 backfill wizard is out of MVP.

---

## System Architecture

### Component Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│ Frontend — Importação + Painel                                       │
│  UploadZone.tsx — preview rows, mapping pickers, Process gate      │
│  MapeamentosPanel.tsx (new) — list/edit de-paras                   │
│  useDashboard.ts — fetchDashboard(competencia, estabelecimentoId…)  │
│  api/importacao.ts, api/dashboard.ts                               │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ REST JWT
┌────────────────────────────▼─────────────────────────────────────────┐
│ Backend — simpa-backend/src                                          │
│  routes/importacao.js — preview, upload, mapeamentos CRUD           │
│  services/importMappingService.js (NEW)                            │
│  services/parser.js / consolidator.js — extended spawn args          │
│  services/dashboardService.js — ID query + name fallback           │
│  middleware/requirePlanningStaff.js — mapeamentos mutations        │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ spawn + psycopg2
┌────────────────────────────▼─────────────────────────────────────────┐
│ Python ETL — repo root                                               │
│  parse_esus_csv.py — --pg-write --estabelecimento-id --equipe-id     │
│  consolidate_dashboard.py — filter/write by IDs                      │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│ PostgreSQL (migration_006)                                           │
│  esus_import_mapeamentos (NEW)                                       │
│  esus_cargas (+ estabelecimento_id, equipe_id; new UNIQUE)         │
│  dados_consolidados (+ estabelecimento_id, equipe_id; new UNIQUE)   │
│  estabelecimentos, equipes (existing cadastro)                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Data flow — Preview:** CSV upload → `parser.preview` (metadata only) → `importMappingService.enrichPreview(meta)` → lookup `esus_import_mapeamentos` → suggest establishments → return `mapeamento_status` per file.

**Data flow — Upload:** Client sends `files[]` + `resolucoes` JSON → validate all resolved → optional `"Todas"` purge → persist/upsert mapeamentos → ensure equipe (create if needed) → `parser.processar(path, { estabelecimentoId, equipeId })` → `consolidator.runConsolidation({ competencia, estabelecimentoId, equipeId })`.

**Data flow — Panel:** FilterBar `unidadeId` / `equipeId` → `fetchDashboard(competencia, estabelecimentoId, equipeId)` → `dashboardService` queries `dados_consolidados` by IDs.

---

## Implementation Design

### Core Interfaces

```typescript
// simpa-frontend/src/types/importacao.ts (new)

export type MapeamentoStatus = 'resolved' | 'pending' | 'blocked';

export interface EstabelecimentoSugestao {
  id: number;
  codigo_externo: string;
  nome: string;
  score: number;
}

export interface PreviewCargaEnriquecida {
  nome: string;
  tipo_relatorio: string;
  competencia: string;
  esus_unidade: string;
  esus_equipe_nome: string;
  esus_equipe_codigo: string | null;
  mapeamento_status: MapeamentoStatus;
  estabelecimento_id?: number;
  estabelecimento_codigo?: string;
  estabelecimento_nome?: string;
  equipe_id?: number;
  equipe_nome?: string;
  sugestoes_estabelecimento?: EstabelecimentoSugestao[];
  conflito_todas?: {
    exists: boolean;
    cargas_ids: number[];
    requires_confirm: boolean;
  };
  ja_importado: boolean;
  error?: string;
}

export interface ResolucaoUpload {
  arquivo: string; // original filename matching preview row
  estabelecimento_id: number;
  equipe_id: number;
  salvar_mapeamento: boolean;
  confirmar_remocao_todas?: boolean;
}
```

```javascript
// simpa-backend/src/services/importMappingService.js (exports)

/**
 * @typedef {Object} ResolvedImport
 * @property {number} estabelecimentoId
 * @property {number} equipeId
 * @property {string} estabelecimentoNome
 * @property {string} equipeNome
 */

async function enrichPreviewItem(meta, { userId }) { /* ... */ }
async function resolveForUpload(meta, resolucao, user) { /* ... */ }
async function suggestEstabelecimentos(esusUnidadeLabel, { limit = 5 }) { /* ... */ }
async function ensureEquipe({ estabelecimentoId, esusEquipeCodigo, esusEquipeNome }) { /* ... */ }
async function detectTodasConflict({ estabelecimentoId, competencia, esusEquipeNome }) { /* ... */ }
async function purgeTodasImports({ estabelecimentoId, competencia }, client) { /* ... */ }
async function listMapeamentos(query) { /* ... */ }
async function upsertMapeamento(body, user) { /* ... */ }
async function deactivateMapeamento(id, user) { /* ... */ }
```

```python
# consolidate_dashboard.py CLI extension (conceptual)

# python consolidate_dashboard.py --pg-write \
#   --competencia 2026-01 --estabelecimento-id 42 --equipe-id 7
```

### Data Models

#### Migration `migration_006_import_depara.sql`

Apply after `migration_005`; register in `docker-compose.yml` init and document in `docs/agent/database.md`.

```sql
-- 1. Mapping registry
CREATE TABLE IF NOT EXISTS esus_import_mapeamentos (
    id                  BIGSERIAL PRIMARY KEY,
    esus_unidade_label  VARCHAR(300) NOT NULL,
    esus_equipe_codigo  VARCHAR(40),
    esus_equipe_nome    VARCHAR(200),
    estabelecimento_id  BIGINT NOT NULL REFERENCES estabelecimentos(id),
    equipe_id           BIGINT REFERENCES equipes(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'ativo'
                        CHECK (status IN ('ativo', 'inativo')),
    criado_por          BIGINT REFERENCES usuarios(id),
    atualizado_por      BIGINT REFERENCES usuarios(id),
    criado_em           TIMESTAMP NOT NULL DEFAULT now(),
    atualizado_em       TIMESTAMP NOT NULL DEFAULT now(),
    ultimo_uso_em       TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_esus_mapeamento_unidade
    ON esus_import_mapeamentos (esus_unidade_label)
    WHERE status = 'ativo' AND esus_equipe_codigo IS NULL AND esus_equipe_nome IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_esus_mapeamento_equipe
    ON esus_import_mapeamentos (estabelecimento_id, esus_equipe_codigo)
    WHERE status = 'ativo' AND esus_equipe_codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_esus_mapeamento_estabelecimento
    ON esus_import_mapeamentos (estabelecimento_id);

-- 2. esus_cargas FKs (nullable for legacy rows)
ALTER TABLE esus_cargas
    ADD COLUMN IF NOT EXISTS estabelecimento_id BIGINT REFERENCES estabelecimentos(id),
    ADD COLUMN IF NOT EXISTS equipe_id BIGINT REFERENCES equipes(id);

CREATE INDEX IF NOT EXISTS idx_esus_cargas_estabelecimento
    ON esus_cargas (competencia, estabelecimento_id, equipe_id);

-- New imports: application enforces NOT NULL before INSERT (legacy rows may stay NULL)

-- 3. dados_consolidados FKs
ALTER TABLE dados_consolidados
    ADD COLUMN IF NOT EXISTS estabelecimento_id BIGINT REFERENCES estabelecimentos(id),
    ADD COLUMN IF NOT EXISTS equipe_id BIGINT REFERENCES equipes(id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dados_consolidados_ids
    ON dados_consolidados (competencia, estabelecimento_id, equipe_id)
    WHERE estabelecimento_id IS NOT NULL AND equipe_id IS NOT NULL;

-- Keep legacy UNIQUE (competencia, unidade, equipe) until Phase 2 backfill completes
```

**Mapping lookup rules:**

| Case | Registry key | Target |
|------|--------------|--------|
| Unit only | `esus_unidade_label` (active, no equipe fields) | `estabelecimento_id` |
| Unit + team | `(estabelecimento_id, esus_equipe_codigo)` or label fallback | `equipe_id` |

**Team auto-create (`ensureEquipe`):**

- Specific team: `codigo = esus_equipe_codigo` (INE), `nome = parsed equipe_nome`, `estabelecimento_id`, `tipo = 'Outra'` (or derive from name heuristics later).
- `"Todas"`: find or insert `codigo = 'TODAS-' || estabelecimento_id`, `nome = 'Todas'`.

**`"Todas"` conflict (importMappingService):**

1. `detectTodasConflict`: if incoming equipe is specific (not `"Todas"`), find cargas for `(estabelecimento_id, competencia)` where linked equipe nome = `'Todas'`.
2. If incoming is `"Todas"`, reject when any carga exists for same establishment/competence with equipe nome <> `'Todas'`.
3. `purgeTodasImports`: DELETE `esus_cargas` (CASCADE raw) + `dados_consolidados` row for Todas equipe; requires `confirmar_remocao_todas: true` in resolucao.

#### Parser / consolidator write changes

`parse_esus_csv.write_to_pg`:

- Accept `estabelecimento_id`, `equipe_id` in carga insert.
- Populate `unidade` / `equipe_nome` from e-SUS text (unchanged).
- ON CONFLICT: migrate to `(tipo_relatorio, competencia, estabelecimento_id, equipe_id)` when both IDs present; retain text conflict path only for legacy NULL-ID rows during transition.

`consolidate_dashboard.py`:

- `fetch_groups` / `fetch_raw_rows`: filter by `estabelecimento_id` + `equipe_id` when CLI IDs provided.
- `write_payload`: set FK columns; set `unidade`/`equipe` text from JOIN to `estabelecimentos.nome` / `equipes.nome` for display.
- `fetch_raw_rows` OR `equipe_nome = 'Todas'` fallback **removed** when consolidating by specific equipe_id (IDs are authoritative).

### API Endpoints

#### Importação (`routes/importacao.js`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/importacao/preview` | JWT | Existing; response enriched with mapping fields per file. Per-file parser errors return `{ error }` on row (no whole-batch 422). |
| POST | `/api/importacao/upload` | JWT | Multipart: `files[]`, `resolucoes` (JSON string array). Validates mapping; runs purge if confirmed; processes with IDs. |
| GET | `/api/importacao/mapeamentos` | JWT | List active mappings (`?q=`, pagination). |
| POST | `/api/importacao/mapeamentos` | JWT + planning | Create/update mapping. |
| PUT | `/api/importacao/mapeamentos/:id` | JWT + planning | Update mapping. |
| DELETE | `/api/importacao/mapeamentos/:id` | JWT + planning | Soft-delete (`status=inativo`). |
| GET | `/api/importacao/cargas` | JWT | Extend SELECT with `estabelecimento_id`, `equipe_id`, cadastro names (JOIN). |

**POST `/upload` request:**

```
Content-Type: multipart/form-data
files[]: (csv binaries)
resolucoes: JSON.stringify(ResolucaoUpload[])
```

**POST `/upload` validation errors:**

| Code | Condition |
|------|-----------|
| 400 | Missing `resolucoes` or filename mismatch |
| 409 | `"Todas"` conflict without `confirmar_remocao_todas` |
| 422 | Parser failure |
| 403 | Non-planning user attempting mapping save (read-only preview allowed for all JWT users) |

*Note:* Preview/read for all authenticated users; **persisting** de-para and confirming new mappings on upload require planning staff (PRD). Non-planning users see pending state but cannot Process until a planning user completes mapping—or block Process for all if any file pending (product choice: **block Process for everyone until resolved**; only planning can submit resolucoes).

#### Dashboard (`routes/dashboard.js`)

| Method | Path | Change |
|--------|------|--------|
| GET | `/api/v1/dashboard/planejamento` | Add optional `estabelecimento_id`, `equipe_id` query params. Prefer ID match; if absent, fall back to `unidade`/`equipe` names (legacy). |

**Query priority:** `estabelecimento_id` (+ `equipe_id`) → else `unidade` (+ `equipe`) text.

---

## Integration Points

| System | Integration |
|--------|-------------|
| `estabelecimentos` / `equipes` | FK targets; suggestions from `listEstabelecimentos` query (APS default or all active). |
| `parse_esus_csv.py` | New CLI flags; carga INSERT includes FKs. |
| `consolidate_dashboard.py` | New CLI flags; consolidates by FK. |
| Cadastro sync | No change; establishments must exist before import. |
| Metas (future) | Reads same `estabelecimento_id` / `equipe_id`; no MVP code. |

**Name similarity (`suggestEstabelecimentos`):**

1. Normalize: NFKD → ASCII lower → strip punctuation (same spirit as `normalize_key`).
2. Token overlap score + prefix bonus on first token (e.g., `cafi`).
3. Return top 5 active establishments; never auto-apply without user confirmation.

---

## Impact Analysis

| Component | Impact | Risk | Action |
|-----------|--------|------|--------|
| `migration_006_import_depara.sql` | New | Medium | Add to docker-compose init + docs |
| `importMappingService.js` | New | Medium | Unit + integration tests |
| `routes/importacao.js` | Modified | High | Upload contract change |
| `parse_esus_csv.py` | Modified | High | FK write + ON CONFLICT |
| `consolidate_dashboard.py` | Modified | High | ID-based fetch/write |
| `parser.js` / `consolidator.js` | Modified | Low | Pass CLI args |
| `dashboardService.js` | Modified | Medium | ID query path |
| `useDashboard.ts` / `api/dashboard.ts` | Modified | Medium | Pass IDs not names |
| `UploadZone.tsx` / `importacaoView.ts` | Modified | High | Mapping UI + gate |
| `ImportacaoPage.tsx` | Modified | Medium | Mapeamentos panel tab |
| `schema_full.sql` | Modified | Low | Mirror migration for greenfield |
| E2E `critical-flow.spec.ts` | Modified | Medium | Seed mapping + CAFI fixture |

---

## Testing Approach

### Unit Tests

**Backend (`simpa-backend/tests/importMapping.test.js`):**

- `suggestEstabelecimentos` ranks CAFI labels correctly.
- `ensureEquipe` creates INE team; reuses existing; creates `TODAS-{id}`.
- `detectTodasConflict` both directions.
- `resolveForUpload` rejects NULL establishment.

**Python (`tests/test_parse_esus_csv.py`, `tests/test_consolidate.py`):**

- `write_to_pg` includes FK columns when args passed.
- Consolidation writes `dados_consolidados.estabelecimento_id`.

**Frontend (`importacaoView.test.ts`, `UploadZone.test.tsx`):**

- Process button disabled when any row `mapeamento_status === 'pending'`.
- Todas conflict modal blocks until confirmed.

### Integration Tests

**`simpa-backend/tests/integration/importacao.integration.test.js`:**

- End-to-end: preview → upload with resolucao → `esus_cargas.estabelecimento_id` NOT NULL → dashboard GET by ID returns 200.

**E2E (Playwright):**

- Extend import flow with mapping picker mock/fixture establishment E2E001.

---

## Development Sequencing

### Build Order

1. **`migration_006_import_depara.sql`** + docker-compose + `schema_full.sql` mirror — no code dependencies.
2. **`importMappingService.js`** (suggest, lookup, ensureEquipe, Todas helpers) — depends on step 1.
3. **Unit tests for mapping service** — depends on step 2.
4. **`parse_esus_csv.py` + `parser.js`** FK args and INSERT — depends on step 1.
5. **`consolidate_dashboard.py` + `consolidator.js`** ID args — depends on step 4.
6. **`dashboardService.js` + dashboard route** ID query — depends on step 5.
7. **`routes/importacao.js`** preview enrichment + upload resolucoes + mapeamentos CRUD — depends on steps 2, 4, 5.
8. **Frontend types + `api/importacao.ts`** — depends on step 7 contract.
9. **`UploadZone.tsx` + mapping UI + Process gate** — depends on step 8.
10. **`useDashboard.ts` + `api/dashboard.ts`** ID params — depends on step 6.
11. **Integration + E2E tests** — depends on steps 9–10.
12. **`docs/agent/backend-api.md`, `database.md`, `frontend.md`** — depends on step 11.

### Technical Dependencies

- PostgreSQL migration applied before backend deploy.
- Cadastro sync must populate target establishment (e.g., `7169698`) in dev/test seeds.
- No new npm/pip packages required for MVP similarity (pure JS normalization).

---

## Monitoring and Observability

| Signal | Implementation |
|--------|----------------|
| Import blocked (pending mapping) | Log `import.preview.pending_mapping` with `requestId`, file count |
| Todas purge executed | Log `import.todas.purged` with `estabelecimento_id`, `competencia`, `carga_ids` |
| Dashboard 404 with ID filter | Log `dashboard.miss` with IDs (detects consolidation gaps) |
| Mapping created | Log `import.mapeamento.created` with `esus_unidade_label`, `estabelecimento_id` |

Structured fields: `requestId`, `estabelecimento_id`, `equipe_id`, `competencia`.

---

## Technical Considerations

### Key Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Node mapping service (ADR-003) | Auth, cadastro, routes already in Node | Python CLI contract maintenance |
| Partial unique indexes on mapeamentos | Separate unit vs team keys | Slightly complex lookup |
| Nullable FK on legacy cargas | Avoid blocking existing DBs | Must enforce NOT NULL on new writes in app |
| Dual UNIQUE on dados_consolidados (transition) | Legacy rows without IDs | Drop text UNIQUE in Phase 2 |
| Dashboard ID query with name fallback | MVP + legacy coexistence | Two query paths until backfill |

### Known Risks

| Risk | Mitigation |
|------|------------|
| ON CONFLICT migration breaks re-import | Integration test re-upload same file |
| Batch upload partial failure | Process files sequentially; return per-file result array |
| Wrong suggestion accepted | Show codigo_externo prominently; editable mapeamentos |
| `equipes.codigo` collision for Todas | Prefix with establishment id |

---

## Architecture Decision Records

Product decisions (PRD):

- [ADR-001: Mapping Registry with Preview Gate](adrs/adr-001.md) — Persistent de-para, preview blocking, team auto-create, `"Todas"` rules.
- [ADR-002: Cadastro keys on import storage](adrs/adr-002.md) — FK columns on import and consolidation tables.

Technical decisions (this TechSpec):

- [ADR-003: Node orchestration layer for import mapping](adrs/adr-003.md) — Mapping service in Node; Python receives ID CLI flags; `esus_import_mapeamentos` table.

---

## PRD Traceability

| PRD goal | Technical component |
|----------|---------------------|
| Persistent de-para | `esus_import_mapeamentos` + CRUD routes |
| Preview gate | `enrichPreviewItem` + UploadZone disabled state |
| Suggestions | `suggestEstabelecimentos` |
| FK on storage | migration_006 + parser/consolidator |
| Panel filter by unit | dashboard ID query + useDashboard |
| Team auto-create | `ensureEquipe` |
| `"Todas"` rules | `detectTodasConflict` + `purgeTodasImports` |
| Planning-only edit | `requirePlanningStaff` on mapeamentos mutations |
