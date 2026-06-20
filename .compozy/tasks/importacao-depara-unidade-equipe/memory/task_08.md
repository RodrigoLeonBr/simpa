# Task 08 memory

## Done
- `PreviewMappingRow.tsx` — badges, e-SUS vs cadastro labels, picker + salvar mapeamento
- `TodasConflictModal.tsx` — ConfirmDialog wrapper for conflito Todas
- `UploadZone.tsx` — drafts, Process gate (`canEnableProcess`), resolucoes upload, modal flow
- `MapeamentosPanel.tsx` — list/search/edit/delete (planning staff)
- `Importacao/index.tsx` — subnav Importar | Mapeamentos
- CSS mapping badges/picker/subnav/table in `index.css`
- Vitest: UploadZone gate + Todas modal; Importacao tabs/panel; importacaoView helpers
- E2E `critical-flow.spec.ts` — select mapping picker when visible before Process

## Verify
- `npm test` frontend: 228 passed, ~88% stmt on pages/Importacao
- `npm run build` OK

## Notes
- `isRowReadyForProcess` for blocked+requires_confirm enables Process (modal sets confirm flag on upload)
- Non-planning users see hint; Process disabled
