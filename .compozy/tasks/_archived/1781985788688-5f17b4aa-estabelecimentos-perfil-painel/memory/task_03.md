# Task 03 — Backend estabelecimentos service

## Objective Snapshot

`updatePerfil`, `upsertEnrichment` por slug, GET com JOIN do perfil ativo; fim de writes JSONB.

## Important Decisions

- Slug deve alinhar com `estabelecimentos.perfil` (403 se mismatch).
- `updateEnriquecimento` legado redireciona para `upsertEnrichment` (Hospitalar/Misto).

## Learnings

- Review-001: `upsertEnrichment` em transação com `SELECT … FOR UPDATE` (TOCTOU).
- Leitos validados como inteiros ≥ 0; merge parcial de `leitos` é deep-merge.

## Files / Surfaces

- `simpa-backend/src/services/estabelecimentosService.js`
- `simpa-backend/tests/estabelecimentos.test.js`

## Errors / Corrections

- Review-001: race entre validação perfil e upsert eliminada com lock de linha.

## Ready for Next Run

**Completed.** task_04 expõe rotas.
