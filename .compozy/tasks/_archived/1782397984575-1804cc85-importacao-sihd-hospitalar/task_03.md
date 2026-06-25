---
status: completed
title: "Backend SIHD — services/sih.js + routes/sih.js + mount em api.js"
type: backend
complexity: medium
dependencies:
  - task_02
---

# Task 03: Backend SIHD — services/sih.js + routes/sih.js + mount em api.js

## Overview

Cria o serviço Node.js `services/sih.js` que faz spawn de `sync_sih_mysql.py`, interpreta eventos `SIH_PROGRESS` do stderr e mantém cache de progresso em memória, e o router `routes/sih.js` com todos os endpoints SIHD. Monta o novo router em `/api/sih` dentro de `routes/api.js`. Implementa gate 409 idêntico ao SIA para competência já importada.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST criar `services/sih.js` com funções `sincronizar(competencia, opts)`, `getSyncProgress(executionId)`, `getCompetenciaImportada(competencia)` espelhando `services/sia.js`
- MUST emitir e interpretar eventos com prefixo `SIH_PROGRESS ` (não `SIA_PROGRESS`)
- MUST implementar gate 409: se competência tem status 'ok' ou 'parcial' em sih_sincronizacoes e `reimportar !== true` → retornar 409 com body `SihConflictError` conforme TechSpec § API Endpoints
- MUST retornar 503 com mensagem PT-BR quando MySQL indisponível (`code: 'SIH_MYSQL_UNAVAILABLE'`)
- MUST criar `routes/sih.js` com todos os 6 endpoints conforme TechSpec § API Endpoints
- MUST aplicar `requirePlanningStaff` em `POST /api/sih/sincronizar`
- MUST aplicar `verifyJWT` em todas as rotas
- MUST disparar `runConsolidation({ all: true })` após sync bem-sucedido (igual ao SIA)
- MUST montar router em `routes/api.js` em `/sih` (adicionar após `/sia`)
- MUST validar formato de competencia (`YYYY-MM`) antes de fazer spawn do Python
</requirements>

## Subtasks

- [x] 3.1 Criar `services/sih.js` com sincronizar(), getSyncProgress(), getCompetenciaImportada() seguindo estrutura de `services/sia.js`
- [x] 3.2 Criar `routes/sih.js` com os 6 endpoints: POST sincronizar, GET progresso, GET existe, GET sincronizacoes, GET internacoes, GET procedimentos
- [x] 3.3 Montar router `/sih` em `routes/api.js`
- [x] 3.4 Garantir que erro 409 retorna body SihConflictError completo e 503 retorna mensagem PT-BR
- [x] 3.5 Escrever testes Jest para serviço e rotas

## Implementation Details

Espelha `services/sia.js` e `routes/sia.js`. Ver TechSpec § Core Interfaces para assinaturas de `sincronizar()` e `getSyncProgress()`. Ver TechSpec § API Endpoints para contrato exato de cada rota (method, path, auth, body, response).

Diferença de `routes/sia.js`: endpoints `/internacoes` e `/procedimentos` em vez de `/producao`, e prefix `SIH_PROGRESS` nos eventos.

### Relevant Files

- `simpa-backend/src/services/sia.js` — modelo completo para sincronizar(), progress cache, spawn Python
- `simpa-backend/src/routes/sia.js` — modelo de router com gate 409 e consolidation trigger
- `simpa-backend/src/routes/api.js` — onde montar `/sih` (linha após `/sia`)
- `simpa-backend/src/middleware/requirePlanningStaff.js` — middleware de auth
- `simpa-backend/src/middleware/verifyJWT.js` — JWT middleware
- `simpa-backend/src/services/consolidator.js` — `runConsolidation()` a disparar após sync

### Dependent Files

- `simpa-frontend/src/api/sih.ts` (task_06) — consome endpoints criados aqui
- `routes/api.js` — modificado para montar `/sih`

### Related ADRs

- [ADR-002: Standalone sync_sih_mysql.py](adrs/adr-002.md) — CLI interface do Python script que este serviço chama
- [ADR-003: SIHD Import UI in /importacao](adrs/adr-003.md) — SihConflictError body consumido pelo frontend em /importacao

## Deliverables

- `simpa-backend/src/services/sih.js`
- `simpa-backend/src/routes/sih.js`
- `routes/api.js` atualizado com mount `/sih`
- `simpa-backend/tests/sih.test.js` (Jest — serviço)
- `simpa-backend/tests/sih.routes.test.js` (Jest — rotas)

## Tests

- Unit tests:
  - [ ] `sih.js sincronizar()` com mock Python subprocess que retorna JSON válido → resolve com SihImportResult
  - [ ] `sih.js sincronizar()` com competência já importada (mock getCompetenciaImportada = true) e `reimportar` ausente → retorna 409
  - [ ] `sih.js sincronizar()` com `reimportar: true` → passa `--reimportar` ao spawn Python
  - [ ] `sih.js getSyncProgress(unknownId)` → retorna null
  - [ ] Evento `SIH_PROGRESS {"stage":"extracao"}` em stderr → atualizado em progressRuns cache
  - [ ] `POST /api/sih/sincronizar` sem token JWT → 401
  - [ ] `POST /api/sih/sincronizar` com token não-planning → 403
  - [ ] `POST /api/sih/sincronizar` com competencia `2025-13` (mês inválido) → 400
  - [ ] `GET /api/sih/sincronizacoes/existe?competencia=2025-01` com competencia já importada → 200 com exists: true
  - [ ] `GET /api/sih/sincronizar/progresso/:id` com id desconhecido → 404
- Integration tests:
  - [ ] `POST /api/sih/sincronizar` com planning staff token e MySQL mock disponível → 200 com qtd_internacoes >= 0
  - [ ] `POST /api/sih/sincronizar` com MySQL indisponível → 503 com code 'SIH_MYSQL_UNAVAILABLE' e message em PT-BR
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `GET /api/sih/sincronizacoes` retorna array (pode estar vazio)
- `POST /api/sih/sincronizar` com competência nova → 200 (sem MySQL real, com mock)
- `POST /api/sih/sincronizar` repeat → 409 SihConflictError
