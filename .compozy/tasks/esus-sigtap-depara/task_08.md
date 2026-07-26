---
status: pending
title: Frontend export download + Painel mapped procedures
type: frontend
complexity: medium
dependencies:
  - task_05
  - task_06
---

# Task 08: Frontend export download + Painel mapped procedures

## Overview

Let operators download mapped procedures as CSV/JSON from the UI and optionally view `procedimentos_mapeados` on the Painel APS tab, completing dual-consumption UX from the PRD.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
1. MUST provide UI control(s) to download export for current competência/unidade/equipe filters (`format=csv` and optionally JSON).
2. MUST call `GET /api/procedimentos/export` with the same filters used by the Painel/contexto ativo.
3. MUST render `procedimentos_mapeados` from dashboard payload in Painel (table: secao, descricao, codigo_sigtap, quantidade) when array length > 0.
4. MUST handle empty mapped set without error (empty state message).
5. MUST use types from updated `contrato.ts` (task_06).
6. SHOULD place export entry near Relatórios or Cadastros/Painel actions without inventing a full Relatórios module.
</requirements>

## Subtasks
- [ ] 8.1 Add export download client helper (blob/CSV handling)
- [ ] 8.2 Add UI button(s) wired to active filters
- [ ] 8.3 Add Painel table/section for `procedimentos_mapeados`
- [ ] 8.4 Empty-state messaging for zero mapped rows
- [ ] 8.5 Add component tests for download params and table render

## Implementation Details

See TechSpec **Development Sequencing** steps 7–8 and ADR-004. Painel entry via `pages/Painel` / APS tab components. Reuse filter context from existing Painel if present.

### Relevant Files
- `simpa-frontend/src/pages/Painel/index.tsx` — compose APS views
- `simpa-frontend/src/types/contrato.ts` — ModuloAPS.procedimentos_mapeados
- `simpa-frontend/mock/db.json` — sample rows for UI
- Export API from task_05

### Dependent Files
- Docs may reference UI paths (task_09)

### Related ADRs
- [ADR-004](adrs/adr-004.md) — dual consumption UX

## Deliverables
- Export download working from UI
- Painel display of mapped procedures
- Frontend tests **(REQUIRED)**
- Coverage >=80% on new UI helpers/components **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] Download helper requests `/api/procedimentos/export` with competencia and format=csv
  - [ ] Table renders one row per mapped item with codigo_sigtap visible
  - [ ] Empty array shows empty-state, not a crash
- Integration tests:
  - [ ] Clicking export triggers blob download path (mocked fetch)
  - [ ] Painel with mock payload containing procedimentos_mapeados shows the section
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- CSV downloaded from UI opens with TechSpec columns
- Painel and export reflect the same mapping source of truth
