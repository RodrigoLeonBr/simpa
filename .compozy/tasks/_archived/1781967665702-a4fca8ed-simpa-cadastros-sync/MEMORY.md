# SIMPA Cadastros Sync — Workflow Memory

## Current State

- **All 10 tasks completed.** Workflow ready for review round and archive.
- Deprecated backend routes removed; legacy entity paths return 404.
- Task 16 marked superseded in master SIMPA task list.

## Shared Decisions

- Synced entities: read-only UI; update via sync button.
- Enrichment: `Hospitalar` / `Misto` only; PUT `/estabelecimentos/:id/enriquecimento`.
- Filter/equipe dropdowns: **APS-only** via `fetchEstabelecimentosAps()` (`perfil=APS`, `limit=200`).
- Equipes API: `estabelecimento_id` on create/update and list filter; backend still accepts `unidade_id` query alias.
- Dashboard `Unidade` type (`types/contrato.ts`) kept for painel views; mapped from estabelecimentos via `estabelecimentosView.ts`.
- `_deprecated_*` PG tables kept renamed per TechSpec; FK verification script at `scripts/verify_deprecated_cadastros_fk.sql`.

## Shared Learnings

- Helper `fetchEstabelecimentosAps()` unwraps paginated response — consumers get flat `Estabelecimento[]`.
- `mapEstabelecimentosToUnidades()` bridges estabelecimentos → dashboard filter shape without changing painel components.
- Health check probes `estabelecimentos` table instead of legacy `unidades_saude`.
- PowerShell: chain with `;`, not `&&`.

## Open Risks

- None blocking archive. Playwright E2E (task_18) should target estabelecimentos/procedimentos grid, not legacy sub-routes.

## Handoffs

- **Review:** Run `/cy-review-round` or `compozy reviews fetch` before merge.
- **Archive:** `compozy archive --name simpa-cadastros-sync` when review is clean.
