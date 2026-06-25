# TechSpec — SIHD Importation and Hospital Panel

**Feature:** `importacao-sihd-hospitalar`
**Version:** 1.0
**Date:** 2026-06-24
**Status:** Accepted
**PRD:** [_prd.md](./_prd.md)

---

## Executive Summary

Builds the SIHD hospital data pipeline by mirroring the SIA pattern: standalone `sync_sih_mysql.py` extracts from MySQL (`s_aih` + `s_aih_pa`) and writes two aggregated tables to PostgreSQL (`sih_internacoes`, `sih_procedimentos`). A new Express router (`routes/sih.js`) with `requirePlanningStaff` auth and the same 409 reimport gate handles API calls. The Importação page gets a new `SihImportSection` component. The Hospital panel Layout A is activated via dynamic widget seeds in `painelMetricsService`. The consolidator is updated to populate `modulos.hospitalar_sihd` in the dashboard contract.

**Primary trade-off:** Aggregating both `s_aih` (header) and `s_aih_pa` (items) in a single sync run delivers all Hospital panel KPIs in one operation but means any competência reimport must DELETE and reinsert from both tables atomically.

---

## System Architecture

### Component Overview

```
MySQL (producao)
  s_aih + s_aih_pa + prestador
        │
        ▼ sync_sih_mysql.py (--competencia YYYY-MM --pg-write)
PostgreSQL
  sih_sincronizacoes ──► sih_internacoes (cabeçalho agregado)
                    ──► sih_procedimentos (itens s_aih_pa agregados)
        │
        ▼ POST /api/sih/sincronizar → consolidator.runConsolidation
  dados_consolidados.dados_conteudo.modulos.hospitalar_sihd
        │
        ▼ GET /planejamento → painel_widgets (Hospitalar A)
  Painel Hospitalar Layout A (dynamic widgets)
```

**New files:**
- `sync_sih_mysql.py` — Python ETL (root)
- `migration_013_sih_tabelas.sql` — PG tables + widget seeds
- `simpa-backend/src/routes/sih.js` — Express router
- `simpa-backend/src/services/sih.js` — sync orchestration
- `simpa-backend/src/services/sihProducaoService.js` — PG queries
- `simpa-frontend/src/api/sih.ts` — HTTP client
- `simpa-frontend/src/types/sih.ts` — TypeScript types
- `simpa-frontend/src/pages/Importacao/SihImportSection.tsx` — UI

**Modified files:**
- `consolidate_dashboard.py` — add `fetch_sih_rows()` + populate `hospitalar_sihd`
- `simpa-backend/src/routes/api.js` — mount `/sih`
- `simpa-frontend/src/types/contrato.ts` — expand `ModuloSIHD`
- `simpa-frontend/src/utils/painel/catalogView.ts` — Hospitalar A → `ready`
- `simpa-frontend/src/pages/Importacao/index.tsx` — render `SihImportSection`
- `schema_full.sql` — baseline updated with migration_013

---

## Implementation Design

### Core Interfaces

**`sync_sih_mysql.py` — main entry points:**

```python
def sincronizar(
    competencia: str,          # "YYYY-MM"
    *,
    pg_write: bool = False,
    reimportar: bool = False,
    exec_id: str | None = None,
) -> dict:
    """
    Orchestrates s_aih + s_aih_pa extraction, aggregation, and PG write.
    Returns: {
      competencia, status, qtd_internacoes, qtd_procedimentos,
      orphan_cnes, erros, sincronizacao_id, linhas_mysql_raw
    }
    """

def build_sih_query_internacoes() -> str:
    """GROUP BY grain for s_aih: CNES × proc × diag × complexidade × financiamento × motivo × sexo."""

def build_sih_query_procedimentos() -> str:
    """GROUP BY grain for s_aih_pa: CNES × proc_detalhado × cbo × financiamento_detalhe."""

def gravar_sih_pg(
    conn_pg, df_int: pd.DataFrame, df_proc: pd.DataFrame,
    competencia_date: date, sincronizacao_id: int, *,
    batch_size: int = 1000,
) -> tuple[int, int]:  # (qtd_internacoes, qtd_procedimentos)
    """Batch inserts both DataFrames; DELETE both tables if reimportar."""
```

**`services/sih.js` — Node.js interface:**

```javascript
// services/sih.js
async function sincronizar(competencia, { reimportar = false, executionId } = {}) {
  // Spawns: python3 sync_sih_mysql.py --competencia <c> --pg-write [--reimportar] [--exec-id <id>]
  // Streams stderr "SIH_PROGRESS " events (same JSON shape as SIA)
  // Returns parsed stdout JSON on exit code 0
}

async function getSyncProgress(executionId) {
  // Returns cached progress object or null
}

async function getCompetenciaImportada(competencia) {
  // SELECT from sih_sincronizacoes WHERE competencia = $1 AND status IN ('ok','parcial')
}
```

**`services/sihProducaoService.js`:**

```javascript
async function listInternacoes({ competencia, cnes, estabelecimentoId } = {}) {
  // SELECT from sih_internacoes with optional WHERE clauses
  // Joins rubricas_sia (financiamento), procedimento (proc_principal)
}

async function listProcedimentos({ competencia, cnes, estabelecimentoId } = {}) {
  // SELECT from sih_procedimentos
  // Joins procedimento (proc_detalhado), cbos_sia (cbo_profissional)
}
```

### Data Models

#### `sih_sincronizacoes`

```sql
CREATE TABLE sih_sincronizacoes (
    id                BIGSERIAL PRIMARY KEY,
    competencia       DATE NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('ok','parcial','erro','pendente')),
    qtd_internacoes   INT NOT NULL DEFAULT 0,
    qtd_procedimentos INT NOT NULL DEFAULT 0,
    orphan_cnes       INT NOT NULL DEFAULT 0,
    erros             INT NOT NULL DEFAULT 0,
    sincronizado_em   TIMESTAMP DEFAULT now()
);
CREATE UNIQUE INDEX idx_sih_sync_competencia ON sih_sincronizacoes (competencia);
```

#### `sih_internacoes`

```sql
CREATE TABLE sih_internacoes (
    id                  BIGSERIAL PRIMARY KEY,
    sincronizacao_id    BIGINT NOT NULL REFERENCES sih_sincronizacoes(id) ON DELETE CASCADE,
    competencia         DATE NOT NULL,
    cnes                VARCHAR(7) NOT NULL,
    estabelecimento_id  INT REFERENCES estabelecimentos(id),
    proc_principal      VARCHAR(10),
    diag_principal      VARCHAR(4),
    complexidade        VARCHAR(2),
    financiamento       VARCHAR(2),        -- 2-char = RUB_ID direct (not 4-char like SIA)
    motivo_saida        VARCHAR(2),
    sexo                VARCHAR(1),
    qtd_aih             INT NOT NULL DEFAULT 0,
    total_diarias       INT NOT NULL DEFAULT 0,
    total_diarias_uti   INT NOT NULL DEFAULT 0,
    total_valor         NUMERIC(15,2) NOT NULL DEFAULT 0,
    media_idade         NUMERIC(5,2),
    media_diarias       NUMERIC(5,2)
);
CREATE INDEX idx_sih_int_cns_cmp  ON sih_internacoes (competencia, cnes);
CREATE INDEX idx_sih_int_estab    ON sih_internacoes (competencia, estabelecimento_id);
CREATE INDEX idx_sih_int_diag     ON sih_internacoes (competencia, diag_principal);
CREATE UNIQUE INDEX idx_sih_int_grain ON sih_internacoes
    (sincronizacao_id, cnes, proc_principal, diag_principal,
     complexidade, financiamento, motivo_saida, sexo);
```

#### `sih_procedimentos`

```sql
CREATE TABLE sih_procedimentos (
    id                    BIGSERIAL PRIMARY KEY,
    sincronizacao_id      BIGINT NOT NULL REFERENCES sih_sincronizacoes(id) ON DELETE CASCADE,
    competencia           DATE NOT NULL,
    cnes                  VARCHAR(7) NOT NULL,
    estabelecimento_id    INT REFERENCES estabelecimentos(id),
    proc_detalhado        VARCHAR(10),
    cbo_profissional      VARCHAR(6),
    financiamento_detalhe VARCHAR(2),
    qtd_aih_distintas     INT NOT NULL DEFAULT 0,
    total_quantidade      INT NOT NULL DEFAULT 0,
    total_valor_item      NUMERIC(15,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_sih_proc_cns_cmp ON sih_procedimentos (competencia, cnes);
CREATE INDEX idx_sih_proc_estab   ON sih_procedimentos (competencia, estabelecimento_id);
CREATE UNIQUE INDEX idx_sih_proc_grain ON sih_procedimentos
    (sincronizacao_id, cnes, proc_detalhado, cbo_profissional, financiamento_detalhe);
```

#### TypeScript types (`types/sih.ts`)

```typescript
export interface SihSincronizacao {
  id: number;
  competencia: string;          // "YYYY-MM"
  status: 'ok' | 'parcial' | 'erro' | 'pendente';
  qtd_internacoes: number;
  qtd_procedimentos: number;
  orphan_cnes: number;
  erros: number;
  sincronizado_em: string;      // ISO datetime
}

export interface SihImportResult extends SihSincronizacao {
  linhas_mysql_raw?: number;
}

export interface SihConflictError {
  code: 'SIH_COMPETENCIA_JA_IMPORTADA';
  competencia: string;
  sincronizado_em: string;
  qtd_internacoes: number;
  qtd_procedimentos: number;
}
```

#### `ModuloSIHD` expansion (`types/contrato.ts`)

```typescript
export interface ModuloSIHD {
  status_importacao: 'OK' | 'PENDING_AIH_FILE' | 'FAILED' | 'UNKNOWN';
  competencia_sincronizada?: string;
  total_aih?: number;
  total_valor?: number;
  pct_diarias_uti?: number;
  taxa_mortalidade?: number;
  internacoes_por_capitulo_cid: Array<{
    capitulo: string;
    descricao: string;
    qtd_aih: number;
    total_valor: number;
  }>;
}
```

### API Endpoints

| Method | Path | Auth | Body / Query | Response |
|--------|------|------|--------------|----------|
| POST | `/api/sih/sincronizar` | JWT + `requirePlanningStaff` | `{ competencia: "YYYY-MM", reimportar?: boolean }` | 200 `SihImportResult` / 409 `SihConflictError` / 503 MySQL down |
| GET | `/api/sih/sincronizar/progresso/:executionId` | JWT | — | Progress object or 404 |
| GET | `/api/sih/sincronizacoes/existe` | JWT | `?competencia=YYYY-MM` | `{ exists, status, sincronizado_em, qtd_internacoes, qtd_procedimentos }` |
| GET | `/api/sih/sincronizacoes` | JWT | — | `SihSincronizacao[]` |
| GET | `/api/sih/internacoes` | JWT | `?competencia&cnes&estabelecimento_id` | Aggregated `sih_internacoes` rows |
| GET | `/api/sih/procedimentos` | JWT | `?competencia&cnes&estabelecimento_id` | Aggregated `sih_procedimentos` rows |

**409 Conflict body:**
```json
{
  "code": "SIH_COMPETENCIA_JA_IMPORTADA",
  "competencia": "2025-01",
  "sincronizado_em": "2026-06-24T10:00:00Z",
  "qtd_internacoes": 3420,
  "qtd_procedimentos": 8710
}
```

**503 MySQL Unavailable body:**
```json
{
  "code": "SIH_MYSQL_UNAVAILABLE",
  "message": "Banco SIHD (XAMPP) indisponível. Verifique a conexão e tente novamente."
}
```

---

## Integration Points

### MySQL SIHD (read-only, XAMPP)

MySQL tables `s_aih` and `s_aih_pa` in database `producao`. Connection via `etl_db.py` (`SIA_*` env vars reused; SIHD-specific overrides via `SIH_*` prefix).

**s_aih extraction query:**
```sql
SELECT
    sa.CNES                                            AS cnes,
    pr.re_cnome                                        AS unidade,
    sa.PROC_PRINCIPAL                                  AS proc_principal,
    sa.DIAG_PRINCIPAL                                  AS diag_principal,
    sa.COMPLEXIDADE                                    AS complexidade,
    sa.FINANCIAMENTO                                   AS financiamento,
    sa.MOTIVO_SAIDA                                    AS motivo_saida,
    sa.SEXO_PACIENTE                                   AS sexo,
    COUNT(DISTINCT sa.AIH)                             AS qtd_aih,
    SUM(sa.DIARIAS)                                    AS total_diarias,
    SUM(sa.DIARIAS_UTI)                                AS total_diarias_uti,
    SUM(sa.VALOR_TOTAL_AIH)                            AS total_valor,
    AVG(sa.IDADE)                                      AS media_idade,
    AVG(sa.DIARIAS)                                    AS media_diarias
FROM s_aih sa
LEFT JOIN prestador pr
    ON sa.CNES COLLATE utf8mb4_unicode_ci = pr.re_cunid COLLATE utf8mb4_unicode_ci
WHERE sa.COMPETENCIA = %(comp)s
GROUP BY
    sa.CNES, pr.re_cnome, sa.PROC_PRINCIPAL, sa.DIAG_PRINCIPAL,
    sa.COMPLEXIDADE, sa.FINANCIAMENTO, sa.MOTIVO_SAIDA, sa.SEXO_PACIENTE
```

**s_aih_pa extraction query:**
```sql
SELECT
    sp.CNES                                            AS cnes,
    sp.PROC_DETALHADO                                  AS proc_detalhado,
    sp.CBO_PROFISSIONAL                                AS cbo_profissional,
    sp.FINANCIAMENTO_DETALHE                           AS financiamento_detalhe,
    COUNT(DISTINCT sp.AIH)                             AS qtd_aih_distintas,
    SUM(sp.QUANTIDADE)                                 AS total_quantidade,
    SUM(sp.VALOR_ITEM)                                 AS total_valor_item
FROM s_aih_pa sp
WHERE sp.COMPETENCIA = %(comp)s
GROUP BY sp.CNES, sp.PROC_DETALHADO, sp.CBO_PROFISSIONAL, sp.FINANCIAMENTO_DETALHE
```

**Critical notes:**
- No CAST needed — `DIARIAS`, `DIARIAS_UTI`, `VALOR_TOTAL_AIH`, `QUANTIDADE`, `VALOR_ITEM` are native `int`/`decimal`.
- `FINANCIAMENTO` is 2 chars → `RUB_ID` direct (unlike SIA's 4-char `PRD_RUB`).
- JOIN `s_aih ↔ s_aih_pa` requires three columns (AIH + CNES + COMPETENCIA) with `COLLATE utf8mb4_unicode_ci`.
- `forma` JOIN (if added in Phase 2) requires `COLLATE utf8mb4_general_ci` (table uses general_ci).

### Consolidation pipeline

`consolidate_dashboard.py` gains `fetch_sih_rows(conn, competencia, estabelecimento_id=None)` that queries `sih_internacoes` grouped by `diag_principal` (for `internacoes_por_capitulo_cid`) and computes summary KPIs. Called inside `consolidate_group()` after `fetch_sia_rows()`. On error (no sih data for competência), returns `{'status_importacao': 'PENDING_AIH_FILE', 'internacoes_por_capitulo_cid': []}`.

### Painel Widget Seeds

`migration_013_sih_tabelas.sql` seeds `painel_metricas` and `painel_widgets` for the Hospitalar profile (Layout A). Widget slugs follow existing convention (`sih.total_aih`, `sih.taxa_mortalidade`, etc.). SQL templates use `:competencia` and `:estabelecimento_id` named params same as APS widgets.

---

## Impact Analysis

| Component | Impact | Description and Risk | Required Action |
|-----------|--------|----------------------|-----------------|
| `sync_sih_mysql.py` | **new** | New ETL script; no SIA risk | Create |
| `migration_013_sih_tabelas.sql` | **new** | New PG tables + widget seeds | Create + register in docker-compose after migration_012 |
| `schema_full.sql` | modified | Baseline updated | Append migration_013 DDL |
| `docker-compose.yml` | modified | Add migration_013 to init chain | Low risk |
| `routes/sih.js` | **new** | New router; no SIA risk | Create |
| `services/sih.js` | **new** | Spawn Python, track progress | Create |
| `services/sihProducaoService.js` | **new** | PG queries; no existing dep | Create |
| `routes/api.js` | modified | Mount `/sih` router | Low risk — additive change |
| `consolidate_dashboard.py` | modified | Add `fetch_sih_rows()` + `hospitalar_sihd` payload | Medium — existing SIA consolidation untouched; new branch only |
| `types/contrato.ts` | modified | Expand `ModuloSIHD` fields | Low — additive, backward-compatible |
| `catalogView.ts` | modified | Hospitalar A: `pending` → `ready` | Low — single line change |
| `pages/Importacao/index.tsx` | modified | Render `SihImportSection` | Low |
| `SihImportSection.tsx` | **new** | UI component in Importação page | Create |
| `api/sih.ts` | **new** | HTTP client functions | Create |
| `types/sih.ts` | **new** | TypeScript types | Create |

---

## Testing Approach

### Unit Tests

**pytest (`tests/test_sync_sih_mysql.py`):**
- `build_sih_query_internacoes()` — verify WHERE COMPETENCIA clause, no CAST, correct GROUP BY columns
- `build_sih_query_procedimentos()` — verify AIH+CNES+COMPETENCIA group keys
- `gravar_sih_pg()` — mock `execute_batch`, verify DELETE on reimportar, SAVEPOINT isolation
- `sincronizar()` with `pg_write=False` — verify dry-run returns expected JSON shape
- FINANCIAMENTO 2-char passthrough (no LEFT(…,4) truncation)

**Jest (`simpa-backend/tests/sih.test.js`):**
- `sih.js sincronizar()` — mock Python subprocess; verify 409 logic, progress event parsing
- `sihProducaoService.js listInternacoes()` — mock PG; verify WHERE competencia, estabelecimento_id filter

**Vitest (`SihImportSection.test.tsx`):**
- Renders year/month selector and Import button
- On submit: calls `sincronizarSih(competencia)`
- On 409: renders ConfirmDialog with competência metadata
- On 503: renders Portuguese error message

### Integration Tests

**pytest (`tests/test_migration_013.py`):**
- Tables `sih_sincronizacoes`, `sih_internacoes`, `sih_procedimentos` exist with all expected columns
- Unique indexes enforce grain constraints
- FK cascade: DELETE from `sih_sincronizacoes` removes child rows

**Jest (`simpa-backend/tests/sih.routes.test.js`):**
- `POST /api/sih/sincronizar` without `requirePlanningStaff` → 401
- `POST /api/sih/sincronizar` with planning staff token → 200 or 409
- `GET /api/sih/sincronizacoes/existe?competencia=invalid` → 400

**Playwright (`e2e/sih-import.spec.ts`):**
- Planning staff user navigates to `/importacao`, finds SIH section, selects competência, clicks import
- Toast appears with qtd_internacoes
- Second import of same competência shows ConfirmDialog
- Painel → Hospitalar profile → Layout A renders without error after sync

---

## Development Sequencing

### Build Order

1. **`migration_013_sih_tabelas.sql`** — no dependencies; register in docker-compose init after migration_012 and update `schema_full.sql`
2. **`sync_sih_mysql.py`** — depends on step 1 (PG tables must exist before `--pg-write`)
3. **`services/sih.js`** — depends on step 2 (spawns Python script)
4. **`services/sihProducaoService.js`** — depends on step 1 (queries PG tables)
5. **`routes/sih.js`** — depends on steps 3 and 4
6. **`routes/api.js` update** — depends on step 5 (mount `/sih`)
7. **`consolidate_dashboard.py` update** — depends on step 1 (reads sih_internacoes); update `ModuloSIHD` fields in `types/contrato.ts` at same time
8. **`types/sih.ts` + `api/sih.ts`** — depends on step 6 (API contract stable)
9. **`SihImportSection.tsx` + update `pages/Importacao/index.tsx`** — depends on step 8
10. **`catalogView.ts` Hospitalar A → `ready`** — depends on step 7 (widgets seeded in migration_013)
11. **Tests** — depends on steps 1–10: write pytest, Jest, Vitest, Playwright suites
12. **`docs/agent/` update** — depends on steps 1–11 (update backend-api.md, frontend.md, database.md)

### Technical Dependencies

- MySQL `producao` database must have `s_aih` and `s_aih_pa` tables populated (SIHD Decisor export) before manual sync testing
- `docker-compose.yml` init order: migration_012 must complete before migration_013
- `rubricas_sia` table must be populated (`sync_cadastros_mysql.py`) before testing financiamento JOIN enrichment (Phase 2)
- `painelMetricsService` dynamic widget engine (migration_008) must be operational for Hospitalar Layout A

---

## Monitoring and Observability

| Event | Log Fields | Notes |
|-------|-----------|-------|
| Sync started | `exec_id`, `competencia`, `reimportar` | stderr progress stream: `SIH_PROGRESS {"stage":"extracao_mysql_internacoes", ...}` |
| Extraction complete (s_aih) | `linhas_mysql_raw_int`, `bloco`, `duracao_ms` | Block-by-block progress |
| Extraction complete (s_aih_pa) | `linhas_mysql_raw_proc`, `duracao_ms` | Second pass |
| Insert chunk | `sincronizacao_id`, `chunk_index`, `inserted_rows_total` | Per-1000-row batch |
| Insert error (chunk) | `sincronizacao_id`, `error`, `chunk_index` | SAVEPOINT isolation; continue with next chunk |
| CNES orphan | `cnes`, `unidade` | Written to sync result JSON: `orphan_cnes` |
| MySQL unavailable | `error_type: SIH_MYSQL_UNAVAILABLE` | 503 response; no partial state written |
| Sync complete | `qtd_internacoes`, `qtd_procedimentos`, `orphan_cnes`, `duracao_total_ms` | stdout JSON; triggers consolidation |
| Consolidation includes SIHD | `competencia`, `total_aih`, `pct_diarias_uti` | Inside consolidate_group() log |

---

## Technical Considerations

### Key Decisions

**1. No CAST on numeric fields**
`s_aih` and `s_aih_pa` fields (`DIARIAS`, `DIARIAS_UTI`, `VALOR_TOTAL_AIH`, `QUANTIDADE`, `VALOR_ITEM`) are native `int`/`decimal`. Unlike SIA's `s_prd` where all metrics are `varchar` requiring `CAST(… AS UNSIGNED)`, SIHD aggregations are direct `SUM(sa.DIARIAS)`. The extraction query must NOT add CAST — it would break on numeric types.

**2. FINANCIAMENTO 2-char vs RUB_ID**
`s_aih.FINANCIAMENTO` is a 2-character code that maps directly to `s_rub.RUB_ID` (also 2 chars in SIHD context). SIA uses `LEFT(PRD_RUB, 4)` for a 4-char key. In `sih_internacoes`, `financiamento` is stored as 2 chars and must be joined to `rubricas_sia` on the 2-char `codigo_rubrica` field. A separate column `rubrica_descricao` can be added in Phase 2.

**3. UNIQUE grain constraint**
The grain `(sincronizacao_id, cnes, proc_principal, diag_principal, complexidade, financiamento, motivo_saida, sexo)` for `sih_internacoes` ensures idempotency. Python's `consolidar_para_carga()` (same pattern as SIA) pre-aggregates in-memory before insert to avoid constraint violations within a batch.

**4. Atomic reimport of both tables**
When `reimportar: true`, the Python script executes `DELETE FROM sih_internacoes WHERE sincronizacao_id = %s` and `DELETE FROM sih_procedimentos WHERE sincronizacao_id = %s` inside a transaction before re-inserting. Because both tables cascade-delete from `sih_sincronizacoes`, deleting the sync record also removes child rows — the script uses this ON DELETE CASCADE path for cleanliness.

**5. Hospital panel widget seeding in migration**
Widget SQL templates and metric definitions for the Hospitalar profile are seeded via INSERT statements in `migration_013_sih_tabelas.sql`. This keeps panel configuration versioned alongside schema changes and avoids a separate seed script. If the Indicadores do Painel UI is used to modify widgets post-deploy, those changes take precedence (same behavior as APS).

### Known Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `s_aih`/`s_aih_pa` not yet populated in XAMPP | Medium | ETL can't be fully tested until SIHD export is run; document setup requirement |
| COLLATE mismatch on `forma` JOIN (Phase 2) | Medium | Enforce `COLLATE utf8mb4_general_ci` in query; add test assertion |
| Large municipalities — s_aih_pa volume | Low | Block extraction (10000 rows) + batch insert (1000 rows); profile before deploy |
| Widget seed conflicts with existing Hospitalar entries | Low | INSERT ... ON CONFLICT DO NOTHING in seed SQL |
| Consolidation slow with SIHD branch added | Low | `fetch_sih_rows()` is a single aggregated SELECT; no loop added |

---

## Architecture Decision Records

- [ADR-001: Dual-Table Hybrid Storage + Full Hospital Panel MVP](adrs/adr-001.md) — Aggregate s_aih into `sih_internacoes` and s_aih_pa into `sih_procedimentos`; all KPI categories in Layout A MVP.
- [ADR-002: Standalone sync_sih_mysql.py ETL Script](adrs/adr-002.md) — Separate Python script per source system; no `--modulo` flag in sync_sia_mysql.py.
- [ADR-003: SIHD Import UI in /importacao Page](adrs/adr-003.md) — SIHD section in Importação page; Cadastros shows read-only status badge.
