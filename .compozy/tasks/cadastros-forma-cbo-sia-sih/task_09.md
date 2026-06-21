---
status: pending
title: Criar páginas frontend de listagem Formas e CBOs
type: frontend
complexity: medium
dependencies:
  - task_06
  - task_08
---

# Task 09: Criar páginas frontend de listagem Formas e CBOs

## Overview

Implementar páginas read-only para os novos cadastros, com busca, tabela e estado de carregamento/erro.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `FormasPage.tsx` e `CbosPage.tsx`
- MUST consume APIs `/api/cadastros/formas` e `/api/cadastros/cbos`
- MUST provide busca por `q` com UX consistente com Cadastros
- MUST display aviso "somente leitura / origem MySQL"
- MUST include paginação mínima quando backend retornar metadados
</requirements>

## Subtasks
- [ ] 09.1 Criar client API para formas/cbos
- [ ] 09.2 Implementar tabela e filtros em FormasPage
- [ ] 09.3 Implementar tabela e filtros em CbosPage
- [ ] 09.4 Cobrir estados vazio/erro/carregando

## Deliverables
- `simpa-frontend/src/pages/Cadastros/FormasPage.tsx`
- `simpa-frontend/src/pages/Cadastros/CbosPage.tsx`
- testes Vitest das páginas

## Tests
- Unit tests:
  - [ ] Render inicial com loading
  - [ ] Busca dispara request com `q`
  - [ ] Tabela renderiza colunas esperadas
  - [ ] Erro de API mostra feedback amigável
- Coverage target: >=80% dos arquivos novos

## Success Criteria
- Usuário autenticado consulta Forma e CBO via telas dedicadas em Cadastros
