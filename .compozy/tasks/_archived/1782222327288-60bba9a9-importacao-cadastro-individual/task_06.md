---
status: completed
title: "Frontend: types + API client populacao"
type: frontend
complexity: low
dependencies:
  - task_05
---

# Task 06: Frontend: types + API client populacao

## Overview

Creates `simpa-frontend/src/types/populacao.ts` with TypeScript interfaces matching the `GET /api/populacao` response shape, and `simpa-frontend/src/api/populacao.ts` with `fetchPopulacao()` and `fetchPopulacaoCompetencias()` functions. These are the only frontend modules that touch the population API and serve as the typed boundary for tasks_07 and task_08.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC "API Response Shape — GET /api/populacao" and "Core Interfaces — pop_row dict" for the exact TypeScript interface shapes
- FOCUS ON "WHAT" — typed API client matching the backend response exactly
- MINIMIZE CODE — follow the exact same pattern as `simpa-frontend/src/api/cadastros.ts` and `src/api/dashboard.ts`
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST create `simpa-frontend/src/types/populacao.ts` with interfaces: `FaixaEtaria`, `CondicaoSaude`, `CondicoesSaude`, `RacaCor`, `UnidadePopulacao`, `PopulacaoResponse`, `CompetenciaEntry`.
2. `PopulacaoResponse` MUST have fields: `competencia`, `total_cidadaos_ativos`, `total_saidas`, `por_unidade: UnidadePopulacao[]`, `faixa_etaria: FaixaEtaria[]`, `condicoes_saude: CondicoesSaude`, `raca_cor: RacaCor`.
3. `FaixaEtaria` MUST have: `faixa: string`, `masculino: number`, `feminino: number`, `indeterminado?: number`.
4. `CondicaoSaude` MUST have: `sim: number`, `nao: number`, `nao_informado: number`.
5. `CondicoesSaude` MUST be `Record<string, CondicaoSaude>` (open-ended for forward compatibility).
6. MUST create `simpa-frontend/src/api/populacao.ts` with `fetchPopulacao(competencia: string, estabelecimentoId?: number): Promise<PopulacaoResponse | null>` and `fetchPopulacaoCompetencias(): Promise<CompetenciaEntry[]>`.
7. `fetchPopulacao()` MUST return `null` on HTTP 404 (unit/competência not imported yet); MUST throw on other errors.
8. MUST use `apiFetch` from `./client` — same pattern as all other API clients.
9. MUST export all types from `types/populacao.ts` for use in page components.
</requirements>

## Subtasks

- [x] 6.1 Create `simpa-frontend/src/types/populacao.ts` with all interfaces.
- [x] 6.2 Create `simpa-frontend/src/api/populacao.ts` with `fetchPopulacao()` and `fetchPopulacaoCompetencias()`.
- [x] 6.3 Write 11 unit tests (mock `apiFetch`) — all passing.

## Implementation Details

Follow the `simpa-frontend/src/api/cadastros.ts` pattern: import `apiFetch` from `./client`, build query string with `URLSearchParams`, export typed fetch functions. For `fetchPopulacao()`, handle 404 by catching the error and returning `null`.

`apiFetch` signature: `apiFetch<T>(path: string, options?): Promise<T>` — it throws `ApiError` with a `status` field on non-2xx responses. Catch `ApiError` with `status === 404` and return `null`; re-throw other errors.

### Relevant Files

- `simpa-frontend/src/api/cadastros.ts` — reference for API client pattern
- `simpa-frontend/src/api/client.ts` — `apiFetch` and error types
- `simpa-frontend/src/types/cadastros.ts` — reference for TypeScript interface style

### Dependent Files

- `simpa-frontend/src/pages/Painel/PopulacaoPage.tsx` — task_07 imports these types and functions
- `simpa-frontend/src/api/populacao.test.ts` — new test file for this task

## Deliverables

- `simpa-frontend/src/types/populacao.ts`
- `simpa-frontend/src/api/populacao.ts`
- `simpa-frontend/src/api/populacao.test.ts`
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests confirming API contract match **(REQUIRED)**

## Tests

- Unit tests:
  - [ ] `fetchPopulacao("2026-01")` calls `apiFetch("/api/populacao?competencia=2026-01")`
  - [ ] `fetchPopulacao("2026-01", 5)` calls `apiFetch("/api/populacao?competencia=2026-01&estabelecimento_id=5")`
  - [ ] `fetchPopulacao()` returns `null` when `apiFetch` throws `ApiError` with status 404
  - [ ] `fetchPopulacao()` re-throws when `apiFetch` throws `ApiError` with status 500
  - [ ] `fetchPopulacaoCompetencias()` calls `apiFetch("/api/populacao/competencias")` and returns the array
  - [ ] TypeScript compilation passes with no type errors (`tsc --noEmit`)
- Integration tests:
  - [ ] `fetchPopulacao("2026-01")` against real test API (after task_05 and seeded data) returns `PopulacaoResponse` with correct `total_cidadaos_ativos`
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `tsc --noEmit` passes with no errors related to new types
- `fetchPopulacao("2026-01")` returns typed `PopulacaoResponse | null` (not `any`)
