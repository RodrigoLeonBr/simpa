-- ============================================================================
-- SIMPA — Migration 039: cards APS somáveis agregam por soma no período
-- Depends on: migration_038_widgets_somaveis_soma.sql (SIA/SIH) +
--             resolveMetricValueForWidget com soma = loop mês a mês (soma).
-- Apply order: … → 38 widgets_somaveis_soma → 39 widgets_aps_somaveis_soma
-- Safe to re-run (idempotente: só casa widgets ainda em 'ultimo_mes').
--
-- Cards de fluxo do Painel APS (atendimento individual, odontológico, atividade
-- coletiva, consultas SIA) mostravam só o mês final no trimestre/quadri/ano.
-- Passa para 'soma' → o backend roda a métrica mês a mês e soma o período
-- (funciona com template :competencia mono-mês ou BETWEEN).
--
-- Deixados em 'ultimo_mes' de propósito: cobertura, equipes ativas e metas
-- (snapshots — somar não faz sentido).
--
-- Manual apply (Postgres não-Docker):
--   psql -h <host> -p <port> -U postgres -d simpa -f migration_039_widgets_aps_somaveis_soma.sql
-- Docker (container existente) — UTF-8 SAFE:
--   docker cp migration_039_widgets_aps_somaveis_soma.sql <container>:/tmp/m.sql
--   docker exec <container> psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/m.sql
-- ============================================================================

UPDATE painel_widgets
SET agregacao_periodo = 'soma',
    atualizado_em = now()
WHERE perfil = 'APS'
  AND tipo = 'card'
  AND agregacao_periodo = 'ultimo_mes'
  AND slug IN ('atendimentos', 'odonto', 'coletivas', 'consultas', 'consultas_medicas');
