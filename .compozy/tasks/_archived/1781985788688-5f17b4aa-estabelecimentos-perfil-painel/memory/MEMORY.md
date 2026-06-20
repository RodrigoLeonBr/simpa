# Establishment Profile & Multi-Profile Painel — Workflow Memory

## Current State

- **Tasks 01–10 completed.** Review round 001: 11/11 issues **resolved**.
- Commits: `4c43959`, `8353acf`, `5e20371`.
- Agent docs: `CLAUDE.md`, `docs/agent/*` (pendente commit).
- **Arquivado** via `compozy archive --name estabelecimentos-perfil-painel`.

## Shared Decisions

- Enriquecimento manual: 5 tabelas `enriquecimento_*`; **não escrever** em `estabelecimentos.enriquecimento` JSONB.
- Perfil editável só via `PUT /perfil` → `perfil_editado = true`; sync preserva com `CASE WHEN perfil_editado`.
- Trocar perfil **não apaga** linhas de enriquecimento de outros perfis (ADR-003).
- Painel MVP: dashboard API APS-only; `painelPerfil` em `useFilters`; MAC/Hospitalar/Misto → placeholder.
- `canViewEnrichment` ≠ `canEditEnrichment`.

## Shared Learnings

- Sync snapshot MySQL vazio: guard em `_inactivate_*` (review-001).
- `upsertEnrichment`: transação + `FOR UPDATE`; leitos inteiros; deep-merge de `leitos`.
- Drawer: enriquecimento segue `perfilDraft`; bloquear submit se divergir do persistido.
- E2E: `npm run seed:e2e` após sync Docker inativar `E2E001–004`.

## Open Risks

- Jest coverage branches 75.9% < 80% (npm test falha apesar de testes OK).
- pytest `test_coverage.py`: 3 falhas pré-existentes.
- Fase 2 Painel: KPIs non-APS dependem de consolidator/API (ADR-004).

## Handoffs

- Docs pendentes de commit se ainda não mergeadas.
- KPIs MAC/Hospitalar/Misto: estender `PAINEL_KPI_CATALOGS` + backend antes de remover placeholder.
