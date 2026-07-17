-- ============================================================================
-- SIMPA — Migration 014: Indicadores SIA/OCI/PATE no catálogo e Painel MAC
-- Depends on: schema_full.sql … migration_013_sih_tabelas.sql
-- Apply order: … → 13 sih → 14 sia painel indicadores
--
-- Manual apply:
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_014_sia_painel_indicadores.sql
-- Docker:
--   Get-Content migration_014_sia_painel_indicadores.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Métricas SIA — produção e financeiro (mensal, quadrimestral, anual)
-- ----------------------------------------------------------------------------
INSERT INTO painel_metricas_catalogo (
    chave, fonte_tipo, label, descricao,
    campo_json, agregacao, sql_template, ocorrencias
) VALUES
(
    'sia.producao_qtd_aprovada',
    'sia',
    'Procedimentos aprovados (SIA)',
    'Soma de quantidade aprovada na competência (PRD_QT_A espelhada em sia_producao).',
    'valor',
    'sum',
    $sql$
SELECT COALESCE(SUM(sp.quantidade), 0)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sia.producao_valor_aprovado',
    'sia',
    'Valor aprovado (SIA)',
    'Soma do valor aprovado na competência (PRD_VL_A).',
    'valor',
    'sum',
    $sql$
SELECT COALESCE(SUM(sp.valor_aprovado), 0) AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sia.producao_valor_apresentado',
    'sia',
    'Valor apresentado (SIA)',
    'Soma do valor apresentado na competência (PRD_VL_P).',
    'valor',
    'sum',
    $sql$
SELECT COALESCE(SUM(sp.valor_apresentado), 0) AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sia.taxa_aprovacao_qtd_pct',
    'sia',
    'Taxa de aprovação quantidade (%)',
    'Quantidade aprovada / apresentada × 100 na competência.',
    'valor',
    'valor_unico',
    $sql$
SELECT ROUND(
    COALESCE(SUM(sp.quantidade), 0)::numeric * 100.0
    / NULLIF(COALESCE(SUM(sp.quantidade_apresentada), 0), 0),
    2
) AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sia.taxa_glosa_valor_pct',
    'sia',
    'Taxa de glosa financeira (%)',
    '(Valor apresentado − aprovado) / apresentado × 100.',
    'valor',
    'valor_unico',
    $sql$
SELECT ROUND(
    (COALESCE(SUM(sp.valor_apresentado), 0) - COALESCE(SUM(sp.valor_aprovado), 0))
    * 100.0 / NULLIF(COALESCE(SUM(sp.valor_apresentado), 0), 0),
    2
) AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sia.producao_mac_valor',
    'sia',
    'Produção MAC (rubrica 0301)',
    'Valor aprovado com rubrica MAC — média/alta complexidade ambulatorial.',
    'valor',
    'sum',
    $sql$
SELECT COALESCE(SUM(sp.valor_aprovado), 0) AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND sp.rubrica = '0301'
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sia.producao_ab_valor',
    'sia',
    'Produção Atenção Básica (rubrica 0101)',
    'Valor aprovado com rubrica de Atenção Básica.',
    'valor',
    'sum',
    $sql$
SELECT COALESCE(SUM(sp.valor_aprovado), 0) AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND sp.rubrica = '0101'
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sia.grupo_diagnostico_qtd',
    'sia',
    'Exames diagnósticos (grupo 02)',
    'Procedimentos aprovados do grupo SIGTAP 02 — proxy de exames OCI/PATE.',
    'valor',
    'sum',
    $sql$
SELECT COALESCE(SUM(sp.quantidade), 0)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND LEFT(sp.codigo_sigtap, 2) = '02'
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sia.grupo_clinico_qtd',
    'sia',
    'Procedimentos clínicos (grupo 03)',
    'Procedimentos aprovados do grupo SIGTAP 03 — consultas e atendimentos.',
    'valor',
    'sum',
    $sql$
SELECT COALESCE(SUM(sp.quantidade), 0)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND LEFT(sp.codigo_sigtap, 2) = '03'
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sia.grupo_cirurgico_qtd',
    'sia',
    'Procedimentos cirúrgicos (grupo 04)',
    'Procedimentos aprovados do grupo SIGTAP 04 — componente cirúrgico PATE.',
    'valor',
    'sum',
    $sql$
SELECT COALESCE(SUM(sp.quantidade), 0)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND LEFT(sp.codigo_sigtap, 2) = '04'
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sia.consultas_especializadas_qtd',
    'sia',
    'Consultas especializadas (subgrupo 0303)',
    'Procedimentos do subgrupo 0303 — consultas e atendimentos ambulatoriais especializados.',
    'valor',
    'sum',
    $sql$
SELECT COALESCE(SUM(sp.quantidade), 0)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND LEFT(sp.codigo_sigtap, 4) = '0303'
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sia.historico_mensal_qtd',
    'sia',
    'Série histórica mensal — procedimentos',
    'Quantidade aprovada por competência (até 12 meses).',
    'valor',
    'historico',
    $sql$
SELECT to_char(sp.competencia, 'YYYY-MM') AS competencia,
       COALESCE(SUM(sp.quantidade), 0)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia <= :competencia::date
  AND sp.competencia > (:competencia::date - interval '12 months')
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY sp.competencia
ORDER BY sp.competencia
LIMIT 12
$sql$,
    0
),
(
    'sia.historico_mensal_valor',
    'sia',
    'Série histórica mensal — valor aprovado',
    'Valor aprovado por competência (até 12 meses).',
    'valor',
    'historico',
    $sql$
SELECT to_char(sp.competencia, 'YYYY-MM') AS competencia,
       COALESCE(SUM(sp.valor_aprovado), 0) AS valor
FROM sia_producao sp
WHERE sp.competencia <= :competencia::date
  AND sp.competencia > (:competencia::date - interval '12 months')
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY sp.competencia
ORDER BY sp.competencia
LIMIT 12
$sql$,
    0
),
(
    'sia.historico_quadrimestral_valor',
    'sia',
    'Série histórica quadrimestral — valor',
    'Valor aprovado agregado por quadrimestre SUS (jan-abr, mai-ago, set-dez).',
    'valor',
    'historico',
    $sql$
WITH base AS (
  SELECT sp.competencia,
         COALESCE(SUM(sp.valor_aprovado), 0) AS valor,
         CASE
           WHEN EXTRACT(MONTH FROM sp.competencia) <= 4 THEN 1
           WHEN EXTRACT(MONTH FROM sp.competencia) <= 8 THEN 2
           ELSE 3
         END AS quad,
         EXTRACT(YEAR FROM sp.competencia)::int AS ano
  FROM sia_producao sp
  WHERE sp.competencia <= :competencia::date
    AND sp.competencia > (:competencia::date - interval '24 months')
    AND (:estabelecimento_id::bigint IS NULL
         OR sp.estabelecimento_id = :estabelecimento_id::bigint)
  GROUP BY sp.competencia
)
SELECT (ano::text || '-Q' || quad::text) AS competencia,
       SUM(valor) AS valor
FROM base
GROUP BY ano, quad
ORDER BY ano, quad
LIMIT 8
$sql$,
    0
),
(
    'sia.historico_anual_valor',
    'sia',
    'Série histórica anual — valor aprovado',
    'Valor aprovado acumulado por ano civil (até 5 anos).',
    'valor',
    'historico',
    $sql$
SELECT EXTRACT(YEAR FROM sp.competencia)::text AS competencia,
       COALESCE(SUM(sp.valor_aprovado), 0) AS valor
FROM sia_producao sp
WHERE sp.competencia <= :competencia::date
  AND sp.competencia > (:competencia::date - interval '5 years')
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY EXTRACT(YEAR FROM sp.competencia)
ORDER BY EXTRACT(YEAR FROM sp.competencia)
LIMIT 5
$sql$,
    0
),
(
    'sia.variacao_quadrimestre_anterior_pct',
    'sia',
    'Variação quadrimestral valor (%)',
    'Variação percentual do valor aprovado vs quadrimestre SUS anterior.',
    'valor',
    'valor_unico',
    $sql$
WITH bounds AS (
  SELECT :competencia::date AS ref,
         CASE
           WHEN EXTRACT(MONTH FROM :competencia::date) <= 4
             THEN make_date(EXTRACT(YEAR FROM :competencia::date)::int, 1, 1)
           WHEN EXTRACT(MONTH FROM :competencia::date) <= 8
             THEN make_date(EXTRACT(YEAR FROM :competencia::date)::int, 5, 1)
           ELSE make_date(EXTRACT(YEAR FROM :competencia::date)::int, 9, 1)
         END AS quad_ini,
         CASE
           WHEN EXTRACT(MONTH FROM :competencia::date) <= 4 THEN 1
           WHEN EXTRACT(MONTH FROM :competencia::date) <= 8 THEN 2
           ELSE 3
         END AS quad_num,
         EXTRACT(YEAR FROM :competencia::date)::int AS ano
),
periodos AS (
  SELECT b.quad_ini AS ini_atual,
         LEAST(b.ref, b.quad_ini + interval '4 months' - interval '1 day') AS fim_atual,
         CASE
           WHEN b.quad_num = 1 THEN make_date(b.ano - 1, 9, 1)
           WHEN b.quad_num = 2 THEN make_date(b.ano, 1, 1)
           ELSE make_date(b.ano, 5, 1)
         END AS ini_anterior,
         CASE
           WHEN b.quad_num = 1 THEN make_date(b.ano - 1, 12, 31)
           WHEN b.quad_num = 2 THEN make_date(b.ano, 4, 30)
           ELSE make_date(b.ano, 8, 31)
         END AS fim_anterior
  FROM bounds b
),
atual AS (
  SELECT COALESCE(SUM(sp.valor_aprovado), 0) AS v
  FROM sia_producao sp
  CROSS JOIN periodos p
  WHERE sp.competencia BETWEEN p.ini_atual AND p.fim_atual
    AND (:estabelecimento_id::bigint IS NULL
         OR sp.estabelecimento_id = :estabelecimento_id::bigint)
),
anterior AS (
  SELECT COALESCE(SUM(sp.valor_aprovado), 0) AS v
  FROM sia_producao sp
  CROSS JOIN periodos p
  WHERE sp.competencia BETWEEN p.ini_anterior AND p.fim_anterior
    AND (:estabelecimento_id::bigint IS NULL
         OR sp.estabelecimento_id = :estabelecimento_id::bigint)
)
SELECT ROUND((atual.v - anterior.v) * 100.0 / NULLIF(anterior.v, 0), 2) AS valor
FROM atual, anterior
$sql$,
    0
),
(
    'sia.variacao_ano_anterior_pct',
    'sia',
    'Variação anual valor acumulado (%)',
    'Variação percentual do valor aprovado acumulado no ano vs mesmo recorte do ano anterior.',
    'valor',
    'valor_unico',
    $sql$
WITH atual AS (
  SELECT COALESCE(SUM(sp.valor_aprovado), 0) AS v
  FROM sia_producao sp
  WHERE EXTRACT(YEAR FROM sp.competencia) = EXTRACT(YEAR FROM :competencia::date)
    AND sp.competencia <= :competencia::date
    AND (:estabelecimento_id::bigint IS NULL
         OR sp.estabelecimento_id = :estabelecimento_id::bigint)
),
anterior AS (
  SELECT COALESCE(SUM(sp.valor_aprovado), 0) AS v
  FROM sia_producao sp
  WHERE EXTRACT(YEAR FROM sp.competencia) = EXTRACT(YEAR FROM :competencia::date) - 1
    AND sp.competencia <= (:competencia::date - interval '1 year')
    AND (:estabelecimento_id::bigint IS NULL
         OR sp.estabelecimento_id = :estabelecimento_id::bigint)
)
SELECT ROUND((atual.v - anterior.v) * 100.0 / NULLIF(anterior.v, 0), 2) AS valor
FROM atual, anterior
$sql$,
    0
),
(
    'sia.ranking_unidades_valor',
    'sia',
    'Ranking unidades por valor SIA',
    'Top 6 estabelecimentos por valor aprovado na competência.',
    'valor',
    'ranking_unidade',
    $sql$
SELECT COALESCE(est.nome, sp.unidade, sp.cnes) AS unidade,
       sp.estabelecimento_id,
       COALESCE(SUM(sp.valor_aprovado), 0) AS valor
FROM sia_producao sp
LEFT JOIN estabelecimentos est ON est.id = sp.estabelecimento_id
WHERE sp.competencia = :competencia::date
GROUP BY COALESCE(est.nome, sp.unidade, sp.cnes), sp.estabelecimento_id
ORDER BY valor DESC
LIMIT 6
$sql$,
    0
),
(
    'sia.ranking_procedimentos_qtd',
    'sia',
    'Top procedimentos por volume',
    'Top 10 procedimentos SIGTAP por quantidade aprovada.',
    'valor',
    'ranking_unidade',
    $sql$
SELECT COALESCE(sp.descricao, sp.codigo_sigtap) AS unidade,
       COALESCE(SUM(sp.quantidade), 0)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY COALESCE(sp.descricao, sp.codigo_sigtap), sp.codigo_sigtap
ORDER BY valor DESC
LIMIT 10
$sql$,
    0
),
(
    'sia.ranking_rubricas_valor',
    'sia',
    'Produção por rubrica/financiamento',
    'Valor aprovado por rubrica na competência.',
    'valor',
    'ranking_unidade',
    $sql$
SELECT COALESCE(rs.descricao, sp.rubrica, 'Sem rubrica') AS unidade,
       COALESCE(SUM(sp.valor_aprovado), 0) AS valor
FROM sia_producao sp
LEFT JOIN rubricas_sia rs ON rs.codigo_rubrica = sp.rubrica AND rs.status = 'ativo'
WHERE sp.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY COALESCE(rs.descricao, sp.rubrica, 'Sem rubrica'), sp.rubrica
ORDER BY valor DESC
LIMIT 8
$sql$,
    0
),
(
    'sia.oci_alcance_meta_par_pct',
    'placeholder',
    'OCI — alcance meta PAR (%)',
    'Indicador PMAE/PATE #4: produção realizada / meta PAR × 100. Requer cadastro de metas PAR por OCI (lacuna).',
    'valor',
    'valor_unico',
    'SELECT NULL::numeric AS valor',
    0
),
(
    'sia.oci_absenteismo_pct',
    'placeholder',
    'OCI — absenteísmo (%)',
    'Indicador PMAE #2: faltosos / agendados × 100. Requer integração SISREG/filas (lacuna).',
    'valor',
    'valor_unico',
    'SELECT NULL::numeric AS valor',
    0
),
(
    'sia.oci_apac_producao_qtd',
    'placeholder',
    'OCI — produção APAC',
    'Procedimentos vinculados a APAC (PRD_APANUM). Requer extensão do sync SIA para persistir APAC (lacuna).',
    'valor',
    'valor_unico',
    'SELECT NULL::bigint AS valor',
    0
),
(
    'pate.ambulatorial_valor_mes',
    'sia',
    'PATE ambulatorial — valor mensal',
    'Valor aprovado SIA na competência — componente ambulatorial do Programa Agora Tem Especialistas.',
    'valor',
    'sum',
    $sql$
SELECT COALESCE(SUM(sp.valor_aprovado), 0) AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND sp.rubrica IN ('0301', '0602', '0604')
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'pate.consultas_especializadas_qtd',
    'sia',
    'PATE — consultas especializadas',
    'Volume mensal de consultas (subgrupo 0303) — proxy de produção ambulatorial especializada.',
    'valor',
    'sum',
    $sql$
SELECT COALESCE(SUM(sp.quantidade), 0)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND LEFT(sp.codigo_sigtap, 4) = '0303'
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'pate.exames_diagnostico_qtd',
    'sia',
    'PATE — exames diagnósticos',
    'Volume mensal grupo 02 — exames da linha de cuidado OCI/PATE.',
    'valor',
    'sum',
    $sql$
SELECT COALESCE(SUM(sp.quantidade), 0)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND LEFT(sp.codigo_sigtap, 2) = '02'
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'pate.historico_mensal_valor',
    'sia',
    'PATE — série histórica valor ambulatorial',
    'Valor aprovado mensal (rubricas MAC/FAEC/TFD) até 12 meses.',
    'valor',
    'historico',
    $sql$
SELECT to_char(sp.competencia, 'YYYY-MM') AS competencia,
       COALESCE(SUM(sp.valor_aprovado), 0) AS valor
FROM sia_producao sp
WHERE sp.competencia <= :competencia::date
  AND sp.competencia > (:competencia::date - interval '12 months')
  AND sp.rubrica IN ('0301', '0602', '0604')
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY sp.competencia
ORDER BY sp.competencia
LIMIT 12
$sql$,
    0
)
ON CONFLICT (chave) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Widgets Painel MAC Layout A — produção, financeiro, OCI/PATE
-- ----------------------------------------------------------------------------
INSERT INTO painel_widgets (
    slug, perfil, layout, ordem, tipo, titulo, subtitulo, formato,
    metrica_id, fonte_config, spark_metrica_id, spark_config, sql_preview, delta_config
)
SELECT
    w.slug,
    'MAC',
    'A',
    w.ordem,
    w.tipo,
    w.titulo,
    w.subtitulo,
    w.formato,
    m.id,
    w.fonte_config::jsonb,
    sm.id,
    w.spark_config::jsonb,
    COALESCE(m.sql_template, sm.sql_template),
    w.delta_config::jsonb
FROM (VALUES
    (
        'sia_producao_qtd',
        1, 'card', 'Procedimentos aprovados', 'Produção SIA · mês',
        'numero', 'sia.producao_qtd_aprovada', '{}',
        'sia.historico_mensal_qtd', '{"campo":"valor","limite":12}',
        '{"tipo":"competencia_anterior","campo":"producao_qtd"}'
    ),
    (
        'sia_valor_aprovado',
        2, 'card', 'Valor aprovado', 'Financeiro · mês',
        'moeda', 'sia.producao_valor_aprovado', '{}',
        'sia.historico_mensal_valor', '{"campo":"valor","limite":12}',
        '{"tipo":"competencia_anterior","campo":"valor_aprovado"}'
    ),
    (
        'sia_taxa_aprovacao',
        3, 'card', 'Taxa de aprovação', 'Quantidade · mês',
        'percentual', 'sia.taxa_aprovacao_qtd_pct', '{}',
        NULL, NULL,
        '{"tipo":"fixo","label":"aprovado/apresentado"}'
    ),
    (
        'sia_taxa_glosa',
        4, 'card', 'Taxa de glosa', 'Financeiro · mês',
        'percentual', 'sia.taxa_glosa_valor_pct', '{}',
        NULL, NULL,
        '{"tipo":"fixo","label":"valor glosado"}'
    ),
    (
        'sia_producao_mac',
        5, 'card', 'Produção MAC', 'Rubrica 0301',
        'moeda', 'sia.producao_mac_valor', '{}',
        NULL, NULL,
        '{"tipo":"competencia_anterior","campo":"mac_valor"}'
    ),
    (
        'sia_variacao_quadrimestre',
        6, 'card', 'Variação quadrimestral', 'vs quadrimestre anterior',
        'percentual', 'sia.variacao_quadrimestre_anterior_pct', '{}',
        'sia.historico_quadrimestral_valor', '{"campo":"valor","limite":8}',
        '{"tipo":"fixo","label":"quadrimestre SUS"}'
    ),
    (
        'sia_variacao_anual',
        7, 'card', 'Variação anual', 'YTD vs ano anterior',
        'percentual', 'sia.variacao_ano_anterior_pct', '{}',
        'sia.historico_anual_valor', '{"campo":"valor","limite":5}',
        '{"tipo":"fixo","label":"acumulado ano"}'
    ),
    (
        'oci_exames_diagnostico',
        8, 'card', 'Exames diagnósticos', 'OCI/PATE · grupo 02',
        'numero', 'sia.grupo_diagnostico_qtd', '{}',
        NULL, NULL,
        '{"tipo":"competencia_anterior","campo":"exames"}'
    ),
    (
        'oci_consultas_especializadas',
        9, 'card', 'Consultas especializadas', 'OCI/PATE · 0303',
        'numero', 'sia.consultas_especializadas_qtd', '{}',
        NULL, NULL,
        '{"tipo":"competencia_anterior","campo":"consultas"}'
    ),
    (
        'oci_alcance_meta_par',
        10, 'card', 'Alcance meta PAR', 'OCI · meta > 85%',
        'percentual', 'sia.oci_alcance_meta_par_pct', '{}',
        NULL, NULL,
        '{"tipo":"fixo","label":"requer metas PAR"}'
    ),
    (
        'pate_ambulatorial_valor',
        11, 'card', 'PATE ambulatorial', 'Valor mensal MAC/FAEC/TFD',
        'moeda', 'pate.ambulatorial_valor_mes', '{}',
        'pate.historico_mensal_valor', '{"campo":"valor","limite":12}',
        '{"tipo":"competencia_anterior","campo":"pate_valor"}'
    ),
    (
        'oci_absenteismo',
        12, 'card', 'Absenteísmo OCI', 'Meta < 20%',
        'percentual', 'sia.oci_absenteismo_pct', '{}',
        NULL, NULL,
        '{"tipo":"fixo","label":"requer SISREG"}'
    ),
    (
        'sia_trend_producao',
        13, 'grafico_linha', 'Produção SIA mensal', 'Quantidade aprovada',
        'numero', 'sia.historico_mensal_qtd', '{"eixo_x":"competencia","eixo_y":"valor"}',
        NULL, NULL, NULL
    ),
    (
        'sia_trend_financeiro',
        14, 'grafico_linha', 'Valor aprovado mensal', 'Série financeira',
        'moeda', 'sia.historico_mensal_valor', '{"eixo_x":"competencia","eixo_y":"valor"}',
        NULL, NULL, NULL
    ),
    (
        'sia_ranking_unidades',
        15, 'grafico_ranking', 'Top unidades · valor SIA', NULL,
        'moeda', 'sia.ranking_unidades_valor', '{"eixo_label":"unidade","eixo_valor":"valor","limite":6}',
        NULL, NULL, NULL
    ),
    (
        'sia_ranking_rubricas',
        16, 'grafico_ranking', 'Produção por rubrica', 'Financiamento',
        'moeda', 'sia.ranking_rubricas_valor', '{"eixo_label":"unidade","eixo_valor":"valor","limite":8}',
        NULL, NULL, NULL
    ),
    (
        'pate_trend_ambulatorial',
        17, 'grafico_linha', 'PATE — valor ambulatorial', 'Série mensal',
        'moeda', 'pate.historico_mensal_valor', '{"eixo_x":"competencia","eixo_y":"valor"}',
        NULL, NULL, NULL
    )
) AS w(
    slug, ordem, tipo, titulo, subtitulo, formato,
    metrica_chave, fonte_config, spark_chave, spark_config, delta_config
)
JOIN painel_metricas_catalogo m ON m.chave = w.metrica_chave
LEFT JOIN painel_metricas_catalogo sm ON sm.chave = w.spark_chave
ON CONFLICT (perfil, layout, slug) DO NOTHING;
