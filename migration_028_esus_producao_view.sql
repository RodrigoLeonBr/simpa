-- ============================================================================
-- SIMPA — Migration 028: view v_esus_producao + piloto de refactor de métricas
-- Depends on: schema_full.sql … migration_027_fix_sih_metricas_utf8.sql
-- Apply order: … → 27 fix_sih_metricas_utf8 → 28 esus_producao_view
-- Safe to re-run (CREATE OR REPLACE VIEW + UPDATE por chave).
--
-- Manual apply (Postgres não-Docker):
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_028_esus_producao_view.sql
-- Docker (container existente) — UTF-8 SAFE:
--   docker cp migration_028_esus_producao_view.sql simpa-postgres-1:/tmp/m.sql
--   docker exec simpa-postgres-1 psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/m.sql
-- NÃO use `Get-Content ... | docker exec -i psql` (corrompe acento no Windows).
--
-- Objetivo: o join `esus_cargas ⋈ esus_indicadores_raw` repete em toda métrica
-- `esus_raw` do catálogo. Esta view encapsula o join + expõe as colunas de
-- escopo (competencia, estabelecimento_id, equipe_id) e o JSONB `valores`.
-- View comum (não materializada): o planner a achata e os filtros do template
-- (competencia/estab/equipe/secao/descricao) sofrem pushdown até as tabelas
-- base — mesmo plano, mesma velocidade. Ganho é legibilidade + DRY, e a view
-- vira o seam para materializar `quantidade` como coluna tipada no futuro
-- (basta trocar a expressão aqui, sem tocar nos templates).
-- ============================================================================

CREATE OR REPLACE VIEW v_esus_producao AS
SELECT c.id                 AS carga_id,
       c.competencia,
       c.tipo_relatorio,
       c.estabelecimento_id,
       c.equipe_id,
       c.unidade,
       c.equipe_nome,
       r.secao,
       r.descricao,
       r.valores
FROM esus_cargas c
JOIN esus_indicadores_raw r ON r.carga_id = c.id;

COMMENT ON VIEW v_esus_producao IS
    'Join canônico esus_cargas ⋈ esus_indicadores_raw para templates de métricas do Painel (fonte_tipo=esus_raw). Filtrar por competencia/estabelecimento_id/equipe_id na query externa.';

-- ----------------------------------------------------------------------------
-- Piloto: 3 métricas esus_raw passam a ler a view. Idempotente (UPDATE por chave).
-- ----------------------------------------------------------------------------

UPDATE painel_metricas_catalogo SET sql_template =
$sql$
SELECT (valores->>'quantidade')::bigint AS valor
FROM v_esus_producao
WHERE competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR estabelecimento_id = :estabelecimento_id::bigint)
  AND (:equipe_id::bigint IS NULL OR equipe_id = :equipe_id::bigint)
  AND tipo_relatorio = 'atendimento_individual'
  AND secao = 'Resumo de produção'
  AND descricao = 'Registros identificados'
LIMIT 1
$sql$
WHERE chave = 'esus.atendimento_individual.resumo.registros.quantidade';

UPDATE painel_metricas_catalogo SET sql_template =
$sql$
SELECT COALESCE(SUM((valores->>'quantidade')::bigint), 0) AS valor
FROM v_esus_producao
WHERE competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR estabelecimento_id = :estabelecimento_id::bigint)
  AND (:equipe_id::bigint IS NULL OR equipe_id = :equipe_id::bigint)
  AND tipo_relatorio = 'atendimento_individual'
  AND secao = 'Turno'
$sql$
WHERE chave = 'esus.atendimento_individual.turnos.soma.quantidade';

UPDATE painel_metricas_catalogo SET sql_template =
$sql$
SELECT (valores->>'quantidade')::bigint AS valor
FROM v_esus_producao
WHERE competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR estabelecimento_id = :estabelecimento_id::bigint)
  AND (:equipe_id::bigint IS NULL OR equipe_id = :equipe_id::bigint)
  AND tipo_relatorio = 'atendimento_odontologico'
  AND secao = 'Resumo de produção'
  AND descricao = 'Registros identificados'
LIMIT 1
$sql$
WHERE chave = 'esus.atendimento_odontologico.resumo.registros.quantidade';
