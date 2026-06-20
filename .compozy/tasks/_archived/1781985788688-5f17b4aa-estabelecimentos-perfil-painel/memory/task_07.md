# Task 07 — Global painelPerfil in useFilters

## Objective Snapshot

Estado global `painelPerfil` (default APS); `setPainelPerfil` zera `unidadeId` e `equipeId`.

## Important Decisions

- Estado global em `useFilters`, não local no Painel (ADR-004).

## Learnings

- sessionStorage persiste filtros existentes; `painelPerfil` segue mesmo provider.

## Files / Surfaces

- `simpa-frontend/src/hooks/useFilters.tsx`
- `simpa-frontend/src/types/painel.ts`
- `simpa-frontend/src/hooks/useFilters.test.tsx`

## Errors / Corrections

- Nenhum.

## Ready for Next Run

**Completed.** task_08 consome `painelPerfil`.
