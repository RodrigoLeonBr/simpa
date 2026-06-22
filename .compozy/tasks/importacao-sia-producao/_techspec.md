# TechSpec — Importação SIA Produção

**Feature:** `importacao-sia-producao`  
**Version:** 1.1  
**Date:** 2026-06-21  
**Status:** Accepted  
**PRD:** [_prd.md](./_prd.md)

---

## Executive Summary

Endurecer o pipeline existente `sync_sia_mysql.py` → `sia_producao` → `consolidate_dashboard.py` → Painel. Extração MySQL: **filtro `prd_cmp` por ano/mês escolhido**, **GROUP BY gerencial** (descarta folha/seq/flags), CAST/COLLATE, batch insert, UI seletor mês, FK `estabelecimento_id`.

**Trade-off:** Agregação no ETL (ADR-001 + ADR-002) — volume PG mínimo vs fidelidade linha-a-linha.

---

## System Architecture

```
MySQL (producao)
  s_prd + prestador + procedimento + cbo + s_rub
        │
        ▼ sync_sia_mysql.py (--competencia YYYY-MM --pg-write)
PostgreSQL
  sia_sincronizacoes ──► sia_producao (+ cnes, estabelecimento_id)
        │
        ▼ POST /api/sia/sincronizar → consolidator.runConsolidation
  dados_consolidados.modulos.ambulatorial_sia
        │
        ▼ GET /planejamento
  Painel (badge SIA + procedimentos_especializados)
```

**Frontend:** `SiaProducaoSyncBanner` em Cadastros (abaixo ou ao lado de `CadastroSyncBanner`).

---

## Implementation Design

### Migration `migration_010_sia_producao_cnes.sql`

```sql
ALTER TABLE sia_producao
  ADD COLUMN IF NOT EXISTS cnes VARCHAR(7),
  ADD COLUMN IF NOT EXISTS estabelecimento_id INT REFERENCES estabelecimentos(id),
  ADD COLUMN IF NOT EXISTS quantidade_apresentada INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_apresentado NUMERIC(15,2);

CREATE INDEX IF NOT EXISTS idx_sia_producao_estab
  ON sia_producao (competencia, estabelecimento_id);

-- Atualizar UNIQUE para incluir cnes quando unidade NULL
-- Estratégia: UNIQUE (sincronizacao_id, cnes, codigo_sigtap, faixa_etaria, sexo, cbo)
-- Drop constraint antiga se existir; recriar via migration idempotente.
```

Registrar em `docker-compose.yml` init chain após `migration_009`.

### Seleção de campos e grão (ADR-002)

**Nunca SELECT** de: `prd_flh`, `prd_seq`, `PRD_ORG`, `PRD_FLPA`–`PRD_FLER`, `PRD_APANUM`, `PRD_CNSMED`, `PRD_CNPJ`, `PRD_NFIS`, `PRD_CIDSEC`, `PRD_CIDCAS`.

**Grão GROUP BY:**

```
cnes, unidade, codigo_sigtap, descricao, faixa_etaria, sexo, cbo, rubrica_codigo
```

**Métricas:** `SUM(CAST(PRD_QT_P/A))`, `SUM(CAST(PRD_VL_P/A))`.

**Competência:** parâmetro `YYYY-MM` → `WHERE prd_cmp = 'YYYYMM'` (obrigatório).

### Query MySQL (build_sia_query)

```sql
SELECT
    prd.prd_uid AS cnes,
    p.re_cnome AS unidade,
    prd.prd_pa AS codigo_sigtap,
    proc.procedimento AS descricao,
    prd.prd_cbo AS cbo,
    LEFT(prd.PRD_RUB, 4) AS rubrica_codigo,
    sr.RUB_DC AS rubrica_descricao,
    -- idade bruta agrupada; faixa_etaria calculada no Python transformar()
    prd.PRD_IDADE AS idade,
    SUM(CAST(prd.PRD_QT_A AS UNSIGNED)) AS quantidade,
    SUM(CAST(prd.PRD_QT_P AS UNSIGNED)) AS quantidade_apresentada,
    SUM(CAST(prd.PRD_VL_A AS DECIMAL(15,2))) AS valor_aprovado,
    SUM(CAST(prd.PRD_VL_P AS DECIMAL(15,2))) AS valor_apresentado
FROM s_prd prd
LEFT JOIN prestador p ON ... COLLATE ...
LEFT JOIN procedimento proc ON ... COLLATE ...
LEFT JOIN cbo cb ON ... COLLATE ...
LEFT JOIN s_rub sr ON LEFT(prd.PRD_RUB,4) ... COLLATE ...
WHERE prd.prd_cmp = %(comp)s
GROUP BY
    cnes, unidade, codigo_sigtap, descricao, cbo, rubrica_codigo, rubrica_descricao,
    idade  -- transformar() → faixa_etaria antes de gravar
```

**Resultado sync JSON** deve incluir `linhas_mysql_raw` (opcional, COUNT subquery) vs `registros` (linhas agregadas gravadas) para transparência de redução.

Manter override via env `SIA_*` existentes.

### gravar_pg — batch + FK

1. Carregar mapa `codigo_externo → id` de `estabelecimentos` uma vez.
2. `psycopg2.extras.execute_batch` ou `copy_expert` chunks de 1000.
3. `dados_extras` JSON: `{ "rubrica_codigo": "0602", "rubrica_descricao": "..." }` quando disponível.
4. Retorno JSON estendido: `{ ..., "orphan_cnes": 12, "estabelecimentos_resolvidos": 45 }`.

### API (`routes/sia.js`)

| Método | Path | Auth | Notas |
|--------|------|------|-------|
| GET | `/api/sia/sincronizacoes/existe` | JWT | query `competencia=YYYY-MM` → `{ exists, status, sincronizado_em, registros }` |
| POST | `/api/sia/sincronizar` | JWT + `requirePlanningStaff` | body `{ competencia, reimportar?: boolean }` |
| GET | `/api/sia/sincronizacoes` | JWT | histórico |
| GET | `/api/sia/producao` | JWT | filtros + `estabelecimento_id` opcional |

**409 Conflict** quando competência já importada e `reimportar !== true`:

```json
{
  "code": "SIA_COMPETENCIA_JA_IMPORTADA",
  "competencia": "2025-01",
  "sincronizado_em": "2026-06-20T14:30:00Z",
  "registros": 8420
}
```

**Reimport (`reimportar: true`):** Python `gravar_pg` executa `DELETE FROM sia_producao WHERE competencia = %s` antes do INSERT agregado.

### Cadastros referência (`sync_cadastros_mysql.py` + ADR-004)

| MySQL | PostgreSQL | Reimport |
|-------|------------|----------|
| `forma` | `formas_sia` | UPSERT ✅ existente |
| `cbo` | `cbos_sia` | UPSERT ✅ existente |
| `procedimento` | `procedimentos` | UPSERT ✅ existente |
| `s_rub` | `rubricas_sia` | UPSERT 🆕 task_08 |

`POST /api/cadastros/sincronizar` — sem gate por competência; sempre snapshot completo idempotente.

### Frontend

- `api/sia.ts`: `sincronizarSiaProducao`, `fetchSiaSincronizacoes`, `fetchUltimaSiaSync`
- `SiaProducaoSyncBanner.tsx`: **seletor ano/mês** (`<input type="month">`), default mês anterior; botão importar; histórico
- `SiaProducaoSyncBanner.tsx`: on 409 → `ConfirmDialog` → retry with `reimportar: true`
- Hint se cadastros desatualizados: link para `CadastroSyncBanner` action
- Types em `types/sia.ts`

### consolidate_dashboard.py

Atualizar `fetch_sia_rows`:

```sql
WHERE competencia = %s
  AND (estabelecimento_id = %s OR (estabelecimento_id IS NULL AND unidade = %s))
```

Passar `estabelecimento_id` quando dashboard request usar ID.

---

## Testing Approach

| Camada | Arquivo | Foco |
|--------|---------|------|
| pytest | `tests/test_sync_sia_mysql.py` | query CAST/COLLATE, transform, batch mock |
| pytest | `tests/test_migration_010.py` | colunas novas |
| Jest | `simpa-backend/tests/sia.test.js` | spawn mock |
| Jest | `simpa-backend/tests/sia.routes.test.js` | auth planning staff |
| Vitest | `SiaProducaoSyncBanner.test.tsx` | UI estados |
| Integration | `sia.integration.test.js` | producao com estabelecimento_id |

---

## Impact Analysis

| Component | Impact | Risk |
|-----------|--------|------|
| `sync_sia_mysql.py` | Major rewrite query + gravar | Medium |
| `migration_010` | Schema | Low |
| `consolidate_dashboard.py` | fetch by estabelecimento_id | Medium |
| `siaProducaoService.js` | Filtro estabelecimento_id | Low |
| `Cadastros` UI | Novo banner | Low |
| `docker-compose.yml` | Nova migration | Low |

---

## Verification Gates

```powershell
npm run test:py
npm test --prefix simpa-backend
npm test --prefix simpa-frontend
npm run build --prefix simpa-frontend
```

Manual: sync competência com MySQL local → Painel MAC badge verde.

---

## Related ADRs

- [ADR-001](adrs/adr-001.md) — agregação no ETL
- [ADR-002](adrs/adr-002.md) — campos excluídos e grão gerencial
- [ADR-003](adrs/adr-003.md) — gate reimportação
- [ADR-004](adrs/adr-004.md) — rubricas_sia
