---
provider: manual
pr:
round: 1
round_created_at: 2026-06-22T02:00:00Z
status: resolved
file: simpa-frontend/src/pages/Cadastros/IndicadoresPainelPage.tsx
line: 114
severity: medium
author: claude-code
provider_ref:
---

# Issue 006: Metric picker fetch failures are silent

## Review Comment

`loadMetricas` catches errors with `catch (_err)` and only clears `metricOptions` to `[]`. Planning staff opening the widget form sees an empty metric list with no toast or inline error — indistinguishable from “no metrics match query”. This regressed discoverability after `useEntityCrud` refactor.

**Fix:** On catch, call `showToast('Falha ao carregar métricas')` or set a `metricError` state rendered near `PainelMetricPicker`. Do not swallow the error without user feedback.

## Triage

- Decision: `VALID`
- Notes:
  - O `catch` atual remove opções e não informa erro ao usuário.
  - O comportamento é ambíguo (parece lista vazia legítima) e afeta operação do cadastro de widgets.
  - Correção aplicada em `src/pages/Cadastros/IndicadoresPainelPage.tsx`: `showToast(...)` no `catch` de `loadMetricas`.
  - Também eliminou warning/lint de variável `_err` não utilizada.
