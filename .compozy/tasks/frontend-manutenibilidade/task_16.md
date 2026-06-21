---
status: pending
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

- [ ] 16.1 Split drawer components
- [ ] 16.2 Extend cadastroEntities registry
- [ ] 16.3 Document patterns in docs/agent/frontend.md
- [ ] 16.4 Run full CI: npm test, npm run build, test:e2e if stack available

## Success Criteria
- Drawer files ≤200 lines each
- Registry lists all cadastro grid items
- Docs agent updated
- Ready for cy-review-round
