# Task 09 — Memory (completed)

## Objective Snapshot

Migrate FilterBar, useDashboard, and equipes form from `fetchUnidades()` to establishments API. Submit `estabelecimento_id` on equipe create/update.

## Important Decisions

- APS-only for global filters and equipes dropdown (`ESTABELECIMENTOS_APS_QUERY = { perfil: 'APS', limit: 200 }`).
- New helper `fetchEstabelecimentosAps()` in `api/cadastros.ts`; mapping logic in `utils/estabelecimentosView.ts`.
- `fetchEquipes` now sends `estabelecimento_id` query param (not `unidade_id`).
- `CadastroCrudPage` maps legacy `unidade_id` on edit rows → `estabelecimento_id` form field.

## Learnings

- Dashboard keeps `Unidade` type from `contrato.ts`; estabelecimentos mapped at hook boundary.
- Mock json-server needs explicit paginated route handler — flat rewrite in `routes.json` insufficient.

## Files / Surfaces

- `api/cadastros.ts` — removed `fetchUnidades`, `PrestadorMac`, `Hospital`; added `fetchEstabelecimentosAps`
- `utils/estabelecimentosView.ts` + test
- `FilterBar.tsx`, `useDashboard.ts`, `CadastroCrudPage.tsx` + tests
- `mock/db.json` (estabelecimentos), `mock/routes.json`, `mock/server.cjs`
- `AppShell.integration.test.tsx`, `Cadastros.test.tsx` (equipe create with `estabelecimento_id`)

## Errors / Corrections

- None blocking; 21 task-09-related vitest tests pass.

## Ready for Next Run

- Task 09 done. Task 10 removes backend shim and dead code.
