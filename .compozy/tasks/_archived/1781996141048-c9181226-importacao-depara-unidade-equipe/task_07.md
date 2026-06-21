---
status: completed
title: Frontend import API client and mapping types
type: frontend
complexity: medium
dependencies:
  - task_06
---

# Task 07: Frontend import API client and mapping types

## Overview

Add TypeScript types and API functions for enriched preview, upload with `resolucoes`, and mapeamentos CRUD. Extend `importacaoView.ts` helpers for mapping status display.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `simpa-frontend/src/types/importacao.ts` per TechSpec Core Interfaces
- MUST extend `PreviewCargaItem` or replace with enriched type in `importacaoView.ts`
- MUST implement `previewUpload`, `uploadCargas(files, resolucoes)`, mapeamentos CRUD in `api/importacao.ts`
- MUST serialize `resolucoes` as JSON field in multipart FormData on upload
- MUST add Vitest tests in `api/importacao.test.ts` and `importacaoView.test.ts`
</requirements>

## Subtasks
- [x] 07.1 Add types file with `PreviewCargaEnriquecida`, `ResolucaoUpload`, etc.
- [x] 07.2 Extend API client functions and FormData builder
- [x] 07.3 Add view helpers for mapping status labels and Todas conflict display
- [x] 07.4 Add Vitest coverage for API URL paths and payload shape

## Implementation Details

See TechSpec **Core Interfaces** TypeScript block and **API Endpoints**.

### Relevant Files
- `simpa-frontend/src/api/importacao.ts`
- `simpa-frontend/src/utils/importacaoView.ts`
- `simpa-frontend/src/api/client.ts` — apiFetch, FormData handling

### Dependent Files
- `simpa-frontend/src/pages/Importacao/UploadZone.tsx` — task_08

### Related ADRs
- [ADR-001: Mapping Registry with Preview Gate](adrs/adr-001.md)

## Deliverables
- Types and API client updates
- View helper updates
- Vitest tests with 80%+ coverage **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `uploadCargas` appends `resolucoes` JSON string to FormData
  - [x] `fetchMapeamentos` calls `/api/importacao/mapeamentos`
  - [x] `buildMappingStatusLabel('pending')` returns user-visible pending text
  - [x] Type guard or parser handles preview response with `sugestoes_estabelecimento` array
- Integration tests:
  - [ ] N/A
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80% on importacao API and view utils
- Types align with backend preview/upload contract from task_06
