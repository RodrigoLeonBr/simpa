-- ============================================================================
-- SIMPA — Migration 024: métricas + widgets Painel Hospitalar dos campos novos
--   de sih_aih (carater_internacao, cid_obito, dt_internacao, dt_saida).
-- Depends on: migration_023_sih_aih_campos.sql
-- Apply order: … → 23 → 24 sih_aih_widgets
-- Safe to re-run (ON CONFLICT DO NOTHING).
--
-- Manual apply:
--   Get-Content migration_024_sih_aih_widgets.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Métricas (fonte sih_aih — grão AIH)
-- ----------------------------------------------------------------------------
INSERT INTO painel_metricas_catalogo (
    chave, fonte_tipo, label, descricao,
    campo_json, agregacao, sql_template, ocorrencias
) VALUES
(
    'sih.permanencia_media_real',
    'sih',
    'Permanência média real (dias)',
    'Média de (dt_saida − dt_internacao) por AIH com ambas as datas preenchidas.',
    'valor',
    'valor_unico',
    $sql$
SELECT ROUND(AVG(sa.dt_saida - sa.dt_internacao)::numeric, 1) AS valor
FROM sih_aih sa
WHERE sa.competencia = :competencia::date
  AND sa.dt_internacao IS NOT NULL
  AND sa.dt_saida IS NOT NULL
  AND (:estabelecimento_id::bigint IS NULL
       OR sa.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sih.pct_obito_cid',
    'sih',
    'AIH com CID de óbito (%)',
    'Percentual de AIH com cid_obito preenchido na competência.',
    'valor',
    'valor_unico',
    $sql$
SELECT ROUND(
    SUM(CASE WHEN sa.cid_obito IS NOT NULL AND sa.cid_obito <> '' THEN 1 ELSE 0 END)::numeric
    * 100.0 / NULLIF(COUNT(*), 0),
    2
) AS valor
FROM sih_aih sa
WHERE sa.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sa.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sih.internacoes_por_carater',
    'sih',
    'Internações por caráter',
    'AIH por caráter de internação (eletiva / urgência / não informado).',
    'valor',
    'ranking_unidade',
    $sql$
SELECT
    CASE sa.carater_internacao
        WHEN '01' THEN 'Eletiva'
        WHEN '02' THEN 'Urgência'
        ELSE COALESCE(NULLIF(sa.carater_internacao, ''), 'Não informado')
    END                         AS unidade,
    COUNT(*)::bigint            AS valor
FROM sih_aih sa
WHERE sa.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sa.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY 1
ORDER BY valor DESC
$sql$,
    0
)
ON CONFLICT (chave) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Widgets Painel Hospitalar Layout A (ordem 9–11)
-- ----------------------------------------------------------------------------
INSERT INTO painel_widgets (
    slug, perfil, layout, ordem, tipo, titulo, subtitulo, formato,
    metrica_id, fonte_config, spark_metrica_id, spark_config, sql_preview, delta_config
)
SELECT
    w.slug,
    'Hospitalar',
    'A',
    w.ordem,
    w.tipo,
    w.titulo,
    w.subtitulo,
    w.formato,
    m.id,
    w.fonte_config::jsonb,
    NULL,
    NULL,
    m.sql_template,
    w.delta_config::jsonb
FROM (VALUES
    (
        'permanencia_media_real',
        9,
        'card',
        'Permanência média real',
        'dias (saída − internação)',
        'numero',
        'sih.permanencia_media_real',
        '{}',
        '{"tipo":"fixo","label":"dias/internação"}'
    ),
    (
        'pct_obito_cid',
        10,
        'card',
        'AIH com CID de óbito',
        NULL,
        'percentual',
        'sih.pct_obito_cid',
        '{}',
        '{"tipo":"fixo","label":"cid_obito preenchido"}'
    ),
    (
        'ranking_carater',
        11,
        'grafico_ranking',
        'Internações por caráter',
        NULL,
        'numero',
        'sih.internacoes_por_carater',
        '{"eixo_label":"unidade","eixo_valor":"valor","limite":10}',
        NULL
    )
) AS w(
    slug, ordem, tipo, titulo, subtitulo, formato,
    metrica_chave, fonte_config, delta_config
)
JOIN painel_metricas_catalogo m ON m.chave = w.metrica_chave
ON CONFLICT (perfil, layout, slug) DO NOTHING;
