# TechSpec: e-SUS ↔ SIGTAP Procedure Mapping (De-Para)

## Executive Summary

Implement a dual-table master-data model (`procedimentos` + `esus_procedimento_map`) following existing Cadastros soft-delete patterns, seeded by versioned SQL. Consumers resolve production via **exact** `(secao, descricao_esus)` join to `esus_indicadores_raw`, silently skipping gaps. MVP surfaces: Cadastros CRUD UI, consolidator enrichment in `dados_consolidados`, and on-demand JSON + CSV export.

**Primary trade-off:** two tables and two consumption paths (consolidado + API) increase surface area versus a flat de-para, in exchange for reuse of SIGTAP master data and parity with the planned `procedimentos` catalog.

## System Architecture

### Component Overview

| Component | Responsibility |
|-----------|----------------|
| PostgreSQL `procedimentos` | SIGTAP master (code, description, type, reference table, status) |
| PostgreSQL `esus_procedimento_map` | e-SUS `(secao, descricao)` → `procedimento_id`, origem, status |
| `seed_esus_sigtap_depara.sql` | Initial master + map rows from municipal bases + native SIGTAP sections |
| `cadastros` API + Frontend Cadastros page | CRUD for maps (and procedure fields as needed) |
| `consolidate_dashboard.py` | Emit `procedimentos_mapeados` in APS module |
| Export API | On-demand mapped rows as JSON or CSV |
| `docs/esus-sigtap-depara.md` + in-app help | Operator/implementer how-to |

```text
esus_indicadores_raw ──exact(secao,descricao)──► esus_procedimento_map ──► procedimentos
         │                                              │
         │                                              ├── consolidate_dashboard.py → dados_consolidados
         │                                              └── GET export → JSON | CSV
         └── Cadastros CRUD maintains map + procedimentos
```

## Implementation Design

### Core Interfaces

Canonical lookup contract (shared by consolidator and export):

```go
// MappingLookup is the shared consumer contract.
type MappingLookup struct {
    Secao          string // exact e-SUS section
    DescricaoEsus  string // exact esus_indicadores_raw.descricao
    CodigoSigtap   string // procedimentos.codigo_sigtap
    DescricaoSigtap string
    Quantidade     int
}

// ResolveMappedProcedures joins active maps to raw indicators.
// Unmapped labels are omitted (silent skip).
type ProcedureMappingService interface {
    ResolveMappedProcedures(competencia, unidade, equipe string) ([]MappingLookup, error)
}
```

Node Cadastros follows existing `{error}` / `RETURNING *` conventions. Soft-delete: `UPDATE … SET status='inativo'`.

### Data Models

**`procedimentos`**
- `id` BIGSERIAL PK  
- `codigo_sigtap` VARCHAR(20) NOT NULL UNIQUE  
- `descricao` TEXT NOT NULL  
- `tipo` VARCHAR(40) NULL  -- e.g. ambulatorial  
- `tabela_referencia` VARCHAR(40) NOT NULL DEFAULT 'SIGTAP'  
- `status` VARCHAR(20) NOT NULL DEFAULT 'ativo'  
- `created_at` / `updated_at` timestamptz  

**`esus_procedimento_map`**
- `id` BIGSERIAL PK  
- `secao` TEXT NOT NULL  
- `descricao_esus` TEXT NOT NULL  
- `procedimento_id` BIGINT NOT NULL REFERENCES `procedimentos(id)`  
- `origem` VARCHAR(20) NOT NULL  -- `seed` | `nativo_sigtap` | `manual`  
- `status` VARCHAR(20) NOT NULL DEFAULT 'ativo'  
- UNIQUE `(secao, descricao_esus)`  
- Index `(status)` for list filters  

**API list row (joined):** `{ id, secao, descricao_esus, codigo_sigtap, descricao_sigtap, origem, status, procedimento_id }`

**Consolidado addition (APS):**  
`procedimentos_mapeados: MappingLookup[]` (field names in Portuguese JSON as above snake_case).

**CSV columns:** `competencia,unidade,equipe,secao,descricao_esus,codigo_sigtap,descricao_sigtap,quantidade`

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cadastros/procedimentos` | List `procedimentos` (`status != inativo` default; `?status=`) |
| POST | `/api/cadastros/procedimentos` | Create master `{codigo_sigtap, descricao, tipo?, tabela_referencia?}` |
| PUT | `/api/cadastros/procedimentos/:id` | Update master |
| DELETE | `/api/cadastros/procedimentos/:id` | Soft-inactivate |
| GET | `/api/cadastros/esus-procedimento-map` | List maps joined to SIGTAP; filters `secao`, `q`, `status` |
| POST | `/api/cadastros/esus-procedimento-map` | Create map `{secao, descricao_esus, procedimento_id\|codigo_sigtap, origem?}` |
| PUT | `/api/cadastros/esus-procedimento-map/:id` | Update map / linked code |
| DELETE | `/api/cadastros/esus-procedimento-map/:id` | Soft-inactivate map |
| GET | `/api/procedimentos/export` | Query: `competencia` (req), `unidade`, `equipe`, `format=json\|csv` |

Validation: 400 if required fields missing; 404 if id not found; unique violations → 409 with clear message (improve vs current cadastros 500).

## Integration Points

- **e-SUS raw:** read-only join to `esus_indicadores_raw` + `esus_cargas` for filters.  
- **SIA:** analytics may later compare `codigo_sigtap` to `sia_producao` (same code space); MVP lists mapped APS quantities; optional side-by-side not required beyond new array.  
- **Auth:** none beyond current open Cadastros (per PRD).

## Impact Analysis

| Component | Impact Type | Description and Risk | Required Action |
|-----------|-------------|---------------------|-----------------|
| `schema_full.sql` | modified | New tables | Add DDL |
| `seed_esus_sigtap_depara.sql` | new | Seed curation risk (check digits) | Curate codes; document |
| `cadastros.js` | modified | New routes | Extend router |
| Cadastros frontend | modified/new | New page + nav | Mirror Unidades UX + help |
| `contrato.ts` / Painel | modified | New APS array | Types + optional table UI |
| `consolidate_dashboard.py` | modified | Lookup + emit array | Shared SQL/query |
| Export route | new | JSON/CSV | Implement |
| `docs/esus-sigtap-depara.md` | new | How-to | Write |
| `versao_schema` | modified | Document bump if contract changes | e.g. 3.2.0 |

## Testing Approach

### Unit Tests
- Map upsert validation (required fields, unique secao+label).  
- Lookup omits inactive maps and unmapped labels.  
- CSV serializer column order/escaping.

### Integration Tests
- Seed SQL applies cleanly on empty PG.  
- POST map → GET export includes quantity from fixture `esus_indicadores_raw`.  
- Soft-delete map → excluded from export and consolidator output.  
- Consolidator `--pg-write` persists `procedimentos_mapeados`.

## Development Sequencing

### Build Order

1. **DDL** `procedimentos` + `esus_procedimento_map` in schema — no dependencies.  
2. **Seed SQL** curated from municipal bases + native SIGTAP section templates — depends on step 1.  
3. **Cadastros API** CRUD for both tables — depends on step 1.  
4. **Shared resolve query/service** used by export + consolidator — depends on steps 1–2.  
5. **Export endpoint** JSON/CSV — depends on step 4.  
6. **Consolidator enrichment** + contract version bump — depends on step 4.  
7. **Frontend Cadastros page** + in-app help — depends on step 3.  
8. **Frontend export download** + optional Painel table — depends on steps 5–6.  
9. **Repository docs** `docs/esus-sigtap-depara.md` — depends on steps 4–5 (documents final contract).

### Technical Dependencies

- PostgreSQL 15+ available.  
- Municipal bases curated to 10-digit SIGTAP codes before seed sign-off.  
- Existing e-SUS loads present for export/consolidator verification.

## Monitoring and Observability

- Log export requests: competencia, unidade, equipe, row_count, format.  
- Log consolidator: mapped_count vs candidate procedure rows (optional debug).  
- No new alerts in MVP; rely on API errorHandler.

## Technical Considerations

### Key Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Dual tables | Aligns with planned master + exact e-SUS keys | More CRUD complexity |
| Exact `(secao, descricao)` | Deterministic join to raw | Seed must use real e-SUS sections |
| JSON + CSV export | Operator usability without BPA scope | Not submission-ready |
| SQL seed file | Simple, reviewable, versioned | No UI re-import in MVP |
| Silent skip | Per PRD | Coverage gaps invisible until Phase 2 |

### Known Risks

- Truncated codes in source images → wrong seed — mitigate with official SIGTAP check + CRUD.  
- Duplicated resolve logic Node vs Python — mitigate with one SQL function/view or Python-only resolve called from both paths where practical.  
- Contract bump may break old mock clients — update `mock/db.json` and types together.

## Architecture Decision Records

- [ADR-001: Catalog-first unified de-para with dual consumption](adrs/adr-001.md) — Product approach: unified catalog, export + analytics, silent skip.  
- [ADR-002: Dual-table persistence — procedimentos + e-SUS link](adrs/adr-002.md) — `procedimentos` + `esus_procedimento_map`; SQL seed.  
- [ADR-003: Exact (secao, descricao) lookup with real e-SUS sections](adrs/adr-003.md) — Real section names; exact match.  
- [ADR-004: Dual consumption — consolidado + on-demand JSON/CSV export](adrs/adr-004.md) — Consolidator array + export API JSON/CSV.
