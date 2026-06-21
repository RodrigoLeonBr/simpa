---
status: completed
title: Adicionar cards Forma e CBO no cadastroEntities
type: frontend
complexity: low
dependencies: []
---

# Task 08: Adicionar cards Forma e CBO no cadastroEntities

## Overview

Atualizar a configuração de entidades de Cadastros para incluir as novas entradas de navegação de `Forma` e `CBO`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add card item para `formas`
- MUST add card item para `cbos`
- MUST keep descriptions explicitando origem MySQL/read-only
- MUST update typing (`CadastroEntityKey` / grid items) conforme necessário
</requirements>

## Subtasks
- [x] 08.1 Inserir `formas` em `CADASTRO_GRID_ITEMS`
- [x] 08.2 Inserir `cbos` em `CADASTRO_GRID_ITEMS`
- [x] 08.3 Ajustar test ids e tipos

## Deliverables
- `simpa-frontend/src/config/cadastroEntities.ts` atualizado

## Tests
- Unit tests:
  - [x] Grid contém cards forma e cbo
  - [x] Test IDs renderizam corretamente
- Integration tests:
  - [ ] N/A (validado em task_10)

## Success Criteria
- Cards aparecem no grid sem quebra dos itens existentes
