---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T22:05:00Z
status: resolved
file: simpa-backend/src/services/dashboardService.js
line: 36
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: Dashboard ID query lacks legacy name fallback

## Review Comment

TechSpec states dashboard queries use ID lookup **with legacy name fallback** for unmigrated rows. `buildDashboardQuery()` switches exclusively to ID predicates when both IDs are provided; if no row matches FKs, the service returns 404 without attempting `(unidade, equipe)` text match.

During MVP transition, cargas/consolidados imported before migration 006 (or reprocessados without FKs) remain queryable only by text. Operators using ID-based Panel filters will see empty charts even when legacy consolidated rows exist for the same unit/month.

**Suggested fix:** After an ID query miss, optionally retry with cadastro display names from `estabelecimentos`/`equipes`, or document Phase 2 backfill as mandatory before ID-only Panel. Log `dashboard.miss` for both attempts.

## Triage

- Decision: `valid`
- Root cause: ID-only query had no retry path for legacy `(unidade, equipe)` rows.
- Fix: Added `fetchCadastroLabels()`; on miss with both IDs, retry `buildDashboardQuery` using cadastro names. `dashboard.miss` logged when estab filter present and still no row.
- Verification: `dashboardService.test.js` — legacy fallback returns 200 when ID miss but text row exists.
