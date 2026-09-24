-- ============================================================================
-- SIMPA — Migration 042: sql_override dos widgets respeita o período (grão)
-- Depends on: migration_037/041 (templates de métrica já em BETWEEN).
-- Apply order: … → 41 esus_rankings_periodo → 42 widget_overrides_periodo
-- Safe to re-run (idempotente: regex só casa `= :competencia::date`).
--
-- resolveMetricValue prioriza widget.sql_override sobre o template da métrica.
-- Alguns widgets guardavam um override mono-mês (`= :competencia::date`), que
-- ignorava as correções de período feitas nos templates — em especial o ranking
-- (que não roda mês a mês; usa o intervalo cheio direto no SQL).
-- Troca por BETWEEN :competencia_inicio/:fim.
--
-- Seguro para cards também: 'ultimo_mes' colapsa inicio=fim no mês final e 'soma'
-- roda mês a mês (inicio=fim=mês) — BETWEEN devolve o mesmo valor nesses casos.
-- Regex cirúrgico: não toca histórico (`<=`) nem variação (EXTRACT(YEAR ...)).
--
-- Docker (container existente) — UTF-8 SAFE:
--   docker cp migration_042_widget_overrides_periodo.sql <container>:/tmp/m.sql
--   docker exec <container> psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/m.sql
-- ============================================================================

UPDATE painel_widgets
SET sql_override = regexp_replace(
      sql_override,
      '([a-zA-Z_]+)\.competencia = :competencia::date',
      '\1.competencia BETWEEN :competencia_inicio::date AND :competencia_fim::date',
      'g'
    ),
    atualizado_em = now()
WHERE sql_override LIKE '%= :competencia::date%';
