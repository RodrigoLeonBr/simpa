# Task 05 — Frontend API types and cadastros client

## Objective Snapshot

Types `EnrichmentSlug`, `perfil_editado`; client `updatePerfil`, `updateEnrichmentBySlug`; query genérica por perfil.

## Important Decisions

- `buildEstabelecimentosPerfilQuery(perfil)` substitui padrão APS-only; alias `fetchEstabelecimentosAps` preservado.

## Learnings

- `EstabelecimentoPerfilFilter` estendido com `'Misto'`.

## Files / Surfaces

- `simpa-frontend/src/types/cadastros.ts`, `types/painel.ts`
- `simpa-frontend/src/api/cadastros.ts`
- `simpa-frontend/src/utils/estabelecimentosView.ts`
- `simpa-frontend/src/api/cadastros.test.ts`

## Errors / Corrections

- Nenhum.

## Ready for Next Run

**Completed.** task_06 (UI) e task_07 (filters) em paralelo lógico após esta.
