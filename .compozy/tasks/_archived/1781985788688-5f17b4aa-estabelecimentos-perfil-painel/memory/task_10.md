# Task 10 — Playwright E2E perfil + multi-profile Painel

## Objective Snapshot

Spec dedicado `perfil-painel.spec.ts`: edit perfil cadastros, placeholder MAC, layouts APS A/C.

## Important Decisions

- Spec separado de `critical-flow.spec.ts` (escopo focado).
- Seed `E2E001–004` em `simpa-backend/scripts/seed-e2e-estabelecimentos.js`.

## Learnings

- Sync Docker inativa seeds E2E → `npm run seed:e2e` (`ON CONFLICT DO UPDATE` reativa `status='ativo'`).
- Busca por `E2E001` antes de abrir drawer (commit `5e20371`).
- CI: step seed E2E em `.github/workflows/ci.yml`.

## Files / Surfaces

- `simpa-frontend/tests/e2e/perfil-painel.spec.ts`, `helpers.ts`
- `simpa-backend/scripts/seed-e2e-estabelecimentos.js`
- `package.json` (`seed:e2e`)

## Errors / Corrections

- Flake inicial: rows `inativo` no Docker; resolvido com seed reativador + search.

## Ready for Next Run

**Completed.** Workflow terminal; review-001 resolvido; arquivar workflow.
