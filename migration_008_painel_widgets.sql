-- migration_008_painel_widgets.sql
-- Catálogo de métricas descobíveis + widgets configuráveis do Painel (APS Layout A seed).
--
-- Manual apply (DB existente):
--   psql -U postgres -d simpa -f migration_008_painel_widgets.sql

-- ----------------------------------------------------------------------------
-- 1. Catálogo de métricas (lista flat — opção B; descoberta automática futura)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS painel_metricas_catalogo (
    id              BIGSERIAL PRIMARY KEY,
    chave           VARCHAR(160) UNIQUE NOT NULL,
    fonte_tipo      VARCHAR(40) NOT NULL CHECK (fonte_tipo IN (
                        'esus_raw', 'sia', 'consolidado', 'meta', 'placeholder'
                    )),
    label           VARCHAR(200) NOT NULL,
    descricao       TEXT,
    tipo_relatorio  VARCHAR(60),
    secao           VARCHAR(150),
    descricao_linha VARCHAR(300),
    campo_json      VARCHAR(80) NOT NULL DEFAULT 'quantidade',
    agregacao       VARCHAR(40) NOT NULL DEFAULT 'valor_unico' CHECK (agregacao IN (
                        'valor_unico', 'sum', 'avg', 'count', 'sum_turnos', 'historico', 'ranking_unidade'
                    )),
    sql_template    TEXT NOT NULL,
    descoberto_em   TIMESTAMP,
    ultima_carga_em TIMESTAMP,
    ocorrencias     INT NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_painel_metricas_fonte
    ON painel_metricas_catalogo (fonte_tipo, tipo_relatorio, status);

COMMENT ON TABLE painel_metricas_catalogo IS
    'Métricas disponíveis para widgets do Painel. Seed manual + descoberta automática a partir de esus_indicadores_raw.';
COMMENT ON COLUMN painel_metricas_catalogo.chave IS
    'Identificador estável (ex.: esus.atendimento_individual.resumo.registros.quantidade).';
COMMENT ON COLUMN painel_metricas_catalogo.sql_template IS
    'Query parametrizada (:competencia, :estabelecimento_id, :equipe_id). Exibida ao admin (opção C).';

-- ----------------------------------------------------------------------------
-- 2. Widgets do Painel por perfil/layout
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS painel_widgets (
    id               BIGSERIAL PRIMARY KEY,
    slug             VARCHAR(80) NOT NULL,
    perfil           VARCHAR(40) NOT NULL DEFAULT 'APS',
    layout           VARCHAR(10) NOT NULL DEFAULT 'A',
    ordem            INT NOT NULL DEFAULT 0,
    tipo             VARCHAR(40) NOT NULL CHECK (tipo IN (
                         'card', 'grafico_linha', 'grafico_ranking', 'grafico_barra'
                     )),
    titulo           VARCHAR(200) NOT NULL,
    subtitulo        VARCHAR(200),
    formato          VARCHAR(40) NOT NULL DEFAULT 'numero' CHECK (formato IN (
                         'numero', 'percentual', 'moeda', 'texto', 'fracao'
                     )),
    metrica_id       BIGINT REFERENCES painel_metricas_catalogo(id) ON DELETE SET NULL,
    fonte_config     JSONB NOT NULL DEFAULT '{}',
    spark_metrica_id BIGINT REFERENCES painel_metricas_catalogo(id) ON DELETE SET NULL,
    spark_config     JSONB,
    sql_preview      TEXT,
    delta_config     JSONB,
    status           VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em        TIMESTAMP NOT NULL DEFAULT now(),
    atualizado_em    TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (perfil, layout, slug)
);

CREATE INDEX IF NOT EXISTS idx_painel_widgets_perfil_layout
    ON painel_widgets (perfil, layout, ordem)
    WHERE status = 'ativo';

COMMENT ON TABLE painel_widgets IS
    'Layout dinâmico do Painel. Edição restrita a Administrador/Planejamento.';
COMMENT ON COLUMN painel_widgets.sql_preview IS
    'SQL legível para visualização admin (opção C); execução usa sql_template da métrica vinculada.';

-- ----------------------------------------------------------------------------
-- 3. Seed — catálogo de métricas (mapeamento ETL conhecido)
-- ----------------------------------------------------------------------------
INSERT INTO painel_metricas_catalogo (
    chave, fonte_tipo, label, descricao,
    tipo_relatorio, secao, descricao_linha, campo_json, agregacao, sql_template, ocorrencias
) VALUES
(
    'esus.atendimento_individual.resumo.registros.quantidade',
    'esus_raw',
    'Atendimentos individuais (resumo)',
    'Total de registros identificados — Relatório de Atendimento Individual.',
    'atendimento_individual',
    'Resumo de produção',
    'Registros identificados',
    'quantidade',
    'valor_unico',
    $sql$
SELECT (r.valores->>'quantidade')::bigint AS valor
FROM esus_cargas c
JOIN esus_indicadores_raw r ON r.carga_id = c.id
WHERE c.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR c.estabelecimento_id = :estabelecimento_id::bigint)
  AND (:equipe_id::bigint IS NULL OR c.equipe_id = :equipe_id::bigint)
  AND c.tipo_relatorio = 'atendimento_individual'
  AND r.secao = 'Resumo de produção'
  AND r.descricao = 'Registros identificados'
LIMIT 1
$sql$,
    1
),
(
    'esus.atendimento_individual.turnos.soma.quantidade',
    'esus_raw',
    'Atendimentos individuais (soma turnos)',
    'Fallback quando o export omite Resumo de produção — soma seção Turno.',
    'atendimento_individual',
    'Turno',
    NULL,
    'quantidade',
    'sum_turnos',
    $sql$
SELECT COALESCE(SUM((r.valores->>'quantidade')::bigint), 0) AS valor
FROM esus_cargas c
JOIN esus_indicadores_raw r ON r.carga_id = c.id
WHERE c.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR c.estabelecimento_id = :estabelecimento_id::bigint)
  AND (:equipe_id::bigint IS NULL OR c.equipe_id = :equipe_id::bigint)
  AND c.tipo_relatorio = 'atendimento_individual'
  AND r.secao = 'Turno'
$sql$,
    0
),
(
    'esus.atendimento_odontologico.resumo.registros.quantidade',
    'esus_raw',
    'Produção odontológica (resumo)',
    'Total de registros — Relatório de Atendimento Odontológico.',
    'atendimento_odontologico',
    'Resumo de produção',
    'Registros identificados',
    'quantidade',
    'valor_unico',
    $sql$
SELECT (r.valores->>'quantidade')::bigint AS valor
FROM esus_cargas c
JOIN esus_indicadores_raw r ON r.carga_id = c.id
WHERE c.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR c.estabelecimento_id = :estabelecimento_id::bigint)
  AND (:equipe_id::bigint IS NULL OR c.equipe_id = :equipe_id::bigint)
  AND c.tipo_relatorio = 'atendimento_odontologico'
  AND r.secao = 'Resumo de produção'
  AND r.descricao = 'Registros identificados'
LIMIT 1
$sql$,
    1
),
(
    'esus.atividade_coletiva.participantes.total.quantidade',
    'esus_raw',
    'Participantes — atividade coletiva',
    'Total de participantes identificados em atividades coletivas.',
    'atividade_coletiva',
    'Número de participantes',
    'Total de participantes',
    'quantidade',
    'valor_unico',
    $sql$
SELECT (r.valores->>'quantidade')::bigint AS valor
FROM esus_cargas c
JOIN esus_indicadores_raw r ON r.carga_id = c.id
WHERE c.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR c.estabelecimento_id = :estabelecimento_id::bigint)
  AND (:equipe_id::bigint IS NULL OR c.equipe_id = :equipe_id::bigint)
  AND c.tipo_relatorio = 'atividade_coletiva'
  AND r.secao = 'Número de participantes'
  AND r.descricao = 'Total de participantes'
LIMIT 1
$sql$,
    1
),
(
    'esus.atendimento_individual.historico.mensal',
    'esus_raw',
    'Série histórica — atendimentos individuais',
    'Atendimentos por competência (até 12 meses) a partir do consolidado municipal.',
    NULL,
    NULL,
    NULL,
    'quantidade',
    'historico',
    $sql$
SELECT to_char(competencia, 'YYYY-MM') AS competencia,
       SUM(COALESCE((dados_conteudo->'kpis_gerais'->>'total_atendimentos_aps')::bigint, 0)) AS valor
FROM dados_consolidados
WHERE competencia <= :competencia::date
  AND (dados_conteudo->'kpis_gerais'->>'total_atendimentos_aps') IS NOT NULL
GROUP BY competencia
ORDER BY competencia
LIMIT 12
$sql$,
    1
),
(
    'esus.atendimento_individual.ranking.unidade',
    'esus_raw',
    'Ranking produção por unidade',
    'Top unidades por atendimentos individuais na competência (visão município).',
    NULL,
    NULL,
    NULL,
    'quantidade',
    'ranking_unidade',
    $sql$
SELECT COALESCE(est.nome, dc.unidade) AS unidade,
       dc.estabelecimento_id,
       SUM(COALESCE((dc.dados_conteudo->'kpis_gerais'->>'total_atendimentos_aps')::bigint, 0)) AS valor
FROM dados_consolidados dc
LEFT JOIN estabelecimentos est ON est.id = dc.estabelecimento_id
WHERE dc.competencia = :competencia::date
  AND (dc.dados_conteudo->'kpis_gerais'->>'total_atendimentos_aps') IS NOT NULL
GROUP BY COALESCE(est.nome, dc.unidade), dc.estabelecimento_id
ORDER BY valor DESC
LIMIT 6
$sql$,
    1
),
(
    'consolidado.financiamento.metas_atingidas',
    'consolidado',
    'Metas atingidas (Componente Qualidade)',
    'Contagem de indicadores de financiamento com valor >= meta no JSON consolidado.',
    NULL,
    NULL,
    NULL,
    'valor',
    'valor_unico',
    $sql$
SELECT COUNT(*) FILTER (
           WHERE (item->>'valor') IS NOT NULL
             AND (item->>'meta') IS NOT NULL
             AND (item->>'valor')::numeric >= (item->>'meta')::numeric
       ) AS valor
FROM dados_consolidados dc,
     LATERAL jsonb_array_elements(
         COALESCE(
             dc.dados_conteudo->'modulos'->'financiamento_metas'->'indicadores',
             '[]'::jsonb
         )
     ) AS item
WHERE dc.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR dc.estabelecimento_id = :estabelecimento_id::bigint)
  AND (:equipe_id::bigint IS NULL OR dc.equipe_id = :equipe_id::bigint)
LIMIT 1
$sql$,
    0
),
(
    'consolidado.financiamento.metas_total',
    'consolidado',
    'Total de metas (Componente Qualidade)',
    'Indicadores de financiamento com meta ou valor apurado.',
    NULL,
    NULL,
    NULL,
    'valor',
    'valor_unico',
    $sql$
SELECT COUNT(*) FILTER (
           WHERE (item->>'meta') IS NOT NULL OR (item->>'valor') IS NOT NULL
       ) AS valor
FROM dados_consolidados dc,
     LATERAL jsonb_array_elements(
         COALESCE(
             dc.dados_conteudo->'modulos'->'financiamento_metas'->'indicadores',
             '[]'::jsonb
         )
     ) AS item
WHERE dc.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR dc.estabelecimento_id = :estabelecimento_id::bigint)
  AND (:equipe_id::bigint IS NULL OR dc.equipe_id = :equipe_id::bigint)
LIMIT 1
$sql$,
    0
),
(
    'placeholder.cobertura_aps',
    'placeholder',
    'Cobertura APS',
    'Indicador IGM — ainda não apurado na Fase 1.',
    NULL,
    NULL,
    NULL,
    'quantidade',
    'valor_unico',
    'SELECT NULL::bigint AS valor',
    0
),
(
    'placeholder.equipes_ativas',
    'placeholder',
    'Equipes ativas',
    'Contagem de equipes — ainda não apurado na Fase 1.',
    NULL,
    NULL,
    NULL,
    'quantidade',
    'valor_unico',
    'SELECT NULL::bigint AS valor',
    0
)
ON CONFLICT (chave) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Seed — widgets APS Layout A (6 cards + 2 gráficos atuais)
-- ----------------------------------------------------------------------------
INSERT INTO painel_widgets (
    slug, perfil, layout, ordem, tipo, titulo, subtitulo, formato,
    metrica_id, fonte_config, spark_metrica_id, spark_config, sql_preview, delta_config
)
SELECT
    w.slug,
    'APS',
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
        'atendimentos',
        1,
        'card',
        'Atendimentos individuais',
        NULL,
        'numero',
        'esus.atendimento_individual.resumo.registros.quantidade',
        '{"fallback_chave":"esus.atendimento_individual.turnos.soma.quantidade"}',
        'esus.atendimento_individual.historico.mensal',
        '{"campo":"valor","limite":12}',
        '{"tipo":"competencia_anterior","campo":"atendimentos"}'
    ),
    (
        'cobertura',
        2,
        'card',
        'Cobertura APS',
        NULL,
        'numero',
        'placeholder.cobertura_aps',
        '{}',
        NULL,
        NULL,
        '{"tipo":"fixo","label":"Não apurado"}'
    ),
    (
        'equipes',
        3,
        'card',
        'Equipes ativas',
        NULL,
        'numero',
        'placeholder.equipes_ativas',
        '{}',
        NULL,
        NULL,
        '{"tipo":"fixo","label":"—"}'
    ),
    (
        'metas',
        4,
        'card',
        'Metas atingidas',
        'Comp. Qualidade',
        'fracao',
        'consolidado.financiamento.metas_atingidas',
        '{"par_chave":"consolidado.financiamento.metas_total","formato":"atingidas/total"}',
        NULL,
        NULL,
        '{"tipo":"fixo","label":"Comp. Qualidade"}'
    ),
    (
        'odonto',
        5,
        'card',
        'Produção odontológica',
        NULL,
        'numero',
        'esus.atendimento_odontologico.resumo.registros.quantidade',
        '{}',
        'esus.atendimento_individual.historico.mensal',
        '{"campo":"valor","mapear":"procedimentos"}',
        '{"tipo":"competencia_anterior","campo":"procedimentos"}'
    ),
    (
        'coletivas',
        6,
        'card',
        'Atividades coletivas',
        NULL,
        'numero',
        'esus.atividade_coletiva.participantes.total.quantidade',
        '{}',
        NULL,
        NULL,
        '{"tipo":"fixo","label":"—"}'
    ),
    (
        'trend_atendimentos',
        7,
        'grafico_linha',
        'Atendimentos individuais',
        'Série histórica',
        'numero',
        'esus.atendimento_individual.historico.mensal',
        '{"eixo_x":"competencia","eixo_y":"valor"}',
        NULL,
        NULL,
        NULL
    ),
    (
        'ranking_unidades',
        8,
        'grafico_ranking',
        'Produção por unidade · top 6',
        NULL,
        'numero',
        'esus.atendimento_individual.ranking.unidade',
        '{"eixo_label":"unidade","eixo_valor":"valor","limite":6}',
        NULL,
        NULL,
        NULL
    )
) AS w(
    slug, ordem, tipo, titulo, subtitulo, formato,
    metrica_chave, fonte_config, spark_chave, spark_config, delta_config
)
JOIN painel_metricas_catalogo m ON m.chave = w.metrica_chave
LEFT JOIN painel_metricas_catalogo sm ON sm.chave = w.spark_chave
ON CONFLICT (perfil, layout, slug) DO NOTHING;
