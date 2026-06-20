---
provider: manual
pr:
round: 1
round_created_at: 2026-06-20T19:30:18Z
status: resolved
file: migration_005_estabelecimentos_perfil_enrichment.sql
line: 70
severity: medium
author: claude-code
provider_ref:
---

# Issue 007: Backfill de enriquecimento legado incompleto e não corretivo

## Review Comment

O `INSERT` de backfill para `enriquecimento_hospitalar` (linhas 70–99) copia `leitos`, `especialidades`, `habilitacoes` e `notas`, mas omite `capacidade_notas` presente na tabela nova (ADR-003). Além disso, `ON CONFLICT (estabelecimento_id) DO NOTHING` (linhas 99, 124) impede atualizar linhas já existentes com defaults vazios — estabelecimentos com JSONB legado não vazio podem ficar com tabela normalizada vazia após re-run ou seed parcial.

**Correção sugerida:** incluir `capacidade_notas` no SELECT de backfill; usar `ON CONFLICT DO UPDATE` que só preenche colunas ainda vazias, ou script de backfill idempotente separado.

## Triage

- Decision: `valid`
- Notes: Backfill hospitalar inclui `capacidade_notas`; `ON CONFLICT DO UPDATE` preenche colunas vazias sem sobrescrever dados existentes. Teste de idempotência atualizado.
