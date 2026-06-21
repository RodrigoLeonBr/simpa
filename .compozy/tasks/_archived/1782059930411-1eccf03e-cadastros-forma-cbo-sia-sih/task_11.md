---
status: completed
title: Integrar descrições de forma e cbo no fluxo SIA
type: backend
complexity: medium
dependencies:
  - task_02
  - task_05
---

# Task 11: Integrar descrições de forma e cbo no fluxo SIA

## Overview

Usar os novos cadastros de referência para enriquecer saídas analíticas do SIA com descrições legíveis de Forma e CBO.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add join/mapeamento por código entre dados SIA e `formas_sia`/`cbos_sia`
- MUST apply canonicalization rule (`left(...,6)`) antes do join
- MUST preserve compatibilidade de respostas existentes (campos antigos intactos)
- MUST expose novos campos descritivos sem quebrar consumidores atuais
</requirements>

## Subtasks
- [x] 11.1 Identificar consultas SIA elegíveis para enriquecimento
- [x] 11.2 Aplicar join por código canônico
- [x] 11.3 Expor `descricao_forma` e `descricao_cbo` no payload
- [x] 11.4 Cobrir regressão de performance e compatibilidade

## Deliverables
- serviços/queries SIA atualizados
- testes de integração backend para payload enriquecido

## Tests
- Unit tests:
  - [x] Canonicalização de código CBO e forma
  - [x] Null-safe join sem falhar quando não houver cadastro
- Integration tests:
  - [x] Resposta SIA inclui descrições quando cadastro existe
  - [x] Resposta segue válida quando cadastro não existe

## Success Criteria
- Relatórios SIA passam a ter legenda descritiva de Forma/CBO
