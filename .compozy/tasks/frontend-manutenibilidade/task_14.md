---
status: pending
title: Split EnrichmentFormByPerfil by perfil
type: frontend
complexity: high
dependencies: []
---

# Task 14: Split EnrichmentFormByPerfil by perfil

## Overview

Break 418-line EnrichmentFormByPerfil into per-perfil components under `components/cadastros/enrichment/`.

<requirements>
- MUST create EnrichmentApsForm, MacForm, HospitalarForm, MistoForm (+ shared fields file)
- MUST keep orchestrator mapping perfil → component
- MUST NOT change enrichment payload semantics (enrichmentByPerfil.ts)
- MUST run estabelecimentos-related tests/E2E if available
</requirements>

## Subtasks

- [ ] 14.1 Create enrichment/ folder structure
- [ ] 14.2 Move APS form first; verify drawer
- [ ] 14.3 Move remaining perfis; delete dead code from monolith

## Relevant Files
- `simpa-frontend/src/components/cadastros/EnrichmentFormByPerfil.tsx`
- `simpa-frontend/src/utils/enrichmentByPerfil.ts`

## Success Criteria
- No file in enrichment/ > 200 lines
- Enrichment save/load unchanged
