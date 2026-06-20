# Task 06 — Cadastros UI perfil + enrichment forms

## Objective Snapshot

Drawer com perfil editável; `EnrichmentFormByPerfil`; chip Misto; gate por role.

## Important Decisions

- SIA identity permanece locked; perfil é editável (planning staff).
- `canViewEnrichment` separado de `canEditEnrichment` (Visualizador lê forms readonly).

## Learnings

- Review-001: form de enriquecimento usa `perfilDraft`, não perfil persistido; hint + bloqueio submit se divergir.

## Files / Surfaces

- `EstabelecimentoDetailDrawer.tsx`, `EstabelecimentosPage.tsx`
- `EnrichmentFormByPerfil.tsx`, `enrichmentByPerfil.ts`, `enrichmentView.ts`

## Errors / Corrections

- Review-001: submit enriquecimento com perfil não salvo bloqueado.

## Ready for Next Run

**Completed.** task_10 E2E cobre fluxo drawer.
