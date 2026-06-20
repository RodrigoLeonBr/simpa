# Task Memory: task_09

## Done
- `fetchDashboard(competencia, { estabelecimentoId?, equipeId? })` → query params `estabelecimento_id` / `equipe_id`
- `useDashboard` passes IDs when both unidadeId+equipeId set; municipal view when either missing
- Removed fetchEquipes + unidadeNomeMap from dashboard load; no wait for unidades catalog for ID fetch
- Tests: `dashboard.test.ts` + updated `useDashboard.test.tsx` (404, ID params, municipal)

## Verify
- frontend `npm test`: 235 passed; useDashboard 100% stmt; global branches 80.06%
- `npm run build` OK

## Note
- Backend requires both IDs together; unidadeId alone → aggregate fetch (no ID params)
