-- ============================================================================
-- SIMPA — Migration 040: card "Atendimento individual"/"Odonto" do Painel APS
--   passa a usar a métrica oficial consolidada (kpis_gerais), igual ao hero/tabela.
-- Depends on: migration_008 (painel_metricas_catalogo/widgets), migration_030 (APS widgets).
-- Apply order: … → 39 widgets_aps_somaveis_soma → 40 aps_atendimento_oficial
-- Safe to re-run (ON CONFLICT DO UPDATE + UPDATE idempotente).
--
-- Contexto: o card APS "atendimentos" usava esus.atendimento_individual.resumo
-- (só a linha "Registros identificados" de v_esus_producao), subcontando as
-- unidades que reportam "Total de registros". O consolidador (_resumo_total) e
-- todo o resto do Painel (hero, tabela, ranking, trend) usam
-- kpis_gerais.total_atendimentos_aps, que já cobre os dois rótulos. Alinhamos o
-- card a essa fonte oficial. Idem odonto (atendimentos_odonto).
--
-- Template usa :competencia (mono-mês); o widget está em agregacao_periodo='soma'
-- (migration 039), então o backend roda mês a mês e soma o grão selecionado.
--
-- Docker (container existente) — UTF-8 SAFE:
--   docker cp migration_040_aps_atendimento_oficial.sql <container>:/tmp/m.sql
--   docker exec <container> psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/m.sql
-- ============================================================================

INSERT INTO painel_metricas_catalogo (
    chave, fonte_tipo, label, descricao, campo_json, agregacao, sql_template, ocorrencias
) VALUES
(
    'esus.atendimento_individual.total.municipio',
    'esus_raw',
    'Atendimentos individuais (consolidado)',
    'Soma de kpis_gerais.total_atendimentos_aps do consolidado — mesma base do hero/tabela/ranking.',
    'total_atendimentos_aps',
    'sum',
    $sql$
SELECT SUM(COALESCE((dc.dados_conteudo->'kpis_gerais'->>'total_atendimentos_aps')::bigint, 0)) AS valor
FROM dados_consolidados dc
WHERE dc.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR dc.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'esus.atendimento_odontologico.total.municipio',
    'esus_raw',
    'Atendimentos odontológicos (consolidado)',
    'Soma de kpis_gerais.atendimentos_odonto do consolidado — mesma base do hero/tabela.',
    'atendimentos_odonto',
    'sum',
    $sql$
SELECT SUM(COALESCE((dc.dados_conteudo->'kpis_gerais'->>'atendimentos_odonto')::bigint, 0)) AS valor
FROM dados_consolidados dc
WHERE dc.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR dc.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
)
ON CONFLICT (chave) DO UPDATE SET
    sql_template = EXCLUDED.sql_template,
    label = EXCLUDED.label,
    descricao = EXCLUDED.descricao,
    status = 'ativo';

UPDATE painel_widgets
SET metrica_id = (SELECT id FROM painel_metricas_catalogo WHERE chave = 'esus.atendimento_individual.total.municipio'),
    atualizado_em = now()
WHERE perfil = 'APS' AND slug = 'atendimentos';

UPDATE painel_widgets
SET metrica_id = (SELECT id FROM painel_metricas_catalogo WHERE chave = 'esus.atendimento_odontologico.total.municipio'),
    atualizado_em = now()
WHERE perfil = 'APS' AND slug = 'odonto';
