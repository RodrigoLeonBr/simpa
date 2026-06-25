---
status: completed
title: "Docs agent — backend-api.md, frontend.md, database.md"
type: docs
complexity: low
dependencies:
  - task_07
  - task_08
---

# Task 09: Docs agent — backend-api.md, frontend.md, database.md

## Overview

Atualiza os três arquivos de documentação de agente em `docs/agent/` para refletir o módulo SIHD completo: novos endpoints em `backend-api.md`, novos componentes e páginas em `frontend.md`, e novas tabelas em `database.md`. Também atualiza `CLAUDE.md` com o módulo funcional SIHD e a feature concluída, e move o schema `sih-aih-schema-for-llm.md` para `docs/` se ainda estiver na raiz.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST atualizar `docs/agent/backend-api.md` com: seção SIHD (endpoints /api/sih/*), serviços sih.js e sihProducaoService.js, autenticação requirePlanningStaff, gate 409, eventos SIH_PROGRESS
- MUST atualizar `docs/agent/frontend.md` com: SihImportSection em /importacao, SihSyncStatusBadge em Cadastros, catalogView Hospitalar A → ready, types/sih.ts, api/sih.ts
- MUST atualizar `docs/agent/database.md` com: tabelas sih_sincronizacoes, sih_internacoes, sih_procedimentos, migration_013, nota sobre FINANCIAMENTO 2-char vs RUB_ID
- MUST atualizar `CLAUDE.md`: adicionar "## Feature concluída: importacao-sihd-hospitalar" conforme padrão das features anteriores (≤ 5 linhas, links para docs/agent/)
- MUST verificar que CLAUDE.md permanece ≤ 300 linhas (mover detalhes para docs/agent/ se necessário)
- SHOULD mover `sih-aih-schema-for-llm.md` da raiz para `docs/` e atualizar referências internas
</requirements>

## Subtasks

- [x] 9.1 Atualizar `docs/agent/backend-api.md` com seção SIHD completa (endpoints, serviços, auth, gate 409)
- [x] 9.2 Atualizar `docs/agent/frontend.md` com novos componentes, tipos e mudança catalogView
- [x] 9.3 Atualizar `docs/agent/database.md` com as três novas tabelas e migration_013
- [x] 9.4 Adicionar seção "Feature concluída: importacao-sihd-hospitalar" em `CLAUDE.md`
- [x] 9.5 Verificar contagem de linhas de CLAUDE.md (deve ser ≤ 300)

## Implementation Details

Seguir exatamente o padrão das features concluídas já documentadas em CLAUDE.md (ex: "## Feature concluída: importacao-cadastro-individual"). Não replicar TechSpec em docs — referenciar arquivos com links relativos.

`docs/agent/backend-api.md` já tem seção SIA para referência de formato. `docs/agent/database.md` já lista tabelas existentes — adicionar as 3 novas após `rubricas_sia`.

### Relevant Files

- `docs/agent/backend-api.md` — a atualizar com SIHD
- `docs/agent/frontend.md` — a atualizar com componentes SIHD
- `docs/agent/database.md` — a atualizar com tabelas sih_*
- `CLAUDE.md` — a atualizar com feature concluída
- `sih-aih-schema-for-llm.md` — verificar se deve mover para docs/

### Dependent Files

- Nenhum arquivo de código depende de docs

## Deliverables

- `docs/agent/backend-api.md` atualizado
- `docs/agent/frontend.md` atualizado
- `docs/agent/database.md` atualizado
- `CLAUDE.md` atualizado com feature concluída SIHD

## Tests

- Unit tests:
  - [ ] `CLAUDE.md` tem ≤ 300 linhas após atualização
  - [ ] `docs/agent/backend-api.md` contém "sih" ou "/api/sih" após atualização
  - [ ] `docs/agent/database.md` contém "sih_internacoes" após atualização
- Integration tests:
  - [ ] Nenhum link interno nos docs aponta para arquivo inexistente
- Test coverage target: N/A (docs task — verificação manual)
- All tests must pass

## Success Criteria

- All tests passing
- CLAUDE.md ≤ 300 linhas
- Seção "Feature concluída: importacao-sihd-hospitalar" visível em CLAUDE.md
- `/api/sih/*` documentado em backend-api.md com gate 409 explicado
- Tabelas sih_* descritas em database.md com nota sobre FINANCIAMENTO 2-char
