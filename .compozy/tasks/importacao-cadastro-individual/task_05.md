---
status: completed
title: "Backend API: populacaoService + GET /api/populacao"
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 05: Backend API: populacaoService + GET /api/populacao

## Overview

Creates `populacaoService.js` with `getPopulacao()` and `listPopulacaoCompetencias()` functions, and a new Express router `routes/populacao.js` exposing `GET /api/populacao` and `GET /api/populacao/competencias`. Mounts the new router in `routes/api.js`. These endpoints power the `/painel/populacao` frontend page (task_07) and are the sole read path for population data.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC "API Endpoints" and "Implementation Design — populacaoService.js" sections for function signatures and response shape
- FOCUS ON "WHAT" — the endpoints must return the exact JSON shape defined in TechSpec
- MINIMIZE CODE — follow the same thin-router → service → db.js pattern used in other routes
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST create `simpa-backend/src/services/populacaoService.js` with functions `getPopulacao({ competencia, estabelecimentoId })` and `listPopulacaoCompetencias()`.
2. `getPopulacao()` MUST return `null` when no rows found for the given competencia/estabelecimentoId.
3. `getPopulacao()` without `estabelecimentoId` MUST aggregate across all units: sum `cidadaos_ativos` and `saidas`, merge `faixa_etaria` arrays (sum matching bands), merge `condicoes_saude` sim/nao/nao_informado counts, build `por_unidade` array with one entry per unit.
4. `getPopulacao()` with `estabelecimentoId` MUST return data for that unit only, with `por_unidade` containing exactly one entry.
5. `listPopulacaoCompetencias()` MUST return `[{ competencia, unidades_count, total_cidadaos_ativos }]` sorted descending by competencia.
6. MUST create `simpa-backend/src/routes/populacao.js` with `GET /` and `GET /competencias` routes protected by `verifyJWT` middleware.
7. MUST mount the router in `simpa-backend/src/routes/api.js` as `router.use('/populacao', require('./populacao'))`.
8. `GET /api/populacao` MUST accept query params `competencia` (YYYY-MM, required) and `estabelecimento_id` (optional integer).
9. `GET /api/populacao` MUST return HTTP 404 with `{ error: "Sem dados para a competência/unidade selecionada" }` when `getPopulacao()` returns null.
10. MUST use `db.js` `query()` function — no direct psycopg2 or raw pool access.
11. Response shape MUST match TechSpec "API Response Shape — GET /api/populacao" exactly (cidadaos_ativos, saidas, por_unidade, faixa_etaria, condicoes_saude, raca_cor keys).
</requirements>

## Subtasks

- [x] 5.1 Create `populacaoService.js` with `getPopulacao()` including `_aggregate()` helper and `listPopulacaoCompetencias()`.
- [x] 5.2 Create `routes/populacao.js` with `GET /` and `GET /competencias` handlers.
- [x] 5.3 Mount `/populacao` in `routes/api.js`.
- [x] 5.4 Write unit tests for `populacaoService.js` with mocked `query()`.
- [x] 5.5 Write integration tests using supertest for both endpoints.

## Implementation Details

See TechSpec "Implementation Design — populacaoService.js" for `getPopulacao()` SQL query and `_aggregate()` logic. Follow the existing thin-router pattern: `routes/populacao.js` calls `populacaoService.getPopulacao()` and sends the result; all SQL lives in the service.

`_aggregate(rows)` merges an array of per-unit `populacao_cadastrada` rows:
- Sum `cidadaos_ativos` and `saidas` across all rows.
- For `faixa_etaria`: group by `faixa` name, sum `masculino` + `feminino` + `indeterminado` across units.
- For `condicoes_saude`: for each condition key, sum `sim`, `nao`, `nao_informado` across units.
- Build `por_unidade`: array of `{ estabelecimento_id, estabelecimento_nome, cidadaos_ativos, saidas, importado_em }`.

Reference `dashboardService.js` and `painelWidgetsService.js` for SQL query style and error handling patterns.

### Relevant Files

- `simpa-backend/src/services/db.js` — `query()` function to use
- `simpa-backend/src/routes/api.js` — add `router.use('/populacao', ...)` mount
- `simpa-backend/src/services/dashboardService.js` — reference for service/SQL pattern
- `simpa-backend/src/routes/importacao.js` — reference for route/middleware pattern
- `simpa-backend/tests/auth.test.js` — reference for Jest + supertest test structure

### Dependent Files

- `simpa-frontend/src/api/populacao.ts` — task_06 calls these endpoints
- `simpa-frontend/src/pages/Painel/PopulacaoPage.tsx` — task_07 displays data from these endpoints

### Related ADRs

- [ADR-002: Dedicated GET /api/populacao Endpoint](../adrs/adr-002.md) — Justifies standalone endpoint over dashboard payload extension

## Deliverables

- `simpa-backend/src/services/populacaoService.js`
- `simpa-backend/src/routes/populacao.js`
- Updated `simpa-backend/src/routes/api.js`
- Unit tests for `populacaoService.js`
- Integration tests for `GET /api/populacao` and `GET /api/populacao/competencias`
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests using supertest **(REQUIRED)**

## Tests

- Unit tests:
  - [x] `getPopulacao({ competencia: "2026-01", estabelecimentoId: undefined })` with no DB rows returns `null`
  - [x] `getPopulacao({ competencia: "2026-01", estabelecimentoId: 5 })` with one row returns object with `cidadaos_ativos`, `por_unidade[0].estabelecimento_id == 5`
  - [x] `_aggregate([row1, row2])` sums `cidadaos_ativos` from both rows
  - [x] `_aggregate([row1, row2])` correctly merges `faixa_etaria` bands (same faixa name summed)
  - [x] `_aggregate([row1, row2])` correctly sums `condicoes_saude.gestante.sim` across units
  - [x] `listPopulacaoCompetencias()` returns array sorted descending by competencia
- Integration tests:
  - [x] `GET /api/populacao?competencia=2026-01` without auth → 401
  - [x] `GET /api/populacao?competencia=2026-01` with valid JWT, no data → 404 with `error` key
  - [x] `GET /api/populacao?competencia=2026-01` with valid JWT, data seeded → 200 with `cidadaos_ativos > 0`
  - [x] `GET /api/populacao?competencia=2026-01&estabelecimento_id=5` returns single-unit response with `por_unidade.length == 1`
  - [x] `GET /api/populacao/competencias` with valid JWT → 200 with array (may be empty)
  - [x] `GET /api/populacao` missing `competencia` param → 400 with descriptive error
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `GET /api/populacao?competencia=2026-01` returns 200 with `total_cidadaos_ativos > 0` after test data seeded
- `GET /api/populacao?competencia=2099-01` (no data) returns 404
- Route mount confirmed: `GET /api/populacao` is accessible (not 404 from router)
