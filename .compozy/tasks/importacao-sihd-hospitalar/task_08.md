---
status: pending
title: "Painel Hospitalar — catalogView Layout A ativo + badge status em Cadastros"
type: frontend
complexity: medium
dependencies:
  - task_05
  - task_06
---

# Task 08: Painel Hospitalar — catalogView Layout A ativo + badge status em Cadastros

## Overview

Ativa o perfil Hospitalar no Painel alterando `catalogView.ts` (Layout A de `pending` para `ready`). Os widgets do Layout A Hospitalar já são dinâmicos via `painelMetricsService` com seeds inseridos em task_01 — não é necessário novo componente de layout. Também adiciona um `SihSyncStatusBadge` read-only em `pages/Cadastros/` que exibe o status do último sync SIHD com link para `/importacao`. Inclui testes Vitest e Playwright de regressão do Painel.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST alterar `simpa-frontend/src/utils/painel/catalogView.ts`: Hospitalar Layout A de `'pending'` → `'ready'`
- MUST NOT alterar Hospitalar Layout B ou C (continuam `'pending'`)
- MUST verificar que `LayoutA.tsx` já renderiza widgets dinâmicos para o perfil Hospitalar sem código novo (usando painelMetricsService + seeds da task_01)
- MUST criar `SihSyncStatusBadge.tsx` em `pages/Cadastros/` mostrando: ícone status (verde/amarelo/vermelho), texto "SIHD · AIH" + competência e data do último sync, link para `/importacao`
- MUST buscar dados do badge via `getSihSincronizacoes()` filtrado pelo sync mais recente com status 'ok'
- MUST incluir `data-testid="sih-sync-badge"` no badge
- MUST inserir `<SihSyncStatusBadge />` na página Cadastros (index.tsx ou EstabelecimentosPage.tsx — verificar padrão com SiaProducaoSyncBanner)
- MUST atualizar `moduleStatusView.ts` se necessário para refletir dados reais de `hospitalar_sihd.status_importacao` (já lê do contrato — verificar se mudança de tipo em task_05 requer ajuste)
- SHOULD adicionar teste Playwright de regressão: Painel com perfil Hospitalar não crashar e renderizar Layout A
</requirements>

## Subtasks

- [ ] 8.1 Alterar `catalogView.ts`: Hospitalar A → `'ready'`
- [ ] 8.2 Verificar que LayoutA.tsx renderiza widgets Hospitalar sem código adicional (widgets vêm dos seeds do PG)
- [ ] 8.3 Criar `SihSyncStatusBadge.tsx` com fetch do último sync SIHD e link para /importacao
- [ ] 8.4 Inserir `<SihSyncStatusBadge />` em Cadastros junto com SiaProducaoSyncBanner
- [ ] 8.5 Ajustar `moduleStatusView.ts` se o tipo ModuloSIHD expandido requer mudanças de leitura
- [ ] 8.6 Escrever testes Vitest para SihSyncStatusBadge e regressão de catalogView
- [ ] 8.7 Escrever teste Playwright de regressão: Painel Hospitalar Layout A carrega sem erro

## Implementation Details

Ver TechSpec § Impact Analysis para lista de arquivos modificados. Ver TechSpec § Integration Points (seção "Painel Widget Seeds") para confirmar que seeds em migration_013 já alimentam Layout A.

`moduleStatusView.ts` já lê `data.modulos?.hospitalar_sihd?.status_importacao` — verificar se a expansão de ModuloSIHD (task_05) precisa de ajuste aqui (provavelmente não, pois os campos novos são opcionais).

`SihSyncStatusBadge` segue visual de `CadastroSyncBanner.tsx` — verificar cores e ícones usados lá.

### Relevant Files

- `simpa-frontend/src/utils/painel/catalogView.ts` — alterar Hospitalar A pending → ready
- `simpa-frontend/src/utils/painel/moduleStatusView.ts` — lê hospitalar_sihd.status_importacao
- `simpa-frontend/src/pages/Painel/LayoutA.tsx` — verificar se aceita perfil Hospitalar sem mudança
- `simpa-frontend/src/pages/Painel/LayoutA.test.tsx` — testes de regressão
- `simpa-frontend/src/pages/Cadastros/CadastroSyncBanner.tsx` — modelo visual para badge
- `simpa-frontend/src/pages/Cadastros/SiaProducaoSyncBanner.tsx` — modelo de posicionamento
- `simpa-frontend/src/pages/Cadastros/index.tsx` — onde inserir SihSyncStatusBadge
- `simpa-frontend/src/api/sih.ts` (task_06) — getSihSincronizacoes() usado pelo badge
- `simpa-frontend/tests/e2e/perfil-painel.spec.ts` — testes E2E de perfil existentes

### Dependent Files

- `simpa-frontend/src/pages/Cadastros/index.tsx` — inserção do badge
- `simpa-frontend/tests/e2e/` — novo spec de regressão Hospitalar

### Related ADRs

- [ADR-001: Dual-Table Hybrid Storage](adrs/adr-001.md) — Layout A usa dados de sih_internacoes (via widgets) e sih_procedimentos
- [ADR-003: SIHD Import UI in /importacao](adrs/adr-003.md) — badge em Cadastros linka para /importacao

## Deliverables

- `simpa-frontend/src/utils/painel/catalogView.ts` atualizado (1 linha)
- `simpa-frontend/src/pages/Cadastros/SihSyncStatusBadge.tsx`
- `simpa-frontend/src/pages/Cadastros/SihSyncStatusBadge.test.tsx` (Vitest)
- `simpa-frontend/src/pages/Cadastros/index.tsx` atualizado
- `simpa-frontend/tests/e2e/sih-painel-hospitalar.spec.ts` (Playwright)
- `moduleStatusView.ts` ajustado se necessário (baixo risco)

## Tests

- Unit tests (Vitest):
  - [ ] `catalogView.ts`: `isPainelCatalogReady('Hospitalar', 'A')` retorna true após alteração
  - [ ] `catalogView.ts`: `isPainelCatalogReady('Hospitalar', 'B')` ainda retorna false
  - [ ] `catalogView.ts`: `isPainelCatalogReady('Hospitalar', 'C')` ainda retorna false
  - [ ] `SihSyncStatusBadge` com getSihSincronizacoes retornando sync 'ok' → renderiza ícone verde e competência
  - [ ] `SihSyncStatusBadge` com getSihSincronizacoes retornando array vazio → renderiza estado "Sem importação"
  - [ ] `SihSyncStatusBadge` contém link href="/importacao"
  - [ ] `SihSyncStatusBadge` tem data-testid="sih-sync-badge"
  - [ ] LayoutA com perfil Hospitalar e widgets vazio → renderiza PainelProfilePlaceholder ou grid vazio (não crasha)
- Integration tests (Playwright sih-painel-hospitalar.spec.ts):
  - [ ] Usuário navega ao Painel, seleciona perfil Hospitalar → Layout A renderiza sem erro de runtime
  - [ ] Badge "SIHD · AIH" em Cadastros exibe status e clicando leva a /importacao
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- Painel Hospitalar Layout A não exibe `PainelProfilePlaceholder` (catalog = ready)
- Badge SIHD visível em Cadastros com link correto
- Testes existentes em LayoutA.test.tsx e perfil-painel.spec.ts continuam verdes
