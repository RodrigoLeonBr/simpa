-- ============================================================================
-- SIMPA — Migration 041: rankings e-SUS respeitam o período (grão)
-- Depends on: migration_037 (SIA/SIH já em BETWEEN).
-- Apply order: … → 40 aps_atendimento_oficial → 41 esus_rankings_periodo
-- Safe to re-run (idempotente: regex só casa `= :competencia::date`).
--
-- Rankings (grafico_ranking/barra) chamam a métrica com o intervalo do período
-- (competencia_inicio/fim), mas os templates e-SUS filtravam
-- `WHERE <alias>.competencia = :competencia::date` → mostravam só o mês final.
-- Troca para BETWEEN :competencia_inicio/:fim → ranking somado do período.
--
-- Escopo: e-SUS com GROUP BY (rankings agregados). Não toca:
--   * cards e-SUS valor_unico (sem GROUP BY) — somados via loop mês a mês no backend;
--   * histórico/trend (`competencia <= :competencia`) — o regex não casa `<=`.
-- SIA/SIH já foram convertidos na migration 037.
--
-- Docker (container existente) — UTF-8 SAFE:
--   docker cp migration_041_esus_rankings_periodo.sql <container>:/tmp/m.sql
--   docker exec <container> psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/m.sql
-- ============================================================================

UPDATE painel_metricas_catalogo
SET sql_template = regexp_replace(
      sql_template,
      '([a-zA-Z_]+)\.competencia = :competencia::date',
      '\1.competencia BETWEEN :competencia_inicio::date AND :competencia_fim::date',
      'g'
    )
WHERE fonte_tipo = 'esus_raw'
  AND sql_template ILIKE '%GROUP BY%'
  AND sql_template LIKE '%= :competencia::date%';
