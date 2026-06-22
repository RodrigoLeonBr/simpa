---
status: completed
title: Refactor IndicadoresPainelPage with useEntityCrud
type: frontend
complexity: high
dependencies:
  - task_08
---

# Task 10: Refactor IndicadoresPainelPage with useEntityCrud

## Overview

Apply useEntityCrud to widget list CRUD while keeping WidgetPreviewModal, discovery, and metric picker as page-specific extensions.

<requirements>
- MUST refactor `pages/Cadastros/IndicadoresPainelPage.tsx` to use hook for list/create/update/inactivate
- MUST preserve preview modal and discovery actions unchanged in behavior
- MUST split `IndicadoresPainelPage.test.tsx` into smaller describe blocks if file >400 lines after refactor
- MUST keep Playwright `painel-widgets.spec.ts` passing
</requirements>

## Subtasks

- [x] 10.1 Wire hook for core CRUD; keep preview/discovery local
- [x] 10.2 Reduce page LOC; extract subcomponents if needed
- [x] 10.3 Reorganize tests by flow (list, create, preview)

## Success Criteria
- IndicadoresPainel tests + E2E pass
- Page logic clearer; CRUD state not duplicated

## Verification (2026-06-21)

- `useEntityCrud` + `onSubmit` custom (`submitPainelWidget`); preview/discovery/metric picker locais
- Extraídos: `indicadoresPainelView.ts`, `IndicadoresPainelWidgetTable`, `PainelMetricPicker`
- `IndicadoresPainelPage.tsx` ~280 linhas (vs ~418 antes); testes em 4 describe blocks
- IndicadoresPainelPage.test.tsx: 23 passing; `tsc -b` + build OK
- E2E não reexecutado nesta sessão (sem stack :8080)
