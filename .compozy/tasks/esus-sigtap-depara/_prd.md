# PRD: e-SUS ↔ SIGTAP Procedure Mapping (De-Para)

## Overview

Municipal Planning and billing staff need a durable mapping between e-SUS APS catalog procedure labels and official SIGTAP codes. Today, several e-SUS report sections expose only human-readable labels (e.g. minor surgeries, odontological procedures), while others already embed SIGTAP codes. Without a maintained de-para, SIMPA cannot reliably turn e-SUS procedure counts into exportable ambulatory production nor align them with SIA production for analysis and amendment tracking.

This feature delivers a unified, editable catalog seeded from municipality-provided bases (plus native SIGTAP sections for one-stop consultation), in-app and repository documentation on how to use it, and MVP consumption by both procedure export and analytical cross-reference—silently skipping unmapped labels.

## Goals

- Persist an authoritative label → SIGTAP mapping maintained by Planning/billing without engineering changes.
- Seed the catalog from the provided spreadsheet bases and include native SIGTAP sections for unified consultation.
- Enable create/read/update/deactivate of mappings via a Cadastros experience consistent with existing master-data screens.
- In MVP, consume the same mapping for (1) e-SUS procedure export and (2) analytical e-SUS ↔ SIA alignment.
- Ship operator help in-product and a complete how-to in the repository describing seed, maintenance, and consumer rules.
- Unmapped procedures must not block processing (silent skip).

## User Stories

**Primary — Planning / billing analyst**
- As a Planning/billing analyst, I want to browse all e-SUS procedure labels and their SIGTAP codes so that I can verify coverage before export or analysis.
- As a Planning/billing analyst, I want to add or correct a mapping so that production export and SIA cross-checks use the right code.
- As a Planning/billing analyst, I want to deactivate an obsolete mapping so that it stops being used without deleting history of intent.
- As a Planning/billing analyst, I want short in-app guidance so that I know which fields matter and how export behaves with gaps.

**Secondary — SIMPA operator / implementer**
- As an implementer of the export pipeline, I want repository documentation of the lookup contract so that export and consolidator apply the same rules.
- As a dashboard user, I want e-SUS catalog procedures to resolve to SIGTAP when mapped so that I can compare APS production with SIA.

## Core Features

### 1. Unified de-para catalog (P0)
- Stores: e-SUS section/group, catalog label (exact match to report description), SIGTAP code, optional official SIGTAP description, origin (seeded spreadsheet / native SIGTAP section / manual), active flag.
- Uniqueness: one active mapping per (section + label). Native SIGTAP rows may key on code already present in the label.
- Seed: load municipality bases for catalog sections; load/parse native “code - description” sections into the same catalog for consultation.

### 2. CRUD for Planning/billing (P0)
- List with search/filter by section, label, SIGTAP code, active status.
- Create, edit, deactivate (soft) mappings.
- Quantity columns from spreadsheets are **not** product data (reference only during seed; not stored as business fields).

### 3. Dual consumption (P0)
- **Export:** generate MVP procedure export from e-SUS procedure quantities using active mappings; silently omit unmapped labels.
- **Analytics:** when consolidating/crossing e-SUS catalog procedures with SIA, resolve labels via the same active mappings; silently omit unmapped.

### 4. Documentation (P0)
- In-app short help on the Cadastros screen (purpose, required fields, silent-skip behavior).
- Repository guide covering: what the catalog is, how seed was loaded, how to maintain via CRUD, and how export/analytics look up mappings (exact section + label → active SIGTAP).

### 5. Later (not MVP)
- Coverage/gap reports, change audit trail, live validation against official SIGTAP package.

## User Experience

1. Analyst opens Cadastros → Procedimentos (e-SUS ↔ SIGTAP).
2. Sees seeded catalog grouped/filterable by section (e.g. Pequenas cirurgias, Procedimentos odonto, Outros procedimentos SIGTAP).
3. Searches a label or code; edits SIGTAP if wrong; creates missing rows; deactivates obsolete ones.
4. Reads brief help if unsure about silent skip / export use.
5. Runs export or views analytics; mapped items appear with SIGTAP; unmapped do not appear and do not block the flow.

UI should follow existing Cadastros patterns (table + form + inactivate). Accessibility: keyboard-reachable form controls, readable mono for codes.

## High-Level Technical Constraints

- Must integrate with existing e-SUS imported indicators (section + description labels) and with SIA production already keyed by SIGTAP.
- SIGTAP codes must be stored as official procedure identifiers (standard length/check digit); seed must be corrected via CRUD if spreadsheet digits were truncated.
- Mapping lookup for consumers is exact on e-SUS section + description text as imported.
- No requirement in this PRD for end-user authentication matrix beyond current Cadastros access pattern (auth roles may arrive later).

## Non-Goals (Out of Scope)

- Full DATASUS BPA-C/BPA-I file layout certification and CNES/FPO validation suite.
- Importing the entire national SIGTAP table as a living monthly package.
- Mapping CID/CIAP, CBO rules, or funding values.
- Blocking workflows or gap dashboards for unmapped items (deferred).
- Editing raw e-SUS import rows themselves.
- Using spreadsheet “Quantidade” as operational production (those counts come from each competência’s e-SUS load).

## Phased Rollout Plan

### MVP (Phase 1)
- Seed + unified catalog + CRUD + in-app help + repository how-to.
- Minimal procedure export using mappings; analytics cross-ref using mappings; silent skip.
- **Success:** Planning can correct a code and see it reflected in export/analytics without redeploy; docs explain the contract.

### Phase 2
- Coverage report of unmapped labels per competência; optional warning mode.
- Stronger export formatting toward ambulatory production needs.

### Phase 3
- Change history; optional validation against current SIGTAP competência; broader section coverage (e.g. collective practices) as bases become available.

## Success Metrics

- ≥ 95% of labels present in the provided seed bases loaded with a SIGTAP code after initial curation.
- Planning can create/edit/deactivate a mapping in under 2 minutes without engineering support.
- Export and analytics produce zero failures solely due to missing mappings (silent skip honored).
- Repository + in-app docs exist and are referenced by the export how-to section.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Truncated SIGTAP codes in screenshots/spreadsheets | Curate seed against official SIGTAP; allow immediate CRUD fix |
| Label text drift across e-SUS versions | Document exact-match rule; CRUD to add aliases/new labels when exports change |
| Silent skip hides missing production | Phase 2 coverage report; MVP docs state the behavior clearly |
| Duplicate confusion between catalog and native SIGTAP rows | Show origin/type; docs clarify when each appears |

## Architecture Decision Records

- [ADR-001: Catalog-first unified de-para with dual consumption](adrs/adr-001.md) — Unified editable catalog seeded from municipal bases + native SIGTAP sections; MVP consumes mapping for both export and analytics with silent skip of unmapped labels.

## Open Questions

- Exact MVP export artifact format expected by the municipality (internal CSV vs BPA-oriented layout) — confirm with Planning during TechSpec.
- Whether “Procedimentos - Teste rápido” and “Administração de medicamentos” are stored as separate sections or folded under “Pequenas cirurgias” in seed (spreadsheet mixed them visually).
- Final check-digit completion for every truncated code in the three provided images before seed sign-off.
