-- ============================================================================
-- SIMPA — Migration 038: widgets de produção somável agregam por soma no período
-- Depends on: migration_037_sia_sih_metricas_periodo.sql (templates BETWEEN).
-- Apply order: … → 37 sia_sih_metricas_periodo → 38 widgets_somaveis_soma
-- Safe to re-run (idempotente: só casa widgets ainda em 'ultimo_mes').
--
-- Cards SIA/SIH cuja métrica é aditiva (agregacao='sum': total AIH, valor, diárias,
-- produção/valor aprovado MAC, consultas/exames OCI, valor ambulatorial PATE)
-- ficavam em 'ultimo_mes' → mostravam só o mês final mesmo no trimestre/quadri/ano.
-- Passa para 'soma' → o card soma todos os meses do período (template já usa
-- :competencia_inicio/:fim após a migration 037).
--
-- Deixados em 'ultimo_mes' de propósito:
--   * razões/percentuais (média permanência, % UTI, taxas) — somar não faz sentido;
--     candidatos a 'media' (média mês a mês), decisão à parte.
--   * variação ano/quadrimestre e apac_distintas (COUNT DISTINCT) — valor único.
--   * rankings/linhas — não consultam agregacao_periodo (já usam o intervalo cheio).
--
-- Manual apply (Postgres não-Docker):
--   psql -h <host> -p <port> -U postgres -d simpa -f migration_038_widgets_somaveis_soma.sql
-- Docker (container existente) — UTF-8 SAFE:
--   docker cp migration_038_widgets_somaveis_soma.sql <container>:/tmp/m.sql
--   docker exec <container> psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/m.sql
-- ============================================================================

UPDATE painel_widgets w
SET agregacao_periodo = 'soma',
    atualizado_em = now()
FROM painel_metricas_catalogo m
WHERE m.id = w.metrica_id
  AND w.tipo = 'card'
  AND w.agregacao_periodo = 'ultimo_mes'
  AND m.fonte_tipo IN ('sia', 'sih')
  AND m.agregacao = 'sum'
  AND m.sql_template LIKE '%competencia_inicio%';
