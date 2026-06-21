---
status: pending
title: Criar serviços de listagem formas e cbos
type: backend
complexity: medium
dependencies:
  - task_01
---

# Task 05: Criar serviços de listagem formas e cbos

## Overview

Implementar serviços backend para consulta paginada e filtrável de `formas_sia` e `cbos_sia`, seguindo padrão dos serviços de cadastros existentes.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `simpa-backend/src/services/formasService.js`
- MUST create `simpa-backend/src/services/cbosService.js`
- MUST support `q`, `status`, `page`, `limit`
- MUST support filtros de `grupo` e `subgrupo` em formas
- MUST return `{ data, pagination }` no padrão de listagens existentes
</requirements>

## Subtasks
- [ ] 05.1 Serviço de formas com SQL parametrizada
- [ ] 05.2 Serviço de cbos com SQL parametrizada
- [ ] 05.3 Paginação e ordenação estáveis
- [ ] 05.4 Tratamento de filtros inválidos

## Deliverables
- `formasService.js`
- `cbosService.js`
- testes unitários dos serviços

## Tests
- Unit tests:
  - [ ] Filtro `q` aplica em descrição/código
  - [ ] Filtro `grupo/subgrupo` funciona
  - [ ] Paginação retorna totais corretos
  - [ ] Limite máximo é respeitado
- Integration tests:
  - [ ] N/A (coberto nas rotas task_06/07)

## Success Criteria
- Serviços retornam dados consistentes, paginados e performáticos
