---
status: completed
title: "SihImportSection.tsx — UI de importação SIHD em /importacao"
type: frontend
complexity: medium
dependencies:
  - task_06
---

# Task 07: SihImportSection.tsx — UI de importação SIHD em /importacao

## Overview

Cria o componente `SihImportSection.tsx` com seletor ano/mês, botão de importar, polling de progresso, histórico de syncs e ConfirmDialog para reimportação. Insere o componente na página `/importacao` (index.tsx) abaixo da seção e-SUS com divisor visual. Inclui os `data-testid` necessários para Playwright e os testes Vitest + E2E.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST criar `simpa-frontend/src/pages/Importacao/SihImportSection.tsx`
- MUST renderizar `<input type="month">` com default = mês anterior ao atual
- MUST chamar `sincronizarSih(competencia)` ao clicar "Importar internações AIH"
- MUST fazer polling de `getSihSyncProgress(executionId)` enquanto status = 'running' (intervalo de 2s)
- MUST exibir ConfirmDialog quando `sincronizarSih` rejeita com `isSihConflictError` (409), mostrando competência e qtd_internacoes do sync anterior
- MUST ao confirmar reimport: chamar `sincronizarSih(competencia, true)` (reimportar: true)
- MUST exibir toast de sucesso com qtd_internacoes, qtd_procedimentos e orphan_cnes após sync OK
- MUST exibir mensagem PT-BR de erro quando backend retorna 503 (MySQL indisponível)
- MUST renderizar tabela de histórico com dados de `getSihSincronizacoes()` (competencia, status, qtd_internacoes, qtd_procedimentos, sincronizado_em)
- MUST incluir `data-testid` nos elementos: `sih-import-competencia`, `sih-import-btn`, `sih-confirm-dialog`, `sih-history-table`
- MUST renderizar em `pages/Importacao/index.tsx` abaixo da seção e-SUS com `<hr />` ou divisor Tailwind
- SHOULD reutilizar estilos e padrões visuais de `SiaProducaoSyncBanner.tsx` (botões, loaders, toasts)
</requirements>

## Subtasks

- [x] 7.1 Criar `SihImportSection.tsx` com seletor mês, botão, handler de submit e polling de progresso
- [x] 7.2 Adicionar ConfirmDialog para caso 409, exibindo metadados do sync anterior
- [x] 7.3 Adicionar tabela de histórico de syncs e toast de resultado
- [x] 7.4 Inserir `<SihImportSection />` em `pages/Importacao/index.tsx`
- [x] 7.5 Escrever testes Vitest para SihImportSection.tsx
- [x] 7.6 Escrever teste Playwright `e2e/sih-import.spec.ts`

## Implementation Details

Ver TechSpec § Integration Points (seção "Frontend") para UX flow completo. Ver ADR-003 para decisão de localização na página /importacao.

Padrão de referência de UI: `pages/Cadastros/SiaProducaoSyncBanner.tsx` para seletor mês, botão de sync, loading state e toast. Padrão de ConfirmDialog: `pages/Importacao/TodasConflictModal.tsx`.

Padrão de polling: usar `useEffect` com `setInterval` limpo no cleanup, ou `useCallback` com setTimeout encadeado.

### Relevant Files

- `simpa-frontend/src/pages/Cadastros/SiaProducaoSyncBanner.tsx` — modelo de seletor mês + botão + toast
- `simpa-frontend/src/pages/Importacao/index.tsx` — onde inserir SihImportSection
- `simpa-frontend/src/pages/Importacao/TodasConflictModal.tsx` — padrão de ConfirmDialog
- `simpa-frontend/src/api/sih.ts` (task_06) — funções consumidas
- `simpa-frontend/src/types/sih.ts` (task_06) — tipos usados
- `simpa-frontend/tests/e2e/helpers.ts` — helpers Playwright existentes
- `simpa-frontend/tests/e2e/critical-flow.spec.ts` — padrão de spec Playwright

### Dependent Files

- `simpa-frontend/src/pages/Importacao/index.tsx` — inserção do novo componente
- `simpa-frontend/tests/e2e/sih-import.spec.ts` — novo teste E2E

### Related ADRs

- [ADR-003: SIHD Import UI in /importacao](adrs/adr-003.md) — decisão de localização UI

## Deliverables

- `simpa-frontend/src/pages/Importacao/SihImportSection.tsx`
- `simpa-frontend/src/pages/Importacao/index.tsx` atualizado
- `simpa-frontend/src/pages/Importacao/SihImportSection.test.tsx` (Vitest)
- `simpa-frontend/tests/e2e/sih-import.spec.ts` (Playwright)

## Tests

- Unit tests (Vitest):
  - [ ] Componente renderiza `<input type="month">` com valor = mês anterior ao mês atual
  - [ ] Clicar "Importar internações AIH" chama `sincronizarSih` com a competencia selecionada
  - [ ] Quando `sincronizarSih` rejeita com `isSihConflictError`, ConfirmDialog aparece com competencia e qtd_internacoes
  - [ ] Ao confirmar no ConfirmDialog: chama `sincronizarSih(competencia, true)` (reimportar: true)
  - [ ] Ao cancelar ConfirmDialog: não chama sincronizarSih novamente
  - [ ] Após sync com status 'ok': toast mostra qtd_internacoes, qtd_procedimentos, orphan_cnes
  - [ ] Erro 503 (SIH_MYSQL_UNAVAILABLE) exibe mensagem "Banco SIHD (XAMPP) indisponível..."
  - [ ] Tabela de histórico renderiza rows de getSihSincronizacoes com colunas: competencia, status, qtd_internacoes, sincronizado_em
- Integration tests (Playwright e2e/sih-import.spec.ts):
  - [ ] Usuário planning staff navega a /importacao, encontra seção SIHD, seleciona competencia, clica importar → toast de sucesso ou mensagem MySQL indisponível
  - [ ] Segunda importação da mesma competencia → ConfirmDialog aparece com texto mencionando "substituir"
  - [ ] ConfirmDialog cancelar → sem nova chamada de API
  - [ ] ConfirmDialog confirmar → sync executado, toast atualiza qtd_internacoes
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `/importacao` renderiza seção SIHD abaixo da seção e-SUS
- Seletor mês default = mês anterior correto
- ConfirmDialog aparece na segunda importação da mesma competência
- data-testid presentes: sih-import-competencia, sih-import-btn, sih-confirm-dialog, sih-history-table
