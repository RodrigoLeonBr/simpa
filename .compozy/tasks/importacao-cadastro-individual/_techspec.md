# TechSpec: Importação de Cadastro Individual e Denominadores de Indicadores

## Executive Summary

This feature extends the SIMPA e-SUS import pipeline to accept "Relatório de Cadastro Individual Analítico" CSVs, storing aggregated population snapshots per health unit per competência in a new dedicated table (`populacao_cadastrada`). The stored data feeds two consumers: (1) the consolidation pipeline, which reads `populacao_cadastrada` to compute denominators for quality indicators C1, B4, IGM-APS, IGM-PN, IGM-VAC, and IGM-ICSAP in `etl_contract.py::build_payload()`; (2) a new `GET /api/populacao` endpoint that powers the `/painel/populacao` frontend route.

**Primary trade-off**: A dedicated structured table (ADR-001) is cleaner to query than the existing EAV `esus_indicadores_raw` but requires a new migration and a new parsing code path. The import route, de-para mapping, and Python subprocess interface remain unchanged.

**Correction to PRD**: Indicators B1-B6 in this system are odontology indicators (1ª consulta odontológica, exodontias, ART, escovação supervisionada, preventivos, tratamento concluído) — their denominators come from production reports, not the cadastro individual. Only C1, B4, IGM-APS, IGM-PN, IGM-VAC, and IGM-ICSAP use cadastro individual denominators.

---

## System Architecture

### Component Overview

```
CSV files (ISO-8859-1)
       │
       ▼
POST /importacao/preview  ──► parse_esus_csv.py --json-preview
       │                         (detects tipo_relatorio = 'cadastro_individual')
       │                         returns {tipo, competencia, esus_unidade, cidadaos_ativos}
       ▼
importMappingService.enrichPreviewItem()
       │
       ▼
POST /importacao/upload ──► importMappingService.resolveForUpload()
       │                        (returns {estabelecimentoId, equipeId})
       │
       ├──► parse_esus_csv.py --pg-write   [tipo != cadastro_individual]
       │       writes esus_cargas + esus_indicadores_raw
       │
       └──► parse_esus_csv.py --pg-write   [tipo == cadastro_individual]
               writes esus_cargas(tipo='cadastro_individual')
               writes populacao_cadastrada (via _write_cadastro_to_pg)
               skips esus_indicadores_raw
       │
       ▼
triggerConsolidation()
       │
       ▼
consolidate_dashboard.py
       ├──► fetch_raw_rows() ─────────────── esus_indicadores_raw
       ├──► fetch_sia_rows() ─────────────── sia_producao
       ├──► fetch_pop_row()  ─────────────── populacao_cadastrada   [NEW]
       └──► build_payload(pop_row=pop_row) ► dados_consolidados
                                              (den values from pop_row)

GET /api/populacao  ──► populacaoService.js ──► populacao_cadastrada
       │
       ▼
/painel/populacao (React)
```

### External System Interactions

None. All data originates from local CSV upload. No IBGE or external API integration.

---

## Implementation Design

### Core Interfaces

**populacao_cadastrada row dict** (Python, returned by `_write_cadastro_to_pg`):

```python
# populacao_cadastrada fields accessible as pop_row in etl_contract.py
pop_row = {
    "cidadaos_ativos": int,           # "Dados gerais" → Cidadãos ativos
    "saidas": int,                     # "Dados gerais" → Saída de cidadãos
    "sexo_masculino": int | None,
    "sexo_feminino": int | None,
    "faixa_etaria": [                  # ordered by CSV appearance
        {"faixa": "Menos de 01 ano", "masculino": int, "feminino": int},
        {"faixa": "01 ano", ...},
        # ... up to "80 anos ou mais"
    ],
    "condicoes_saude": {               # from "Condições / Situações de saúde gerais"
        "gestante":     {"sim": int, "nao": int, "nao_informado": int},
        "hipertensao":  {"sim": int, "nao": int, "nao_informado": int},
        "diabetes":     {"sim": int, "nao": int, "nao_informado": int},
        "fumante":      {"sim": int, "nao": int, "nao_informado": int},
        "acamado":      {"sim": int, "nao": int, "nao_informado": int},
        "avc_derrame":  {"sim": int, "nao": int, "nao_informado": int},
        "cancer":       {"sim": int, "nao": int, "nao_informado": int},
        "saude_mental": {"sim": int, "nao": int, "nao_informado": int},
        "alcool":       {"sim": int, "nao": int, "nao_informado": int},
        # ... all boolean conditions from the section
    },
    "raca_cor": {                      # from "Raça / Cor"
        "branca": int, "preta": int, "amarela": int,
        "parda": int, "indigena": int, "nao_informado": int,
    },
    "sociodemografico": dict,          # summary of sociodemographic sections
    "extras": dict,                    # sections not mapped to structured fields
}
```

**populacaoService.js — getPopulacao()**:

```javascript
// Returns null if no cadastro_individual imported for that period/unit
async function getPopulacao({ competencia, estabelecimentoId }) {
  // competencia: 'YYYY-MM'
  // estabelecimentoId: number | null (null = aggregate all units)
  // Returns: { cidadaos_ativos, saidas, faixa_etaria, condicoes_saude,
  //            raca_cor, sociodemografico, por_unidade: [{...}] } | null
}
async function listPopulacaoCompetencias() {
  // Returns: [{ competencia, unidades_count, total_cidadaos_ativos }]
}
```

### Data Models

#### migration_012_populacao_cadastrada.sql

```sql
-- 1. Add cadastro_individual to esus_cargas CHECK
ALTER TABLE esus_cargas
  DROP CONSTRAINT IF EXISTS esus_cargas_tipo_relatorio_check;

ALTER TABLE esus_cargas
  ADD CONSTRAINT esus_cargas_tipo_relatorio_check
  CHECK (tipo_relatorio IN (
    'atendimento_individual', 'atendimento_domiciliar',
    'atendimento_odontologico', 'atividade_coletiva',
    'marcadores_consumo_alimentar', 'procedimentos_individualizados',
    'cadastro_individual'                                          -- NEW
  ));

-- 2. New table: one snapshot per unit per competência
CREATE TABLE IF NOT EXISTS populacao_cadastrada (
    id                BIGSERIAL PRIMARY KEY,
    carga_id          BIGINT  NOT NULL REFERENCES esus_cargas(id) ON DELETE CASCADE,
    estabelecimento_id BIGINT NOT NULL REFERENCES estabelecimentos(id),
    competencia       DATE    NOT NULL,
    cidadaos_ativos   INT     NOT NULL DEFAULT 0,
    saidas            INT     NOT NULL DEFAULT 0,
    sexo_masculino    INT,
    sexo_feminino     INT,
    faixa_etaria      JSONB   NOT NULL DEFAULT '[]',
    condicoes_saude   JSONB   NOT NULL DEFAULT '{}',
    raca_cor          JSONB   NOT NULL DEFAULT '{}',
    sociodemografico  JSONB   NOT NULL DEFAULT '{}',
    extras            JSONB   NOT NULL DEFAULT '{}',
    importado_em      TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (carga_id),
    UNIQUE (competencia, estabelecimento_id)
);

CREATE INDEX IF NOT EXISTS idx_pop_cad_competencia
    ON populacao_cadastrada (competencia, estabelecimento_id);
CREATE INDEX IF NOT EXISTS idx_pop_cad_condicoes_gin
    ON populacao_cadastrada USING GIN (condicoes_saude);
```

#### API Response Shape — GET /api/populacao

```json
{
  "competencia": "2026-01",
  "total_cidadaos_ativos": 10173,
  "total_saidas": 3607,
  "por_unidade": [
    {
      "estabelecimento_id": 5,
      "estabelecimento_nome": "PSF JD Alvorada",
      "cidadaos_ativos": 3337,
      "saidas": 1198,
      "importado_em": "2026-06-22T14:30:00Z"
    }
  ],
  "faixa_etaria": [
    { "faixa": "Menos de 01 ano", "masculino": 31, "feminino": 26 },
    { "faixa": "01 ano", "masculino": 19, "feminino": 16 }
  ],
  "condicoes_saude": {
    "gestante":    { "sim": 24,  "nao": 284, "nao_informado": 3029 },
    "hipertensao": { "sim": 313, "nao": 603, "nao_informado": 2421 },
    "diabetes":    { "sim": 123, "nao": 762, "nao_informado": 2452 }
  },
  "raca_cor": {
    "branca": 2570, "preta": 92, "amarela": 34,
    "parda": 638,   "indigena": 3, "nao_informado": 0
  }
}
```

### API Endpoints

#### New: GET /api/populacao

```
GET /api/populacao
  Auth: verifyJWT (requirePlanningStaff)
  Query params:
    competencia     string  YYYY-MM  required
    estabelecimento_id  number  optional (omit for aggregate)
  Response 200: PopulacaoResponse (above)
  Response 404: { error: "Sem dados para a competência/unidade selecionada" }

GET /api/populacao/competencias
  Auth: verifyJWT
  Response 200: [{ competencia, unidades_count, total_cidadaos_ativos }]
```

Mount in `simpa-backend/src/routes/api.js`:
```javascript
router.use('/populacao', require('./populacao'));
```

#### Modified: importacao.js — POST /upload

No new endpoint needed. The existing upload handler detects `tipo_relatorio === 'cadastro_individual'` from the parsed preview metadata and the Python subprocess handles the correct table routing internally.

#### Modified: etl_contract.py — build_payload()

```python
def build_payload(
    *,
    competencia: date,
    municipio: str,
    unidade: str,
    equipe: str,
    raw_rows: list[dict],
    sia_rows: list[dict] | None = None,
    mysql_available: bool = False,
    pop_row: dict | None = None,     # NEW: from populacao_cadastrada
) -> dict:
```

---

## Implementation Design — Component Details

### parse_esus_csv.py Changes

1. **TIPO_RELATORIO_MAP**: add `"Relatório de cadastro individual - Analítico": "cadastro_individual"`.

2. **HEADER_PREFIXES**: add `"Relatório de cadastro individual"` so the section detector skips report-title repetitions within the file.

3. **Section-to-field mapping** — new constant `CADASTRO_SECTION_MAP`:

```python
CADASTRO_SECTION_MAP = {
    "dados gerais": "dados_gerais",
    "identificacao do usuario / cidadao - faixa etaria": "faixa_etaria",
    "identificacao do usuario / cidadao - sexo": "sexo",
    "identificacao do usuario / cidadao - raca / cor": "raca_cor",
    "condicoes / situacoes de saude gerais": "condicoes_saude",
    "informacoes sociodemograficas - situacao no mercado de trabalho": "mercado_trabalho",
    "informacoes sociodemograficas - qual e o curso": "escolaridade",
    "informacoes sociodemograficas - deficiencia": "deficiencia",
}
# Keys are normalize_key() of the CSV section header
```

4. **`write_to_pg()`**: branch at the start — if `meta["tipo_relatorio"] == "cadastro_individual"`, call `_write_cadastro_to_pg(meta, sections, conn, estabelecimento_id)` and return early (skip `esus_indicadores_raw` writes).

5. **`_write_cadastro_to_pg(meta, sections, conn, estabelecimento_id)`**: 
   - INSERT into `esus_cargas` (same as existing flow) → get `carga_id`
   - Map sections to structured fields using `CADASTRO_SECTION_MAP`
   - Build `populacao_cadastrada` row dict
   - INSERT with `ON CONFLICT (competencia, estabelecimento_id) DO UPDATE` (replace all JSONB fields)
   - Note: since re-import uses DELETE+INSERT on `esus_cargas` (cascade), the UNIQUE (carga_id) constraint is clean; the ON CONFLICT on `(competencia, estabelecimento_id)` handles the upsert case if called without prior delete.

6. **Preview mode** (`--json-preview`): For `cadastro_individual`, include `cidadaos_ativos` in the returned metadata by scanning the "Dados gerais" section during preview (no DB write).

### consolidate_dashboard.py Changes

In `consolidate_group()`, after `fetch_raw_rows()` and `fetch_sia_rows()`, add:

```python
def fetch_pop_row(conn, competencia: date, estabelecimento_id: int | None) -> dict | None:
    if estabelecimento_id is None:
        return None
    cur = conn.cursor()
    cur.execute(
        "SELECT cidadaos_ativos, saidas, faixa_etaria, condicoes_saude, raca_cor "
        "FROM populacao_cadastrada WHERE competencia = %s AND estabelecimento_id = %s",
        (competencia, estabelecimento_id),
    )
    row = cur.fetchone()
    return dict(row) if row else None
```

Pass `pop_row=fetch_pop_row(conn, competencia, estabelecimento_id)` to `build_payload()`.

### etl_contract.py Changes

Modify `_build_indicadores_qualidade(pop_row=None)`:

```python
def _denominadores(pop_row: dict | None) -> dict[str, int | str]:
    if pop_row is None:
        return {}
    ativos = pop_row.get("cidadaos_ativos") or 0
    gest  = (pop_row.get("condicoes_saude") or {}).get("gestante", {}).get("sim")
    faixas = pop_row.get("faixa_etaria") or []

    def _sum_faixas(*nomes):
        total = 0
        for f in faixas:
            if f["faixa"] in nomes:
                total += (f.get("masculino") or 0) + (f.get("feminino") or 0)
        return total or None

    menos1 = _sum_faixas("Menos de 01 ano")
    menos2 = _sum_faixas("Menos de 01 ano", "01 ano")
    f5a14  = _sum_faixas("05 a 09 anos", "10 a 14 anos")  # B4 approx

    return {
        "C1":       ativos,
        "B4":       f5a14,       # approximate 6-12 (limitation documented)
        "IGM-APS":  ativos,
        "IGM-PN":   gest,
        "IGM-VAC":  menos1,
        "IGM-ICSAP": ativos,
    }
```

Each matching indicator entry gets `"den": dens.get(cod, "—")`.

**B4 denominator limitation**: The CSV uses 5-year age bands; "05 a 09 anos" + "10 a 14 anos" over-counts the 6–12 range. This is documented in the indicator's `den_nota` field (new optional field in catalog entry, shown as tooltip in UI).

### populacaoService.js

New file at `simpa-backend/src/services/populacaoService.js`:

```javascript
const { query } = require('./db');

async function getPopulacao({ competencia, estabelecimentoId }) {
  const where = estabelecimentoId
    ? 'WHERE p.competencia = $1 AND p.estabelecimento_id = $2'
    : 'WHERE p.competencia = $1';
  const params = estabelecimentoId ? [competencia, estabelecimentoId] : [competencia];
  const { rows } = await query(
    `SELECT p.*, e.nome AS estabelecimento_nome
     FROM populacao_cadastrada p
     JOIN estabelecimentos e ON e.id = p.estabelecimento_id
     ${where} ORDER BY e.nome`,
    params,
  );
  if (!rows.length) return null;
  return _aggregate(rows);
}
```

`_aggregate(rows)` sums `cidadaos_ativos`/`saidas`, merges `faixa_etaria` arrays, merges `condicoes_saude` sim/nao/nao_informado counts, builds `por_unidade` array.

### Frontend Changes

**New route in `App.tsx`**:
```typescript
<Route path="/painel/populacao" element={
  <RequireAuth><PopulacaoPage /></RequireAuth>
} />
```

**New navigation link** in `navigation.ts` — add sub-item under Painel or a link from the Painel page header:
```typescript
{ to: '/painel/populacao', label: 'População Cadastrada', icon: 'populacao' }
```

**`simpa-frontend/src/api/populacao.ts`**:
```typescript
export async function fetchPopulacao(
  competencia: string,
  estabelecimentoId?: number,
): Promise<PopulacaoResponse | null>

export async function fetchPopulacaoCompetencias(): Promise<CompetenciaEntry[]>
```

**`simpa-frontend/src/pages/Painel/PopulacaoPage.tsx`**:
- Filter bar: competência selector + estabelecimento multi-select
- Summary cards: cidadãos ativos, saídas, N unidades importadas
- Demographic pyramid (ECharts bar — horizontal, masculino left / feminino right)
- Conditions chart (ECharts horizontal bar — % de cidadãos ativos com cada condição)
- Per-unit table (collapsible)
- Empty state: link to `/importacao` when no data

**`simpa-frontend/src/types/populacao.ts`** — TypeScript types mirroring the API response shape.

### Import Flow — Multi-file Batch

The existing `UploadZone` component already calls `POST /importacao/preview` with `upload.array('files')`. The UI renders one preview card per file. No changes needed to support multiple cadastro_individual files in a single upload session — the existing multi-file handling works. The `ImportacaoPage` just needs to handle the new `tipo_relatorio = 'cadastro_individual'` in preview card rendering (show cidadaos_ativos as a badge).

---

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|-----------|-------------|---------------------|-----------------|
| `schema_full.sql` | modified | Reference schema — not executed at runtime; keep in sync with migration | Update CHECK constraint and add populacao_cadastrada |
| `migration_012_populacao_cadastrada.sql` | new | New migration file run on Docker init | Create and add to docker-compose.yml init sequence |
| `parse_esus_csv.py` | modified | New type + new write function; existing 6 types unaffected if branch is clean | Add type to map, add `_write_cadastro_to_pg()`, branch in `write_to_pg()` |
| `etl_contract.py` | modified | New optional `pop_row` param; existing calls without param still work (default None) | Add `_denominadores()` helper, modify `_build_indicadores_qualidade()`, update `build_payload()` signature |
| `consolidate_dashboard.py` | modified | New `fetch_pop_row()` call in `consolidate_group()`; no change to other paths | Add helper, pass pop_row to build_payload() |
| `simpa-backend/src/routes/importacao.js` | modified (minor) | Preview response includes `cidadaos_ativos` for cadastro_individual type | Add `cidadaos_ativos` field passthrough from preview metadata |
| `simpa-backend/src/routes/api.js` | modified | Mount new `/populacao` sub-router | One-line addition |
| `simpa-backend/src/services/populacaoService.js` | new | New service file | Implement |
| `simpa-backend/src/routes/populacao.js` | new | New route file | Implement |
| `simpa-frontend/src/App.tsx` | modified | New route `/painel/populacao` | Add Route entry |
| `simpa-frontend/src/config/navigation.ts` | modified | New nav item or sub-item | Add entry |
| `simpa-frontend/src/api/populacao.ts` | new | New API client | Implement |
| `simpa-frontend/src/types/populacao.ts` | new | New TypeScript types | Implement |
| `simpa-frontend/src/pages/Painel/PopulacaoPage.tsx` | new | New population dashboard page | Implement |
| `docker-compose.yml` | modified | Add migration_012 to init SQL list | Add file reference |

---

## Integration Points

No external integrations. All data sources are internal: e-SUS CSV files (uploaded by user), PostgreSQL (existing), and the Python ETL scripts (existing subprocess pattern).

---

## Testing Approach

### Unit Tests

- **`parse_esus_csv.py` — `_write_cadastro_to_pg()`**: test with sample CSV (the three files in `C:\Planejamento\...`). Assert `cidadaos_ativos` = 3337 for PSF JD Alvorada. Assert `faixa_etaria` array length = 21 bands. Assert `condicoes_saude.gestante.sim` = 24.
- **`etl_contract.py` — `_denominadores()`**: unit test with a mock `pop_row` dict. Assert C1 den = `cidadaos_ativos`. Assert IGM-PN den = `condicoes_saude.gestante.sim`. Assert IGM-VAC den = sum of "Menos de 01 ano" band. Assert pop_row=None returns empty dict (all denominators stay `"—"`).
- **`populacaoService.js`**: mock `query()`. Test `_aggregate()` correctly sums `cidadaos_ativos` across two units. Test `getPopulacao()` returns null when no rows.

### Integration Tests

- **Import flow**: POST /importacao/preview with a real cadastro_individual CSV → assert `tipo_relatorio: 'cadastro_individual'` and `cidadaos_ativos > 0` in preview response. POST /upload with resolved mapping → assert `populacao_cadastrada` row exists in DB with correct `cidadaos_ativos`.
- **Re-import upsert**: import same unit twice → assert `populacao_cadastrada` has exactly one row for (competencia, estabelecimento_id) after second import.
- **GET /api/populacao**: after import, assert response includes correct `total_cidadaos_ativos`, `faixa_etaria` array, and `condicoes_saude`.
- **Consolidation with pop_row**: after import + consolidation, assert `dados_consolidados.dados_conteudo.indicadores_qualidade` contains `den != "—"` for C1 and IGM-APS.

**Test data**: use the three real CSVs at `C:\Planejamento\relatórios pec esus - janeiro2026\` as fixtures (copy to `simpa-backend/tests/fixtures/`).

---

## Development Sequencing

### Build Order

1. **`migration_012_populacao_cadastrada.sql`** — no dependencies. Defines the table and the updated CHECK constraint. Also update `schema_full.sql` to match.
2. **`parse_esus_csv.py` — cadastro_individual type** — depends on step 1 (table must exist to write). Add `TIPO_RELATORIO_MAP` entry, `CADASTRO_SECTION_MAP`, `_write_cadastro_to_pg()`, and branch in `write_to_pg()`. Include preview-mode `cidadaos_ativos` extraction.
3. **Unit tests for parser** — depends on step 2. Validate CSV → structured dict mapping for all three fixture files.
4. **`etl_contract.py` — pop_row integration** — depends on step 1 (data shape). Add `_denominadores()`, update `_build_indicadores_qualidade(pop_row)`, update `build_payload(pop_row=None)`. All existing callers pass no `pop_row` and continue to work.
5. **`consolidate_dashboard.py` — fetch_pop_row** — depends on steps 1 and 4. Add `fetch_pop_row()`, wire into `consolidate_group()`.
6. **Unit tests for etl_contract + integration test for consolidation** — depends on steps 4 and 5.
7. **`populacaoService.js` + `routes/populacao.js`** — depends on step 1. New backend service and route. Mount in `api.js`.
8. **Integration tests for GET /api/populacao** — depends on steps 2 and 7.
9. **`simpa-frontend/src/types/populacao.ts`** — depends on step 7 (API shape finalized). TypeScript interface definitions.
10. **`simpa-frontend/src/api/populacao.ts`** — depends on step 9.
11. **`simpa-frontend/src/pages/Painel/PopulacaoPage.tsx`** — depends on steps 9 and 10. Build with ECharts pyramid + conditions chart.
12. **`simpa-frontend/src/App.tsx` + `navigation.ts`** — depends on step 11. Wire route and nav.
13. **`simpa-frontend/src/pages/Importacao/` — preview card update** — depends on step 2 (cidadaos_ativos in preview). Show cidadaos_ativos badge for cadastro_individual cards.
14. **`docker-compose.yml`** — add `migration_012` to init sequence. Depends on step 1.
15. **End-to-end test**: import 3 CSVs → view population panel → verify denominators in indicators.

### Technical Dependencies

- PostgreSQL 15 running (existing). Migration 012 must apply cleanly on top of migration 011.
- Python 3 with psycopg2 (existing). No new Python dependencies.
- The three e-SUS cadastro individual CSV files must be available as test fixtures.

---

## Monitoring and Observability

- **Log event** on cadastro_individual import: `{ event: 'cadastro_individual.imported', estabelecimento_id, competencia, cidadaos_ativos, saidas }` — same structured log pattern as existing import events.
- **Log event** on denominator injection: `{ event: 'denominadores.calculados', competencia, estabelecimento_id, indicadores_com_den: ['C1', 'IGM-APS', ...] }` from `consolidate_dashboard.py`.
- **API**: `GET /api/populacao` logs 404 as info (expected when data not yet imported); 500 as error.

---

## Technical Considerations

### Known Risks

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| B4 denominator (crianças 6-12 anos) uses approximate bands (05-09 + 10-14) | Certain | Document `den_nota: "Aproximado: faixas 05-09 + 10-14 anos"` in indicator entry; display as tooltip in UI |
| e-SUS PEC changes CSV section headers in future version | Low | `CADASTRO_SECTION_MAP` uses `normalize_key()` stripped keys; unknown sections go to `extras` JSONB; missing sections leave fields as default (0 or `{}`) |
| Large municipalities: 25 CSVs × 300 KB each = 7.5 MB batch | Low for Americana | `upload.array('files')` with multer limit; existing 10 MB limit is sufficient |
| `uq_esus_cargas_ids` unique index: cadastro_individual with equipe_id = TODAS-{id} conflicts if unit already has another type with same equipe_id | Very low | TODAS equipes are created per type; the unique index includes `tipo_relatorio`, so no collision |
| `fetch_pop_row` returns None for units without cadastro_individual → indicators keep `"—"` | Certain (expected) | Correct behavior; no mitigation needed; indicators for unimported units show `"—"` |

---

## Architecture Decision Records

- [ADR-001: Dedicated Population Table for Cadastro Individual Data](adrs/adr-001.md) — Store population data in structured `populacao_cadastrada` table rather than generic EAV, enabling simple denominator queries and visualization.
- [ADR-002: Dedicated GET /api/populacao Endpoint](adrs/adr-002.md) — New independent endpoint for population data rather than extending the dashboard payload, enabling `/painel/populacao` to load without consolidation dependency.
- [ADR-003: Denominator Integration via pop_row Parameter in build_payload()](adrs/adr-003.md) — Pass population data as an optional parameter to keep `etl_contract.py` I/O-free and enable single-pass denominator computation.
