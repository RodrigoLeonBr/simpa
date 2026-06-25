---
status: completed
title: "Frontend — types/sih.ts + api/sih.ts"
type: frontend
complexity: low
dependencies:
  - task_03
---

# Task 06: Frontend — types/sih.ts + api/sih.ts

## Overview

Cria os tipos TypeScript `types/sih.ts` (SihSincronizacao, SihImportResult, SihConflictError) e o cliente HTTP `api/sih.ts` com funções para os 6 endpoints SIHD. Estes artefatos são a base compartilhada consumida por `SihImportSection.tsx` (task_07) e pelos hooks do Painel Hospitalar (task_08).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST criar `simpa-frontend/src/types/sih.ts` com interfaces: `SihSincronizacao`, `SihImportResult`, `SihConflictError`, `SihProgress`, `SihInternacao`, `SihProcedimento` conforme TechSpec § Data Models (TypeScript types)
- MUST criar `simpa-frontend/src/api/sih.ts` com funções: `sincronizarSih(competencia, reimportar?)`, `getSihSincronizacoes()`, `getSihSincronizacaoExiste(competencia)`, `getSihSyncProgress(executionId)`, `getSihInternacoes(params)`, `getSihProcedimentos(params)`
- MUST usar `apiFetch` (client.ts) como todas as outras funções em `api/*.ts`
- MUST exportar `isSihConflictError(error)` type guard para detectar 409 no frontend
- MUST manter `status` em `SihSincronizacao` como union type `'ok' | 'parcial' | 'erro' | 'pendente'`
- SHOULD seguir convenções de nomenclatura de `api/sia.ts` e `types/sia.ts`
</requirements>

## Subtasks

- [x] 6.1 Criar `types/sih.ts` com todas as interfaces conforme TechSpec § Data Models
- [x] 6.2 Criar `api/sih.ts` com as 6 funções de API e type guard `isSihConflictError`
- [x] 6.3 Escrever testes Vitest para api/sih.ts (mock fetch)

## Implementation Details

Ver TechSpec § Data Models para tipagem exata de `SihSincronizacao`, `SihImportResult` e `SihConflictError`. Ver TechSpec § API Endpoints para URLs e contratos de request/response.

Padrões de referência: `simpa-frontend/src/api/sia.ts` e `simpa-frontend/src/types/sia.ts`.

### Relevant Files

- `simpa-frontend/src/api/sia.ts` — modelo de funções API (sincronizarSiaProducao, fetchSiaSincronizacoes, etc.)
- `simpa-frontend/src/types/sia.ts` — modelo de tipagem
- `simpa-frontend/src/api/client.ts` — `apiFetch` helper a usar
- `simpa-frontend/src/api/importacao.ts` — padrão de tratamento de 409

### Dependent Files

- `simpa-frontend/src/pages/Importacao/SihImportSection.tsx` (task_07) — importa de api/sih.ts
- `simpa-frontend/src/pages/Painel/` (task_08) — pode usar getSihInternacoes para KPI cards

## Deliverables

- `simpa-frontend/src/types/sih.ts`
- `simpa-frontend/src/api/sih.ts`
- `simpa-frontend/src/api/sih.test.ts` (Vitest)

## Tests

- Unit tests:
  - [ ] `sincronizarSih('2025-01')` faz POST `/api/sih/sincronizar` com body `{competencia: '2025-01'}`
  - [ ] `sincronizarSih('2025-01', true)` inclui `reimportar: true` no body
  - [ ] `getSihSincronizacaoExiste('2025-01')` faz GET `/api/sih/sincronizacoes/existe?competencia=2025-01`
  - [ ] `isSihConflictError(err)` retorna true quando err.code === 'SIH_COMPETENCIA_JA_IMPORTADA'
  - [ ] `isSihConflictError(err)` retorna false para erros genéricos
  - [ ] `getSihSyncProgress('abc-123')` faz GET `/api/sih/sincronizar/progresso/abc-123`
- Integration tests:
  - [ ] Tipos SihSincronizacao e SihImportResult são satisfeitos por response mock do backend
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `import { sincronizarSih } from '@/api/sih'` compila sem erros TypeScript
- Type guard `isSihConflictError` discrimina corretamente 409 de outros erros
