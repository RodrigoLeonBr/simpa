# Task 04 — Cadastros API routes, auth, audit

## Objective Snapshot

`PUT /perfil`, `PUT /enriquecimento/:slug`; `requirePlanningStaff`; audit events; legado proxy/410.

## Important Decisions

- Roles de mutação: Administrador, Gestor Secretaria, Planejamento.
- Audit: `estabelecimento_perfil_update`, `estabelecimento_enriquecimento_update`.

## Learnings

- Legado `PUT …/enriquecimento` (sem slug) mantido como proxy para não quebrar clientes antigos.

## Files / Surfaces

- `simpa-backend/src/routes/cadastros.js`
- `simpa-backend/tests/estabelecimentos.routes.test.js`
- `simpa-backend/tests/integration/cadastros.integration.test.js`

## Errors / Corrections

- Nenhum blocker pós-review nesta task.

## Ready for Next Run

**Completed.** task_05 consome contrato HTTP.
