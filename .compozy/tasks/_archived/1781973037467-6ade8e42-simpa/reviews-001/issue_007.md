---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T15:42:00Z
status: resolved
file: simpa-frontend/tests/e2e/critical-flow.spec.ts
line: 80
severity: medium
author: claude-code
provider_ref:
---

# Issue 007: Upload E2E pesado e sensível a carga do container

## Review Comment

Fluxo de importação usa CSV real (~grande), preview até 60s e upload até 120s num único teste serial. Sob carga do runner GHA, ponto provável de flakiness mesmo com retries.

**Sugestão:** fixture CSV menor dedicada; job separado para Playwright; ou profile de teste com ETL mockado.

## Triage

- Decision: `valid`
- Notes: Aceito como follow-up pós-arquivo — teste passa localmente; retries CI=2 mitigam; monitorar pipeline
