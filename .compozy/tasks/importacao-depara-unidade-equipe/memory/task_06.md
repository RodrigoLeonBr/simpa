# Task Memory: task_06.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

- Wired `importMappingService` into `routes/importacao.js`: enriched preview, upload+resolucoes, mapeamentos CRUD, cargas JOIN; 33 unit + 4 integration Jest tests; 84% stmt on `importacao.js`.

## Important Decisions

- Upload gated with `requirePlanningStaff`; preview open to all JWT users.
- Upload requires `resolucoes` JSON array matching filenames; 409 bubbles from `resolveForUpload`.
- Per-file parser errors return row `error` (422 batch if any errors); preview catches per file.
- `updateArquivoPath` / `triggerConsolidation` dual path: IDs when resolved, legacy text otherwise.
- Integration test mocks `resolveForUpload`; detects partial unique indexes for upsert SQL.

## Learnings

- Jest full mock of `importMappingService` breaks `competenciaDate` — use `requireActual` + mock only async exports.
- Partial unique index ON CONFLICT needs `WHERE estabelecimento_id IS NOT NULL AND equipe_id IS NOT NULL`.
- Legacy text UNIQUE on `esus_cargas` coexists with ID index — integration cleanup must delete both keys.

## Files / Surfaces

- `simpa-backend/src/routes/importacao.js`
- `simpa-backend/tests/importacao.test.js`
- `simpa-backend/tests/integration/importacao.integration.test.js`

## Errors / Corrections

- Fixed test mock for competenciaDate; integration INSERT ON CONFLICT + cleanup for dual UNIQUE.

## Ready for Next Run

- task_07: frontend `api/importacao.ts` types + client for new contract.
- task_09: Painel fetch dashboard by IDs (depends on 07).
