---
status: completed
title: "Frontend: PopulacaoPage (/painel/populacao)"
type: frontend
complexity: high
dependencies:
  - task_06
---

# Task 07: Frontend: PopulacaoPage (/painel/populacao)

## Overview

Creates `simpa-frontend/src/pages/Painel/PopulacaoPage.tsx` — the population dashboard page accessible at `/painel/populacao`. Displays summary cards (cidadãos ativos, saídas), a demographic pyramid (ECharts horizontal bar), a health conditions chart (ECharts horizontal bar showing % of active citizens per condition), and a per-unit collapsible table. Shows an empty state with a link to `/importacao` when no data exists for the selected competência/unit.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC "Implementation Design — Frontend Changes" and PRD "Core Features §3 Population Dashboard Section" for layout and chart specifications
- FOCUS ON "WHAT" — the page must render pyramid, conditions, cards, and empty state correctly
- MINIMIZE CODE — reuse existing ECharts patterns from other Painel layouts (LayoutA, LayoutB); do not introduce new charting libraries
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST create `simpa-frontend/src/pages/Painel/PopulacaoPage.tsx` that fetches data via `fetchPopulacao()` and `fetchPopulacaoCompetencias()` from task_06.
2. MUST display filter bar with: competência selector (dropdown of available competências from `fetchPopulacaoCompetencias()`) and unit multi-select or "Todas as unidades" option.
3. MUST render summary cards: total cidadãos ativos, total saídas, count of units with imported data.
4. MUST render demographic pyramid using ECharts: horizontal bar chart with age bands on Y-axis, masculino bars pointing left (negative values), feminino bars pointing right.
5. MUST render health conditions chart using ECharts: horizontal bar chart showing `sim` count (or % of active citizens) for each condition in `condicoes_saude` (gestante, hipertensao, diabetes, fumante, acamado, avc_derrame, cancer, saude_mental, alcool).
6. MUST render a per-unit summary table with columns: Unidade, Cidadãos Ativos, Saídas, Última importação.
7. MUST show empty state when `fetchPopulacao()` returns `null`: message "Dados não disponíveis — importe o relatório de cadastro individual" with link to `/importacao`.
8. MUST show loading skeleton while fetching.
9. MUST use `useFilters()` hook for competência value (same context as the rest of Painel).
10. MUST be lazy-loaded (consistent with other pages in App.tsx — see task_08).
11. MUST respect existing role-based access — only planning staff and admin can view the page (enforced by the route guard in task_08, but the page itself should not bypass this).
</requirements>

## Subtasks

- [x] 7.1 Create `PopulacaoPage.tsx` shell with competência display and loading/error/empty states.
- [x] 7.2 Implement summary cards (cidadãos ativos, saídas, unidades importadas).
- [x] 7.3 Implement demographic pyramid using ECharts (horizontal bar, masculino left / feminino right).
- [x] 7.4 Implement health conditions chart using ECharts (horizontal bar + legend with PT-BR labels).
- [x] 7.5 Implement per-unit summary table.
- [x] 7.6 Write unit tests for buildPyramidSeries and buildConditionsData (9 tests).
- [x] 7.7 Write render tests for empty state, loading state, populated state (7 tests).

## Implementation Details

See TechSpec "Frontend Changes" section. Look at `simpa-frontend/src/pages/Painel/LayoutA.tsx` and `LayoutB.tsx` for existing ECharts usage patterns. For the pyramid, use ECharts `bar` series with negative values for masculino:

The pyramid data builder transforms `faixa_etaria` array into two ECharts series:
- Series 1: `masculino` values as negative numbers (rendered left of axis)
- Series 2: `feminino` values as positive numbers (rendered right of axis)
- Y-axis: `faixa` labels in reverse age order (oldest at top)

For the conditions chart, sort conditions by `sim` count descending. Display condition labels in Portuguese (map `condicoes_saude` keys to display names).

The `DashboardPageShell` component (used by PainelPage) handles loading/error display — reuse it.

### Relevant Files

- `simpa-frontend/src/pages/Painel/LayoutA.tsx` — ECharts usage reference
- `simpa-frontend/src/pages/Painel/LayoutB.tsx` — ECharts usage reference
- `simpa-frontend/src/hooks/useFilters.ts` — `competencia` state
- `simpa-frontend/src/components/shared/DashboardPageShell.tsx` — loading/error shell
- `simpa-frontend/src/api/populacao.ts` — data fetching (task_06)
- `simpa-frontend/src/types/populacao.ts` — type imports (task_06)

### Dependent Files

- `simpa-frontend/src/App.tsx` — task_08 adds the lazy import and route
- `simpa-frontend/src/config/navigation.ts` — task_08 adds nav entry

## Deliverables

- `simpa-frontend/src/pages/Painel/PopulacaoPage.tsx`
- Unit tests for pyramid data transformer and conditions data transformer
- Render tests for empty state, loading state, populated state
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests confirming page renders with real API data **(REQUIRED)**

## Tests

- Unit tests:
  - [ ] `buildPyramidSeries(faixa_etaria)` returns two series; masculino series has negative values for all bands; "Menos de 01 ano" band has masculino value -31 for PSF JD Alvorada data
  - [ ] `buildPyramidSeries([])` returns two empty series without error
  - [ ] `buildConditionsData(condicoes_saude, cidadaos_ativos)` returns sorted array with `hipertensao` having the highest count (313 for PSF JD Alvorada)
  - [ ] `buildConditionsData({}, 0)` returns empty array without error
  - [ ] PopulacaoPage renders loading skeleton when `loading = true`
  - [ ] PopulacaoPage renders empty state with link to `/importacao` when data is `null`
  - [ ] PopulacaoPage renders summary card "3337" for cidadãos ativos given mock data
  - [ ] PopulacaoPage renders conditions chart with "Hipertensão" label visible given mock data
  - [ ] PopulacaoPage renders per-unit table with "PSF JD Alvorada" row given mock data
- Integration tests:
  - [ ] Navigate to `/painel/populacao` in test environment → page renders without crash (React Testing Library + router)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- Demographic pyramid renders with masculino bars on left and feminino bars on right
- Health conditions chart shows at least hipertensão, diabetes, gestante, fumante bars
- Empty state with link to `/importacao` shown when no data imported
- Page loads in < 2 seconds (lazy bundle)
