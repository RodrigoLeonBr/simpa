---
provider: manual
pr:
round: 1
round_created_at: 2026-06-22T02:00:00Z
status: resolved
file: simpa-frontend/src/components/charts/EChart.tsx
line: 21
severity: high
author: claude-code
provider_ref:
---

# Issue 001: EChart disposes and recreates on every option change

## Review Comment

`useEffect` depends on `[option]` and runs `echarts.init` + `dispose` on every change. Consumers (`LayoutA.tsx:72`, `KpiCard.tsx:35`, `Situacao/index.tsx`) pass freshly allocated option objects each render (`trendOption(trend)`, `sparklineOption(...)`), so charts tear down and re-init continuously — visible jank and wasted work on the Painel.

**Fix:** Split init (mount) from update: init once in `useEffect([])`, call `chartRef.current?.setOption(option, { notMerge: false })` when `option` changes. Alternatively memoize options in parents with `useMemo`. Also affects any page using `LazyEChart`.

**Affected files:** `EChart.tsx`, `LayoutA.tsx`, `KpiCard.tsx`, `pages/Situacao/index.tsx`.

## Triage

- Decision: `VALID`
- Notes:
  - O problema foi reproduzido no código atual: `EChart` reinicializa o chart em toda mudança de `option`.
  - Impacta performance e estabilidade visual nos cards e gráficos de tendência.
  - Correção aplicada em `src/components/charts/EChart.tsx`: init/dispose apenas no mount/unmount e atualização de opção em efeito dedicado (`setOption`).
  - Verificado em `npx vitest run --coverage=false` (suite completa passando).
