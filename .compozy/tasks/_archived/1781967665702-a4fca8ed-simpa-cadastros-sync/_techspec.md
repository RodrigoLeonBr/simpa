# TechSpec — SIMPA Cadastros: MySQL Aggregation & Enrichment

**Feature:** `simpa-cadastros-sync`  
**Version:** 1.0  
**Date:** 2026-06-20  
**Status:** Accepted  
**Inputs:** [_prd.md](./_prd.md), [ADR-001](adrs/adr-001.md), [producao.sql](../../../producao.sql), [sync_sia_mysql.py](../../../sync_sia_mysql.py), [Task 16](../simpa/task_16.md)

---

## Executive Summary

This TechSpec implements the PRD **Unified Mirror + Enrichment** model: PostgreSQL mirrors MySQL `prestador` and `procedimento` on user-triggered sync, exposes read-only synced fields in the UI, and stores hospital planning extensions in SIMPA-owned JSONB. Teams, amendments, and indicators/metas catalog remain manual CRUD.

**Key decisions:** New Python script `sync_cadastros_mysql.py` (subprocess from Express, same pattern as SIA); new `estabelecimentos` table replacing `unidades_saude` / `prestadores_mac` / `hospitais`; procedures table becomes sync-upsert-only; Task 16 frontend redesigned to five cards with sync banner.

**Primary trade-off:** One-time schema migration and FK rewiring on `equipes` / `metas_financiamento` vs. continuing three duplicate tables — accepted to eliminate permanent data drift with production MySQL.

---

## System Architecture

### Component Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  XAMPP MySQL (producao) — READ ONLY                              │
│  prestador ─────────────┐    procedimento ─────────────┐         │
└─────────────────────────┼──────────────────────────────┼─────────┘
                          │                              │
                          ▼                              ▼
              ┌───────────────────────────────────────────────┐
              │  sync_cadastros_mysql.py (--pg-write)         │
              │  • UPSERT estabelecimentos (skip enriquecimento)│
              │  • UPSERT procedimentos                       │
              │  • INSERT cadastros_sincronizacoes log        │
              └───────────────────┬───────────────────────────┘
                                  │ stdout JSON
                                  ▼
              ┌───────────────────────────────────────────────┐
              │  Express API (cadastrosSync.js)               │
              │  POST /api/cadastros/sincronizar              │
              └───────────────────┬───────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
   estabelecimentos         procedimentos          equipes / emendas
   (+ enriquecimento)       (read-only API)        (manual CRUD)
          │                       │
          └───────────┬───────────┘
                      ▼
              React Cadastros UI (Task 16 redesign)
```

| Component | Responsibility |
|-----------|----------------|
| `sync_cadastros_mysql.py` | Extract MySQL catalogs; upsert PG; never write MySQL |
| `cadastrosSync.js` | Spawn script; parse JSON; map errors to HTTP 502 |
| `cadastros` routes | CRUD for manual entities; read + enrichment for synced |
| `cadastroRegistry.js` | Refactored: remove unidades/prestadores-mac/hospitais; add estabelecimentos read + enrichment |
| `simpa-frontend` Cadastros | Grid redesign; Establishments detail; sync button; read-only Procedures |

**Data flow (manual sync):**
1. User clicks **Update cadastros from SIA** → `POST /api/cadastros/sincronizar`
2. API spawns `sync_cadastros_mysql.py --pg-write`
3. Script upserts rows; returns `{ estabelecimentos: {inserted, updated, inactivated}, procedimentos: {...}, status }`
4. UI refreshes lists; shows `sincronizado_em` from latest `cadastros_sincronizacoes`

---

## Implementation Design

### Core Interfaces

TypeScript contracts (`simpa-frontend/src/types/cadastros.ts`):

```typescript
export type EstabelecimentoPerfil = 'APS' | 'MAC' | 'Hospitalar' | 'Misto' | 'Outro';

export interface EstabelecimentoEnriquecimento {
  leitos?: Record<string, number>;      // e.g. { cirurgico: 20, clinico: 80 }
  especialidades?: string[];
  habilitacoes?: string[];
  notas?: string;
}

export interface Estabelecimento {
  id: number;
  codigo_externo: string;
  nome: string;
  cnpj: string | null;
  re_tipo: string | null;
  tipouni: string | null;
  perfil: EstabelecimentoPerfil;
  area: number | null;
  status: string;
  sincronizado_em: string | null;
  enriquecimento: EstabelecimentoEnriquecimento;
}

export interface ProcedimentoSync {
  id: number;
  codigo_sigtap: string;
  descricao: string;
  pa_total: number | null;
  financiamento: string | null;
  status: string;
  sincronizado_em: string | null;
}

export interface CadastroSyncResult {
  status: 'ok' | 'parcial' | 'erro';
  estabelecimentos: { inserted: number; updated: number; inactivated: number };
  procedimentos: { inserted: number; updated: number; inactivated: number };
  sincronizado_em: string;
  error?: string;
}
```

Python subprocess stdout contract:

```python
# Exit 0 + JSON stdout on success
# sync_cadastros_mysql.py --pg-write
# sync_cadastros_mysql.py --dry-run   # counts only, no PG write
{
  "status": "ok",
  "estabelecimentos": {"inserted": 12, "updated": 45, "inactivated": 2},
  "procedimentos": {"inserted": 100, "updated": 320, "inactivated": 0},
  "sincronizado_em": "2026-06-20T12:00:00Z"
}
```

Profile derivation (env `CADASTRO_PERFIL_MAP`, JSON):

```json
{
  "tipouni": { "1": "APS", "2": "MAC", "3": "Hospitalar" },
  "default": "Outro"
}
```

### Data Models

**New migration:** `migration_004_cadastros_sync.sql`

```sql
CREATE TABLE estabelecimentos (
    id              BIGSERIAL PRIMARY KEY,
    codigo_externo  VARCHAR(20) UNIQUE NOT NULL,
    nome            VARCHAR(200) NOT NULL,
    cnpj            VARCHAR(14),
    re_tipo         CHAR(1),
    tipouni         CHAR(1),
    perfil          VARCHAR(20) NOT NULL DEFAULT 'Outro',
    area            INT,
    relatorio       VARCHAR(40),
    status          VARCHAR(20) NOT NULL DEFAULT 'ativo',
    enriquecimento  JSONB NOT NULL DEFAULT '{}',
    sincronizado_em TIMESTAMP,
    criado_em       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE cadastros_sincronizacoes (
    id                       BIGSERIAL PRIMARY KEY,
    status                   VARCHAR(20) NOT NULL,
    estab_inseridos          INT NOT NULL DEFAULT 0,
    estab_atualizados        INT NOT NULL DEFAULT 0,
    estab_inativados         INT NOT NULL DEFAULT 0,
    proc_inseridos           INT NOT NULL DEFAULT 0,
    proc_atualizados         INT NOT NULL DEFAULT 0,
    proc_inativados          INT NOT NULL DEFAULT 0,
    erro                     TEXT,
    sincronizado_em          TIMESTAMP NOT NULL DEFAULT now()
);

-- procedimentos: add MySQL mirror columns
ALTER TABLE procedimentos
    ADD COLUMN IF NOT EXISTS pa_total NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS rubrica VARCHAR(4),
    ADD COLUMN IF NOT EXISTS pa_id VARCHAR(9),
    ADD COLUMN IF NOT EXISTS financiamento VARCHAR(60),
    ADD COLUMN IF NOT EXISTS sincronizado_em TIMESTAMP,
    ADD COLUMN IF NOT EXISTS fonte VARCHAR(20) NOT NULL DEFAULT 'mysql_sync';

-- equipes: re-point FK
ALTER TABLE equipes ADD COLUMN estabelecimento_id BIGINT REFERENCES estabelecimentos(id);
ALTER TABLE metas_financiamento ADD COLUMN estabelecimento_id BIGINT REFERENCES estabelecimentos(id);
```

**MySQL → PostgreSQL field mapping**

| MySQL `prestador` | PG `estabelecimentos` |
|-------------------|----------------------|
| `re_cunid` | `codigo_externo` |
| `re_cnome` | `nome` |
| `cnpj` | `cnpj` |
| `re_tipo` | `re_tipo` |
| `tipouni` | `tipouni` |
| `area` | `area` |
| `relatorio` | `relatorio` |
| `ativo` (0/1) | `status` (`ativo` / `inativo`) |
| — | `perfil` (derived) |
| — | `enriquecimento` (never overwritten by sync) |

| MySQL `procedimento` | PG `procedimentos` |
|---------------------|-------------------|
| `codigo` | `codigo_sigtap` |
| `procedimento` | `descricao` |
| `PA_TOTAL` | `pa_total` |
| `FINANCIAMENTO` | `financiamento` |
| `PA_ID` | `pa_id` |
| `RUB_TOTAL` | `rubrica` |

**Upsert rules:**
- Establishments: `INSERT ... ON CONFLICT (codigo_externo) DO UPDATE SET` all scalar MySQL fields + `sincronizado_em`; **exclude** `enriquecimento`.
- Procedures: `ON CONFLICT (codigo_sigtap) DO UPDATE` synced columns only.
- Rows in PG not present in MySQL snapshot: set `status='inativo'` (soft deactivate, no hard delete).

**One-time migration from legacy tables:**
1. Insert into `estabelecimentos` from MySQL sync (authoritative).
2. Attempt match legacy `unidades_saude.codigo` / `cnes` → `codigo_externo`; copy `equipes.unidade_id` → `estabelecimento_id`.
3. Legacy `prestadores_mac` / `hospitais` rows without MySQL match: log to migration report (do not auto-insert).
4. Drop FK to `unidades_saude`; drop columns after verification; keep old tables renamed `_deprecated_*` for one release.

### API Endpoints

#### Cadastro sync

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/cadastros/sincronizar` | Spawn `sync_cadastros_mysql.py --pg-write` → `CadastroSyncResult` |
| GET | `/api/cadastros/sincronizacoes` | Paginated sync history from `cadastros_sincronizacoes` |
| GET | `/api/cadastros/sincronizacoes/ultima` | Latest successful sync timestamp + counts |

#### Establishments (replaces unidades / prestadores-mac / hospitais)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cadastros/estabelecimentos` | Query: `perfil`, `status` (default ativo), `q` (search nome/codigo) |
| GET | `/api/cadastros/estabelecimentos/:id` | Full row including `enriquecimento` |
| PUT | `/api/cadastros/estabelecimentos/:id/enriquecimento` | Body: `EstabelecimentoEnriquecimento` only |
| — | — | **No POST / DELETE** — creation/deletion comes from MySQL sync |

#### Procedures (read-only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cadastros/procedimentos` | Query: `q`, pagination; read-only list |
| GET | `/api/cadastros/procedimentos/:id` | Detail |
| — | — | **Remove** POST, PUT, DELETE for `fonte=mysql_sync` rows |

#### Unchanged manual CRUD

| Resource | Base path | Notes |
|----------|-----------|-------|
| Teams | `/api/cadastros/equipes` | `estabelecimento_id` required (dropdown from establishments) |
| Amendments | `/api/cadastros/emendas` | unchanged |
| Indicators catalog | `/api/admin/indicadores` | link from Cadastros card (PRD open question → default Admin only) |

#### Deprecated (remove after frontend migration)

| Removed path | Replacement |
|--------------|-------------|
| `/api/cadastros/unidades` | `/api/cadastros/estabelecimentos?perfil=APS` |
| `/api/cadastros/prestadores-mac` | `?perfil=MAC` |
| `/api/cadastros/hospitais` | `?perfil=Hospitalar` |

**Backward-compat shim (optional, one release):** `GET /api/cadastros/unidades` proxies to establishments APS profile for FilterBar until frontend updated.

### Frontend changes (Task 16 redesign)

| File / area | Change |
|-------------|--------|
| `config/cadastroEntities.ts` | Replace 6 entities with: estabelecimentos, procedimentos (read-only), equipes, emendas |
| `CadastroGrid.tsx` | 4–5 cards; global sync button + last sync badge |
| `CadastroCrudPage.tsx` | Split: `EstabelecimentosPage` (list + detail drawer), `ProcedimentosReadOnlyPage` |
| `FormDialog` | Hidden for synced entities; `EnrichmentForm` for hospital profile only |
| `api/cadastros.ts` | `sincronizarCadastros()`, `fetchEstabelecimentos()`, `updateEnriquecimento()` |
| `FilterBar.tsx` | `fetchEstabelecimentos({ perfil: 'APS' })` replaces `fetchUnidades()` |
| `hooks/useDashboard.ts` | Same filter API update |

**UI behavior:**
- Synced fields: disabled inputs + lock icon + tooltip "Synced from SIA".
- Establishments list: profile filter chips (APS / MAC / Hospitalar / All).
- Hospital detail: enrichment section visible when `perfil === 'Hospitalar'` (also editable for `Misto`).
- Procedures: no Novo button; search-only table.

---

## Integration Points

| System | Purpose | Auth | Error handling |
|--------|---------|------|----------------|
| **XAMPP MySQL** | Read `prestador`, `procedimento` | Read-only user (existing `.env`) | Return `MySQL_XAMPP_UNAVAILABLE`; UI shows last sync time |
| **PostgreSQL** | Mirror + enrichment storage | API pool | Transaction per sync run |
| **Python ETL** | Bulk upsert | Subprocess | Non-zero exit → HTTP 502 with stderr snippet |

Reuses ADR-003 networking (`host.docker.internal`). No new external services.

---

## Impact Analysis

| Component | Impact | Risk | Action |
|-----------|--------|------|--------|
| `migration_004_cadastros_sync.sql` | new | Medium | Apply on postgres init / migrate |
| `sync_cadastros_mysql.py` | new | Low | pytest + dry-run mode |
| `cadastroRegistry.js` | modified | Medium | Remove 3 entities; add estabelecimentos |
| `cadastros.js` routes | modified | Medium | New sync + enrichment routes |
| Task 16 frontend | replaced | High | Rewrite tests per new UX |
| `FilterBar` / `useDashboard` | modified | Low | API path change |
| `consolidate_dashboard.py` | none | — | Still uses text unidade names from production |
| `prestadores_mac`, `hospitais` tables | deprecated | Low | Rename after migration |
| `unidades_saude` | deprecated | Medium | FK migration for equipes/metas |

---

## Testing Approach

### Unit Tests

- **Python:** `test_sync_cadastros_mysql.py` — profile mapping, upsert skip enrichment, inactivate missing rows, dry-run counts; mock MySQL + PG.
- **Backend:** `cadastrosSync.test.js` — subprocess mock, JSON parse errors; `estabelecimentos.test.js` — enrichment PUT validates JSONB schema, rejects scalar field updates.
- **Frontend:** sync button flow (mock API); enrichment form; procedures table has no create button; establishments locked fields.

### Integration Tests

- **API supertest:** `POST /api/cadastros/sincronizar` with mocked subprocess fixture JSON.
- **PG integration (optional CI):** seed MySQL fixture DB or use `--dry-run` + manual seed SQL for round-trip.

### Regression

- FilterBar still populates unit dropdown after API change.
- Equipes create requires valid `estabelecimento_id`.

---

## Development Sequencing

### Build Order

1. **`migration_004_cadastros_sync.sql`** — no dependencies  
2. **`sync_cadastros_mysql.py` + pytest`** — depends on step 1  
3. **Legacy data migration script** (`scripts/migrate_cadastros_legacy.sql`) — depends on step 1  
4. **Backend: `cadastrosSync.js` + sync routes** — depends on step 2  
5. **Backend: estabelecimentos read + enrichment PUT; procedimentos read-only** — depends on steps 1, 4  
6. **Backend: equipes FK → estabelecimento_id; deprecate old routes** — depends on step 5  
7. **Frontend: API client + sync banner on Cadastros index** — depends on step 4  
8. **Frontend: Establishments + Procedures pages** — depends on step 5  
9. **Frontend: FilterBar / useDashboard API swap** — depends on step 5  
10. **Frontend: Equipes dropdown → establishments** — depends on steps 6, 8  
11. **Remove deprecated tables/routes; update Task 16 tests** — depends on steps 8–10  

### Technical Dependencies

- MySQL `prestador` / `procedimento` populated in XAMPP (existing production DB).
- `CADASTRO_PERFIL_MAP` validated with municipal SIA operator before step 8 UAT.
- Docker API container can reach MySQL (existing ADR-003 setup).

---

## Monitoring and Observability

| Metric | Source | Alert |
|--------|--------|-------|
| Cadastro sync duration | subprocess log | > 120s |
| Sync failure rate | `cadastros_sincronizacoes.status=erro` | any failure |
| Enrichment PUT errors | API 4xx/5xx | spike > 5/h |
| Establishment count drift | compare PG count vs MySQL count in dry-run | > 5% delta |

Structured log fields: `requestId`, `userId`, `syncId`, `estabInserted`, `procUpdated`, `durationMs`.

Audit log entry: `acao=cadastros_sincronizar` on successful POST.

---

## Technical Considerations

### Key Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Separate `sync_cadastros_mysql.py` | Competencia-agnostic catalog sync | Extra script |
| `estabelecimentos` + JSONB enrichment | Unified FK target; flexible hospital fields | JSONB validation in API |
| Soft-deactivate missing MySQL rows | Preserves equipes FK history | Orphan inactive rows accumulate |
| Profile mapping via env JSON | Municipal codes vary | Misconfiguration shows wrong filters |
| Keep `codigo_externo` as CNES display | PRD open question default | May need separate column later |

### Known Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `tipouni` mapping wrong for Americana | Medium | Export distinct values; workshop before UAT |
| Task 16 throwaway work | High | Already communicated in PRD |
| equipes FK broken after migration | Medium | Migration report + SQL verification queries |
| Large procedimento catalog slow UI | Low | Server-side pagination + search |

### PRD Open Questions — TechSpec defaults

| Question | Default for MVP |
|----------|-----------------|
| CNES vs `re_cunid` | Display `codigo_externo` labeled CNES |
| Indicators/Metas placement | Admin module only; Cadastros card links to `/admin` |
| Inactive establishments | Hidden by default; `?status=todos` shows |
| e-SUS name mismatch | Warning only in import UI (no mapping UI in MVP) |

---

## Architecture Decision Records

- [ADR-001: Unified Establishment Mirror from MySQL Prestador with Enrichment](adrs/adr-001.md) — Product model: single Establishments cadastro, manual sync, enrichment editable.
- [ADR-002: Dedicated Python Script for Cadastro Sync](adrs/adr-002.md) — `sync_cadastros_mysql.py` separate from SIA production sync.
- [ADR-003: Single `estabelecimentos` Table with JSONB Enrichment](adrs/adr-003.md) — Replace three PG tables; FK migration for equipes/metas.

---

## Relationship to SIMPA Task List

This TechSpec **supersedes Task 16** implementation. Recommended new tasks (via `cy-create-tasks`):

1. Migration 004 + legacy data migration  
2. Python cadastro sync script + tests  
3. Backend sync API + estabelecimentos/procedimentos endpoints  
4. Frontend Cadastros redesign + FilterBar update  
5. Deprecation cleanup + integration tests  

Task 17 (Admin) and Task 18 (E2E) should reference updated cadastro routes in their acceptance criteria.
