---
status: pending
title: Atualizar cadastrosSync.js para novos contadores
type: backend
complexity: low
dependencies:
  - task_02
---

# Task 04: Atualizar cadastrosSync.js para novos contadores

## Overview

Expandir o mapeamento de histórico e resultado de sincronização para incluir estatísticas de `formas` e `cbos`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST update `mapSyncRow` with blocks `formas` and `cbos`
- MUST include new DB columns in `listSyncHistory` and `getLatestSync`
- MUST keep backward compatibility for existing consumers
- MUST update tests that assert sync response shape
</requirements>

## Subtasks
- [ ] 04.1 Ajustar SELECTs com colunas `forma_*` e `cbo_*`
- [ ] 04.2 Ajustar mapper de resposta
- [ ] 04.3 Atualizar testes de serviço/rota

## Deliverables
- `simpa-backend/src/services/cadastrosSync.js` atualizado
- testes backend atualizados

## Tests
- Unit tests:
  - [ ] `mapSyncRow` expõe `formas` e `cbos`
- Integration tests:
  - [ ] `GET /api/cadastros/sincronizacoes`
  - [ ] `GET /api/cadastros/sincronizacoes/ultima`

## Success Criteria
- Histórico de sync retorna shape completo com quatro domínios (estab, proc, forma, cbo)
