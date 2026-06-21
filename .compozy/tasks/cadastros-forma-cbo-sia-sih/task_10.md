---
status: pending
title: Integrar rotas Cadastros e atualizar testes de grid/navegação
type: frontend
complexity: low
dependencies:
  - task_09
---

# Task 10: Integrar rotas Cadastros e atualizar testes de grid/navegação

## Overview

Conectar as novas páginas no roteamento de `Cadastros` e ajustar testes de navegação/grid para refletir os novos cartões.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add routes `/cadastros/formas` and `/cadastros/cbos` em `pages/Cadastros/index.tsx`
- MUST ensure `CadastroGrid` links point to rotas novas
- MUST update `Cadastros.test.tsx` expected card count and route assertions
- MUST keep rota fallback (`*`) sem regressão
</requirements>

## Subtasks
- [ ] 10.1 Registrar rotas no `CadastrosPage`
- [ ] 10.2 Atualizar testes de card count e testIds
- [ ] 10.3 Validar resolução de rota para novas páginas

## Deliverables
- `simpa-frontend/src/pages/Cadastros/index.tsx` atualizado
- `simpa-frontend/src/pages/Cadastros/Cadastros.test.tsx` atualizado

## Tests
- Unit tests:
  - [ ] Grid exibe novos cards
  - [ ] `/cadastros/formas` renderiza FormasPage
  - [ ] `/cadastros/cbos` renderiza CbosPage
- Integration tests:
  - [ ] Navegação click-through do card para página destino

## Success Criteria
- Navegação de Cadastros completa com os novos domínios
