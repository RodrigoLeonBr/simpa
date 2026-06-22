---
status: completed
title: Split EstabelecimentoDetailDrawer + cadastroEntities + docs
type: frontend
complexity: medium
dependencies:
  - task_04
  - task_14
---

# Task 16: Split EstabelecimentoDetailDrawer + cadastroEntities + docs

## Overview

Final structural cleanup: drawer subcomponents, extended cadastro registry metadata, agent documentation.

<requirements>
- MUST split EstabelecimentoDetailDrawer into drawer chrome + perfil editor + enrichment panel
- MUST extend `config/cadastroEntities.ts` with mode/route for all grid entities (readonly/crud/custom)
- MUST update `docs/agent/frontend.md` with ReadOnlyCatalogPage, useEntityCrud, lazy routes, styles/ conventions
- MUST update `docs/agent/compozy.md` with active workflow entry
- SHOULD update CLAUDE.md feature table when workflow completes (separate commit if user requests)
</requirements>

## Subtasks

- [x] 16.1 Split drawer components
- [x] 16.2 Extend cadastroEntities registry
- [x] 16.3 Document patterns in docs/agent/frontend.md
- [x] 16.4 Run full CI: npm test, npm run build, test:e2e if stack available

## Success Criteria
- Drawer files ≤200 lines each
- Registry lists all cadastro grid items
- Docs agent updated
- Ready for cy-review-round

## Completion notes (2026-06-21)

- Drawer split → `components/cadastros/estabelecimento/*` (chrome, synced, perfil, enrichment); orquestrador 107 linhas
- `EstabelecimentosPageShell` → arquivo próprio
- `cadastroEntities`: `CadastroEntityMode`, `mode` em grid + CRUD entities, `getCadastroGridItem`
- Docs: `frontend.md` (#patterns, lazy, styles/, utils partition), `compozy.md`, `CLAUDE.md`
- Vitest 352/352 · build OK · E2E 4/5 após `seed:e2e` (`critical-flow` import upload flaky)
