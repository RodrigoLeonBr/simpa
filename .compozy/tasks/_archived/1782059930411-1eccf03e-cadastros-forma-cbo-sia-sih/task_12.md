---
status: completed
title: Preparar extensão SIH e atualizar documentação técnica
type: docs
complexity: low
dependencies:
  - task_11
---

# Task 12: Preparar extensão SIH e atualizar documentação técnica

## Overview

Documentar o uso de `forma` e `cbo` para SIA e estabelecer o contrato de extensão para SIH, com atualização do hub de documentação de agentes.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST update `docs/agent/backend-api.md` with endpoints `formas`/`cbos`
- MUST update `docs/agent/cadastros.md` com fluxo de sync e uso analítico
- MUST update `docs/agent/frontend.md` com novas rotas de cadastros
- MUST document SIH extension contract (`resolveFormaDescricao`, `resolveCboDescricao`)
- SHOULD update `CLAUDE.md` mapa funcional com referência curta às novas tabelas
</requirements>

## Subtasks
- [x] 12.1 Documentar API e services novos
- [x] 12.2 Documentar páginas frontend e navegação
- [x] 12.3 Registrar contrato de extensão SIH
- [x] 12.4 Revisar consistência entre docs e implementação

## Deliverables
- arquivos `docs/agent/*` atualizados
- eventual ajuste em `CLAUDE.md`

## Tests
- Unit tests:
  - [x] N/A (task de documentação)
- Integration tests:
  - [x] Checklist manual: caminhos/documentos batem com código
  - [x] Links internos válidos

## Success Criteria
- Time encontra rapidamente o fluxo completo forma/cbo (sync, API, UI, SIA, SIH)
