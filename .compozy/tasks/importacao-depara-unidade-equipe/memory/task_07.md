# Task Memory: task_07.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- Added `types/importacao.ts`, extended `api/importacao.ts` + `importacaoView.ts`; 20 unit tests; importacao.ts 100% / importacaoView.ts 100% line coverage.

## Important Decisions

- `PreviewCargaItem` re-exported as alias of `PreviewCargaEnriquecida` for gradual UI migration (task_08).
- `uploadCargas(files, resolucoes)` required; UploadZone stub passes `[]` until task_08 wiring.
- `buildUploadFormData` exported for testability.
- Mapeamentos CRUD: `fetchMapeamentos`, `createMapeamento`, `updateMapeamento`, `deleteMapeamento`.

## Learnings

- `PreviewCargaEnriquecida.equipe_nome` serves cadastro resolved name; `esus_equipe_nome` for e-SUS text — no duplicate field.
- Vitest global 80% threshold requires full suite run, not subset only.

## Files / Surfaces

- `simpa-frontend/src/types/importacao.ts`
- `simpa-frontend/src/api/importacao.ts`
- `simpa-frontend/src/utils/importacaoView.ts`
- `simpa-frontend/src/api/importacao.test.ts`
- `simpa-frontend/src/utils/importacaoView.test.ts`
- `simpa-frontend/src/pages/Importacao/UploadZone.tsx` (minimal label/stub)

## Errors / Corrections

- Fixed TS duplicate `equipe_nome` in types file.

## Ready for Next Run

- task_08: UploadZone mapping pickers, Process gate, resolucoes builder, Todas modal.
- task_09: dashboard fetch by IDs (depends on 07 types optionally).
