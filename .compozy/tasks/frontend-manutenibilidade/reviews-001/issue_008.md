---
provider: manual
pr:
round: 1
round_created_at: 2026-06-22T02:00:00Z
status: resolved
file: simpa-frontend/tests/e2e/critical-flow.spec.ts
line: 11
severity: medium
author: claude-code
provider_ref:
---

# Issue 008: critical-flow E2E depends on fragile CSV fixture path

## Review Comment

The spec loads `Relatório de atendimento individual-20260613175047.csv` from repo root via a path with accented characters. On Windows/CI this is fragile (encoding, missing file, slow ETL). Current failure: 120s timeout waiting for `POST /api/importacao/upload` after preview — blocks full E2E gate claimed in task_16.

**Fix:** Move a minimal CSV fixture to `simpa-frontend/tests/fixtures/` (ASCII filename). Add `test.beforeAll` seed or skip upload when preview has `blocked` rows. Consider shortening the upload wait with mocked API or dedicated E2E import endpoint. Document `seed:e2e` prerequisite in `testing-ci.md`.

## Triage

- Decision: `INVALID`
- Notes:
  - A falha observada (`timeout` em `/api/importacao/upload`) não demonstrou relação causal com o nome do fixture.
  - O problema atual é predominantemente de integração/ambiente do upload (pipeline ETL + disponibilidade), não de path/encoding.
  - Mantido como follow-up de estabilidade E2E fora deste batch; sem mudança de código neste item.
