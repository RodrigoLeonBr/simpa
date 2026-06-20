# Task 01 — Database migration 005 and enrichment backfill

## Objective Snapshot

Schema `perfil_editado` + 5 tabelas `enriquecimento_*`; backfill JSONB → hospitalar; mount Docker init.

## Important Decisions

- JSONB legado permanece; writes novos vão às tabelas normalizadas.
- Backfill idempotente com `ON CONFLICT DO UPDATE` (review-001: preenche vazios sem sobrescrever dados).

## Learnings

- `capacidade_notas` incluída no backfill além de `leitos`.
- Verificação via `tests/test_migration_005.py`, não unit puro.

## Files / Surfaces

- `migration_005_estabelecimentos_perfil_enrichment.sql`
- `docker-compose.yml` (init mount `05-migration_005_…`)
- `tests/test_migration_005.py`

## Errors / Corrections

- Review-001: backfill ajustado para `ON CONFLICT DO UPDATE` em campos vazios.

## Ready for Next Run

**Completed.** task_02 depende de coluna `perfil_editado`.
