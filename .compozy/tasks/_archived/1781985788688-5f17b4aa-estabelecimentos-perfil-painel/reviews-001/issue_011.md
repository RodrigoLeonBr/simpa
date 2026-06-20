---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T19:30:18Z
status: resolved
file: simpa-frontend/src/utils/dashboardView.ts
line: 210
severity: medium
author: claude-code
provider_ref:
---

# Issue 011: Delta de coletivas compara métricas incompatíveis

## Review Comment

O KPI `coletivas` usa `total_participantes_coletivos` de `kpis_gerais` (linha 156), mas o delta chama `computeDelta(coletivas, curr?.atendimentos ?? null)` (linha 210) — compara participantes coletivos com atendimentos individuais do mês corrente em `historico_mensal`. O resultado exibido em layouts B/C é enganoso.

**Correção sugerida:** usar campo histórico correto (se existir no contrato) ou omitir delta/spark para coletivas até o backend expor série mensal compatível; alternativamente comparar `coletivas` mês a mês se o dado estiver disponível em outra fonte.

## Triage

- Decision: `valid`
- Notes: Delta de coletivas usa label plano `—` e spark removido até existir série histórica compatível no contrato. Teste em `dashboardView.test.ts`.
