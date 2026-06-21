---
status: completed
title: Expor rotas GET de formas e cbos em cadastros
type: backend
complexity: low
dependencies:
  - task_05
---

# Task 06: Expor rotas GET de formas e cbos em cadastros

## Overview

Adicionar os endpoints de leitura para os novos cadastros de referência no router de `cadastros`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add `GET /api/cadastros/formas`
- MUST add `GET /api/cadastros/cbos`
- MUST require JWT (mesmo escopo de leitura de cadastros)
- MUST reject métodos de escrita com 405 (read-only MVP)
- MUST keep `routes/cadastros.js` organizado e sem regressão em rotas existentes
</requirements>

## Subtasks
- [x] 06.1 Registrar handlers GET
- [x] 06.2 Adicionar handlers 405 para POST/PUT/DELETE
- [x] 06.3 Mapear query params para serviços

## Deliverables
- `simpa-backend/src/routes/cadastros.js` atualizado

## Tests
- Unit tests:
  - [x] Handler de formas chama serviço correto
  - [x] Handler de cbos chama serviço correto
- Integration tests:
  - [x] GET autenticado retorna 200
  - [x] POST/PUT/DELETE retornam 405

## Success Criteria
- Endpoints novos disponíveis no contrato de API de cadastros
