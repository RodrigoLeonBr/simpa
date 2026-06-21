---
status: pending
title: Vite manualChunks + lazy EChart import
type: frontend
complexity: medium
dependencies:
  - task_07
---

# Task 13: Vite manualChunks + lazy EChart import

## Overview

Configure Vite chunk splitting and defer ECharts component load until chart renders.

<requirements>
- MUST add `build.rollupOptions.output.manualChunks` for vendor and echarts in vite.config.ts
- MUST lazy-import EChart in consuming pages (Painel layouts, etc.)
- MUST lazy-load Metas, Indicadores, Relatorios routes in App.tsx (Phase 2 completion)
- MUST document gzip sizes in memory/MEMORY.md
</requirements>

## Subtasks

- [ ] 13.1 Update vite.config.ts
- [ ] 13.2 Dynamic import EChart.tsx
- [ ] 13.3 Lazy analytics routes; verify build output

## Related ADRs
- [ADR-003](../adrs/adr-003.md)

## Success Criteria
- Build shows separate vendor/echarts chunks
- Painel still renders charts after lazy load
