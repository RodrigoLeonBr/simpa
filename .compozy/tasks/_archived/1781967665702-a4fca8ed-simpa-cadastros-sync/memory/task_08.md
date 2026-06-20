# Task 08 — Memory (completed)

## Objective Snapshot

Frontend Establishments + Procedures pages: profile-filtered list, locked SIA fields, hospital enrichment drawer, read-only procedimentos search. Supersedes legacy unidades/MAC/hospitais CRUD pages.

## Important Decisions

- Detail panel via `ModalPortal` drawer (`EstabelecimentoDetailDrawer`), not inline edit.
- `ReadOnlyDataTable` for synced lists; `DataTable` kept only for equipes/emendas CRUD.
- `CadastroPlaceholder` removed; real routes wired in `pages/Cadastros/index.tsx`.

## Learnings

- Enrichment form: `noValidate` required on `<form>` for negative leitos validation tests.
- Locked fields use disabled inputs + 🔒 + `data-testid="locked-field-*"`.

## Files / Surfaces

- `pages/Cadastros/EstabelecimentosPage.tsx`, `ProcedimentosPage.tsx`, `EstabelecimentoDetailDrawer.tsx`
- `components/cadastros/EnrichmentForm.tsx`, `ReadOnlyDataTable.tsx`
- `utils/enrichmentView.ts`, `types/cadastros.ts` (expanded)
- `api/cadastros.ts` — `fetchEstabelecimentos`, `updateEnriquecimento`, `fetchProcedimentos`
- Tests: `EstabelecimentosPage.test.tsx`, `ProcedimentosPage.test.tsx`, `EnrichmentForm.test.tsx`, `enrichmentView.test.ts`

## Errors / Corrections

- `enrichmentView.ts` corrupted import line during edit — rewrote file.
- `EstabelecimentoDetailDrawer.tsx` missing `ReactNode` import — fixed.
- Cadastros CRUD tests: "Autor" matched table header — use unique cell text instead.

## Ready for Next Run

- Task 08 done. 24 cadastros-related vitest tests pass. Hand off to task 09 for global filter migration.
