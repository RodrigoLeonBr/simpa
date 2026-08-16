-- ============================================================================
-- SIMPA — Migration 032: tabelas Painel Hospitalar Layout C (tabela)
--   + métrica sih.internacoes_por_complexidade (ranking) + 2 widgets ranking:
--     - Internações por CID (reusa sih.internacoes_por_cid, migration 013)
--     - Internações por complexidade / tipo de leito (nova métrica)
-- Depends on: migration_013_sih_tabelas.sql (sih_internacoes, sih.* métricas).
-- Apply order: … → 31 widget_agregacao_periodo → 32 widgets_hospitalar_c
-- Safe to re-run (ON CONFLICT DO NOTHING).
--
-- Manual apply (Postgres não-Docker):
--   psql -h <host> -p <port> -U postgres -d simpa -f migration_032_widgets_hospitalar_c.sql
-- Docker (container existente) — UTF-8 SAFE:
--   docker cp migration_032_widgets_hospitalar_c.sql <container>:/tmp/m.sql
--   docker exec <container> psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/m.sql
-- NÃO use `Get-Content ... | docker exec -i psql` (corrompe acento no Windows).
--
-- Nota "por leito": SIHD (s_aih) não registra o leito de cada AIH; a dimensão
-- clínica mais próxima é a complexidade (02 = média, 03 = alta ≈ UTI/alta comp.).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Métrica: internações por complexidade (proxy de tipo de leito)
-- ----------------------------------------------------------------------------
INSERT INTO painel_metricas_catalogo (
    chave, fonte_tipo, label, descricao,
    campo_json, agregacao, sql_template, ocorrencias
) VALUES
(
    'sih.internacoes_por_complexidade',
    'sih',
    'Internações por complexidade (tipo de leito)',
    'AIH por nível de complexidade na competência (02 = média, 03 = alta). '
    'Proxy de tipo de leito — SIHD não registra o leito de cada internação.',
    'valor',
    'ranking_unidade',
    $sql$
SELECT CASE si.complexidade
         WHEN '02' THEN 'Média complexidade'
         WHEN '03' THEN 'Alta complexidade'
         ELSE COALESCE(NULLIF(si.complexidade, ''), 'Não informado')
       END                     AS unidade,
       SUM(si.qtd_aih)::bigint  AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY 1
ORDER BY valor DESC
LIMIT 10
$sql$,
    0
)
ON CONFLICT (chave) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Widgets Painel Hospitalar Layout C (grafico_ranking = tabela). ordem 2 e 3
--    (ordem 1 reservada ao card "Teste" já cadastrado pelo usuário).
-- ----------------------------------------------------------------------------
INSERT INTO painel_widgets (
    slug, perfil, layout, ordem, tipo, titulo, subtitulo, formato,
    metrica_id, fonte_config, spark_metrica_id, spark_config, sql_preview, delta_config,
    agregacao_periodo
)
SELECT
    w.slug, 'Hospitalar', 'C', w.ordem, w.tipo, w.titulo, w.subtitulo, w.formato,
    m.id, w.fonte_config::jsonb, NULL, NULL, m.sql_template, NULL,
    'ultimo_mes'
FROM (VALUES
    (
        'ranking_leito_c',
        2,
        'grafico_ranking',
        'Internações por leito (complexidade)',
        'SIHD · média vs alta complexidade',
        'numero',
        'sih.internacoes_por_complexidade',
        '{"eixo_label":"unidade","eixo_valor":"valor","limite":10}'
    ),
    (
        'ranking_cid_c',
        3,
        'grafico_ranking',
        'Internações por CID',
        'SIHD · top 10 capítulos CID-10',
        'numero',
        'sih.internacoes_por_cid',
        '{"eixo_label":"unidade","eixo_valor":"valor","limite":10}'
    )
) AS w(
    slug, ordem, tipo, titulo, subtitulo, formato, metrica_chave, fonte_config
)
JOIN painel_metricas_catalogo m ON m.chave = w.metrica_chave
ON CONFLICT (perfil, layout, slug) DO NOTHING;
