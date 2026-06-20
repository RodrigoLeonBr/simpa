# Task 02 — Conditional perfil preservation in MySQL sync

## Objective Snapshot

UPSERT condicional: não sobrescrever `perfil` quando `perfil_editado=true`; INSERT com `perfil_editado=false`.

## Important Decisions

- Sync **não toca** tabelas `enriquecimento_*`.
- Inativação de ausentes no snapshot MySQL permanece; guard adicionado na review.

## Learnings

- Snapshot vazio (falha MySQL) inativava todo o cadastro — corrigido em review-001 issue_001.

## Files / Surfaces

- `sync_cadastros_mysql.py` — `UPSERT_ESTABELECIMENTO_SQL`, `_inactivate_estabelecimentos`
- `tests/test_sync_cadastros_mysql.py`

## Errors / Corrections

- Review-001: `_inactivate_*` retorna cedo se `snapshot_keys` vazio.

## Ready for Next Run

**Completed.** task_03 consome schema + flag sync.
