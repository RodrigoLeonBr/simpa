# Task Memory: task_05.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Serviços `listFormas` / `listCbos` com filtros `q`, `status`, `page`, `limit` (+ `grupo`/`subgrupo` em formas) — concluída.

## Important Decisions

- Query params `grupo`/`subgrupo` mapeiam para `codigo_grupo`/`codigo_subgrupo`; validação 2/4 chars alfanuméricos (400 se inválido).
- `status` restrito a `ativo`/`inativo`/`all` (400 se inválido) — mais estrito que `procedimentosService`.
- Ordenação estável: `ORDER BY codigo_forma` / `ORDER BY codigo_cbo`; limite máx. 200 (padrão procedimentos).

## Learnings

- Testes que inspecionam `query.mock.calls[0][1]` precisam `.slice()` — array de params é mutado com limit/offset antes da asserção.

## Files / Surfaces

- `simpa-backend/src/services/formasService.js` — `listFormas`, `mapFormaRow`
- `simpa-backend/src/services/cbosService.js` — `listCbos`, `mapCboRow`
- `simpa-backend/tests/formas.test.js`
- `simpa-backend/tests/cbos.test.js`

## Errors / Corrections

- Teste grupo/subgrupo: índices SQL `$2`/`$3` (status ocupa `$1`); params count query via `.slice(0, 3)`.

## Ready for Next Run

- Task 06: importar serviços em `routes/cadastros.js`; handlers GET `/formas` e `/cbos` repassam `req.query`.
- `_tasks.md` não existe no PRD dir — só `task_XX.md` individuais.
