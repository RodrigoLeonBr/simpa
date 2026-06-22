---
status: completed
title: Partition dashboardView, indicadoresView, importacaoView
type: refactor
complexity: high
dependencies: []
---

# Task 15: Partition dashboardView, indicadoresView, importacaoView

## Overview

Split god utils into domain subfolders with temporary re-exports from original paths.

<requirements>
- MUST partition per TechSpec table (painel/, metas/, indicadores/, relatorios/, importacao/)
- MUST keep existing import paths working via re-export barrels OR update all imports in same task
- MUST run utils unit tests and pages using these modules
- Each new file SHOULD be ≤200 lines
</requirements>

## Subtasks

- [x] 15.1 Split dashboardView → utils/painel/*
- [x] 15.2 Split indicadoresView → metas/indicadores/relatorios/shared
- [x] 15.3 Split importacaoView → utils/importacao/*
- [x] 15.4 Run full frontend test suite

## Success Criteria
- All utils tests pass
- dashboardView.ts either removed or thin re-export only

## Completion notes (2026-06-21)

- `dashboardView.ts`, `importacaoView.ts` → re-export fino (`export *`)
- `indicadoresView.ts` → barrel explícito para metas/indicadores/relatorios/shared
- Novos módulos: `utils/painel/*`, `utils/metas/metasView.ts`, `utils/indicadores/qualidadeView.ts`, `utils/relatorios/comparativoView.ts`, `utils/shared/metaStatus.ts`, `utils/importacao/*`
- Maior arquivo novo: `previewHelpers.ts` (197 linhas)
- Utils tests: 35/35 · suite completa: 350/350 (fix mock LazyEChart em `Situacao.test.tsx`)
- `tsc -b` + build OK
