# Idea — Dynamic Painel Indicators (Cadastro + Runtime)

**Source:** Brainstorm 2026-06-20  
**Refs:** `docs/superpowers/specs/2026-06-20-painel-widgets-dinamicos-design.md`, `.cursor/plans/painel_widgets_spec_81aac582.plan.md`

## Problem

SIMPA Painel APS (Layout A) shows 6 KPI cards and 2 charts hardcoded in frontend code. Planning staff cannot change which indicators appear or which production metrics they reflect without a developer deploy.

Competência and unidade filters already work; indicator composition does not.

## Desired outcome

- Cadastro in `/cadastros/` for Planning/Admin to configure Painel widgets (card vs chart, metric source).
- Flat discoverable metric catalog from imported e-SUS loads (primary picker).
- SQL query visible to admin for transparency (read-only preview in MVP).
- Restrict configuration to Administrador + Planejamento roles.
- MVP scope: APS profile, Layout A only — parity with current 6+2 layout.

## Already delivered (Phase 0)

- `migration_008`: `painel_metricas_catalogo` (10 seeded metrics) + `painel_widgets` (8 seeded widgets APS Layout A).
- Painel runtime unchanged — still uses hardcoded `buildPainelKpis()`.

## Backlog modules (implementation order TBD)

A Executor · B CRUD API · C Runtime API · D Cadastro UI · E Painel dynamic · F Discovery job · G Layouts B/C & other profiles · H Link `indicadores` table · I E2E · J Docs
