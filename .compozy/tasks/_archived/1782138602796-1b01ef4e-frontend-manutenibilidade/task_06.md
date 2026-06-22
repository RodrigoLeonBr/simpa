---
status: completed
title: Modularize index.css into styles/ domain files
type: refactor
complexity: medium
dependencies: []
---

# Task 06: Modularize index.css into styles/ domain files

## Overview

Split monolithic `index.css` into domain files per ADR-005 without visual changes.

<requirements>
- MUST create `src/styles/tokens.css`, `base.css`, `layout.css`, `painel.css`, `cadastros.css`, `admin.css`, `importacao.css`
- MUST reduce `index.css` to tailwind import + style imports only
- MUST preserve dark theme variables and all existing class names
- MUST manual smoke: Painel, Cadastros, Admin, Importação
</requirements>

## Subtasks

- [x] 6.1 Extract tokens and base
- [x] 6.2 Move layout and module blocks
- [x] 6.3 Verify no missing rules (grep moved selectors)

## Related ADRs
- [ADR-005](../adrs/adr-005.md)

## Success Criteria
- index.css < 30 lines
- Visual parity on all main routes
