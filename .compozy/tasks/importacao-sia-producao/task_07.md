---
status: pending
title: Testes integração e docs agent
type: docs
complexity: medium
dependencies:
  - task_05
  - task_06
---

# Task 07: Testes integração e docs agent

## Overview

Fechar workflow com testes de integração end-to-end do fluxo sync→consolidar→API, atualizar documentação agent (`etl-python.md`, `cadastros.md`, `backend-api.md`), e registrar baseline de verificação em MEMORY.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST extend sia.integration.test.js for full sync mock path
- MUST document SIA production sync flow in docs/agent/etl-python.md
- MUST document UI banner and API in docs/agent/frontend.md and backend-api.md
- MUST update CLAUDE.md feature table if new module surface
- MUST run full verification gates and record in memory/MEMORY.md
</requirements>

## Subtasks

- [ ] 7.1 Integration test sync + producao endpoint
- [ ] 7.2 Update agent docs (3 files minimum)
- [ ] 7.3 Run npm test + test:py + build; record in MEMORY
- [ ] 7.4 Manual smoke checklist in task memory

## Implementation Details

### Relevant Files
- `simpa-backend/tests/integration/sia.integration.test.js`
- `docs/agent/etl-python.md`
- `docs/agent/backend-api.md`
- `docs/agent/cadastros.md`
- `.compozy/tasks/importacao-sia-producao/memory/MEMORY.md`

## Deliverables
- Docs atualizados + integração verde + MEMORY com evidência

## Tests
- Unit tests:
  - [ ] (covered by prior tasks)
- Integration tests:
  - [ ] POST sincronizar → GET producao returns rows
  - [ ] sia_sincronizacoes history populated
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Docs agent descrevem fluxo produção SIA completo
- Workflow pronto para cy-review-round
