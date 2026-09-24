-- ============================================================================
-- SIMPA — Migration 037: métricas SIA/SIH respeitam o período selecionado
-- Depends on: migration_031_widget_agregacao_periodo.sql (BETWEEN inicio/fim).
-- Apply order: … → 36 vacinas → 37 sia_sih_metricas_periodo
-- Safe to re-run (idempotente: só casa templates ainda no formato `= :competencia`).
--
-- Templates de métricas SIA/SIH (auto-descobertas e curadas em 013/014/024/032/033)
-- filtravam `WHERE <alias>.competencia = :competencia::date` — fixo no mês final do
-- período, ignorando trimestre/quadrimestre/ano. Troca para intervalo
-- `BETWEEN :competencia_inicio::date AND :competencia_fim::date`.
--
-- Por que é seguro trocar em lote:
--   * O regex casa SÓ o padrão exato `<alias>.competencia = :competencia::date`.
--   * Templates multi-período (histórico `competencia <= :competencia`, variação
--     ano/quadri com EXTRACT(YEAR ...)) usam SQL diferente e NÃO são tocados.
--   * Somas/contagens/rankings passam a somar o período; razões (média permanência,
--     % UTI, taxas) viram razão-de-somas = média do período — correto.
--   * Widgets 'soma' recebem o intervalo completo; 'ultimo_mes' colapsam inicio=fim
--     no mês final (resolveMetricValueForWidget), preservando o snapshot mensal.
--     Rankings/linhas usam o intervalo cheio → ranking do período (comportamento
--     desejado ao escolher trimestre/quadri/ano).
--
-- Manual apply (Postgres não-Docker):
--   psql -h <host> -p <port> -U postgres -d simpa -f migration_037_sia_sih_metricas_periodo.sql
-- Docker (container existente) — UTF-8 SAFE:
--   docker cp migration_037_sia_sih_metricas_periodo.sql <container>:/tmp/m.sql
--   docker exec <container> psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/m.sql
-- ============================================================================

UPDATE painel_metricas_catalogo
SET sql_template = regexp_replace(
      sql_template,
      '([a-zA-Z_]+)\.competencia = :competencia::date',
      '\1.competencia BETWEEN :competencia_inicio::date AND :competencia_fim::date',
      'g'
    )
WHERE fonte_tipo IN ('sia', 'sih')
  AND sql_template LIKE '%= :competencia::date%';
