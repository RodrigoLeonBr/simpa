---
status: completed
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

- [x] 13.1 Update vite.config.ts
- [x] 13.2 Dynamic import EChart.tsx
- [x] 13.3 Lazy analytics routes; verify build output

## Related ADRs
- [ADR-003](../adrs/adr-003.md)

## Success Criteria
- Build shows separate vendor/echarts chunks
- Painel still renders charts after lazy load

## Verification (2026-06-21)

- `manualChunks`: `vendor` (react/router), `echarts` (echarts/*)
- `LazyEChart.tsx` + `chartOptions.ts`; consumidores importam de `LazyEChart`
- Metas/Indicadores/Relatórios → `React.lazy` + `LazyModuleRoute`
- Build chunks gzip: index **14.8 KB**, vendor **74.5 KB**, echarts **167 KB** (on demand)
- Testes Painel/Indicadores/Metas/Relatórios: passing
