---
status: completed
title: Import mapping service (de-para, suggestions, Todas rules)
type: backend
complexity: high
dependencies:
  - task_01
---

# Task 02: Import mapping service (de-para, suggestions, Todas rules)

## Overview

Implement `importMappingService.js` with establishment name suggestions, registry lookup/upsert, team auto-create (`ensureEquipe`), and `"Todas"` conflict detection and purge logic. This service is the core orchestration layer for ADR-001 and ADR-003.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement `suggestEstabelecimentos(esusUnidadeLabel)` returning top 5 active establishments with score
- MUST implement registry lookup from `esus_import_mapeamentos` for unit and team keys
- MUST implement `ensureEquipe` creating INE-based teams or synthetic `TODAS-{estabelecimento_id}` team
- MUST implement `detectTodasConflict` for both incoming Todas and incoming specific-team scenarios per PRD
- MUST implement `purgeTodasImports` deleting cargas (CASCADE raw) and consolidated rows for Todas scope
- MUST implement `enrichPreviewItem` returning `mapeamento_status` resolved | pending | blocked
- MUST NOT auto-create establishments
- MUST use normalization aligned with TechSpec Name similarity section
</requirements>

## Subtasks
- [x] 02.1 Create `importMappingService.js` with SQL queries against `esus_import_mapeamentos`
- [x] 02.2 Implement name similarity scoring utility
- [x] 02.3 Implement `ensureEquipe` with idempotent create/reuse
- [x] 02.4 Implement Todas conflict detection and purge in a transaction
- [x] 02.5 Add unit tests in `simpa-backend/tests/importMapping.test.js`

## Implementation Details

See TechSpec **Core Interfaces** (`importMappingService.js` exports) and **Integration Points**.

### Relevant Files
- `simpa-backend/src/services/cadastrosService.js` — equipe create patterns
- `simpa-backend/src/services/estabelecimentosService.js` — establishment listing
- `scripts/cadastros_legacy_match.py` — prior match priority reference
- `parse_esus_csv.py` — `normalize_key` semantics reference

### Dependent Files
- `simpa-backend/src/routes/importacao.js` — task_06 consumer

### Related ADRs
- [ADR-001: Mapping Registry with Preview Gate](adrs/adr-001.md)
- [ADR-003: Node orchestration layer](adrs/adr-003.md)

## Deliverables
- `simpa-backend/src/services/importMappingService.js`
- `simpa-backend/tests/importMapping.test.js`
- Unit tests with 80%+ coverage **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `suggestEstabelecimentos('CAFI CENTRO DE ASSISTENCIA...')` ranks CAFI establishment first
  - [x] Registry hit returns `mapeamento_status: resolved` without suggestion requirement
  - [x] `ensureEquipe` with INE `0002200376` creates team linked to establishment
  - [x] `ensureEquipe` for `"Todas"` creates/reuses codigo `TODAS-{estabelecimento_id}`
  - [x] `detectTodasConflict` returns conflict when specific import follows Todas same month
  - [x] `detectTodasConflict` blocks new Todas when specific cargas exist
  - [x] `purgeTodasImports` removes esus_cargas and matching dados_consolidados row
- Integration tests:
  - [ ] N/A in this task (covered in task_06)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on importMappingService
- Service exports all functions listed in TechSpec Core Interfaces
