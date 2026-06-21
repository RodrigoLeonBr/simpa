---
status: pending
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

- [ ] 15.1 Split dashboardView → utils/painel/*
- [ ] 15.2 Split indicadoresView → metas/indicadores/relatorios/shared
- [ ] 15.3 Split importacaoView → utils/importacao/*
- [ ] 15.4 Run full frontend test suite

## Success Criteria
- All utils tests pass
- dashboardView.ts either removed or thin re-export only
