---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T22:05:00Z
status: resolved
file: simpa-frontend/src/pages/Importacao/UploadZone.tsx
line: 144
severity: medium
author: claude-code
provider_ref:
---

# Issue 006: Todas confirm uses stale drafts closure

## Review Comment

`handleConfirmTodas` calls `setDrafts` with a functional updater, but builds `nextDrafts` from the stale `drafts` closure when calling `buildResolucoesUpload(preview, nextDrafts)`. If the operator toggles “Salvar mapeamento” or changes establishment between opening the modal and confirming, the upload may omit `confirmar_remocao_todas` or other draft fields.

**Suggested fix:** Build resolucoes from the functional update result, or compute `nextDrafts` inline from `(current) => ({ ...current, [nome]: { ... } })` and pass that object to upload without reading closed-over state.

## Triage

- Decision: `valid`
- Root cause: Functional `setDrafts` updater runs deferred in React 19; `resolucoes` was built before updater executed, so `confirmar_remocao_todas` was never included. Stale `drafts` closure also ignored mid-modal edits.
- Fix: `draftsRef` synced on each render; `handleConfirmTodas` builds `nextDrafts` from `draftsRef.current`, computes `resolucoes` synchronously, then `setDrafts(nextDrafts)` before upload.
- Verification: `UploadZone.test.tsx` — “shows Todas conflict modal and confirms upload with flag” passes with `confirmar_remocao_todas: true`.
