-- ============================================================================
-- SIMPA — Migration 013: Tabelas SIHD (sih_sincronizacoes, sih_internacoes,
--         sih_procedimentos) + seeds métricas/widgets Painel Hospitalar Layout A
-- Depends on: schema_full.sql … migration_012_populacao_cadastrada.sql
-- Apply order: 01 schema → … → 12 populacao_cadastrada → 13 sih_tabelas
-- Safe to re-run on existing databases (IF NOT EXISTS / DROP CONSTRAINT IF EXISTS).
--
-- Manual apply (non-Docker Postgres):
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_013_sih_tabelas.sql
-- Docker (existing container):
--   Get-Content migration_013_sih_tabelas.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. sih_sincronizacoes — registro de cada importação SIHD por competência
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sih_sincronizacoes (
    id                BIGSERIAL PRIMARY KEY,
    competencia       DATE         NOT NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'pendente'
                          CONSTRAINT chk_sih_sync_status
                          CHECK (status IN ('ok', 'parcial', 'erro', 'pendente')),
    qtd_internacoes   INT          NOT NULL DEFAULT 0,
    qtd_procedimentos INT          NOT NULL DEFAULT 0,
    orphan_cnes       INT          NOT NULL DEFAULT 0,
    erros             INT          NOT NULL DEFAULT 0,
    sincronizado_em   TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sih_sync_competencia
    ON sih_sincronizacoes (competencia);

COMMENT ON TABLE sih_sincronizacoes IS
    'Registro de cada importação SIHD (s_aih + s_aih_pa) por competência. '
    'Uma linha por competência — re-importação DELETE + INSERT preservando id.';
COMMENT ON COLUMN sih_sincronizacoes.orphan_cnes IS
    'CNES sem match em estabelecimentos durante a importação.';

-- ----------------------------------------------------------------------------
-- 2. sih_internacoes — s_aih agregado (grão gerencial)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sih_internacoes (
    id                  BIGSERIAL    PRIMARY KEY,
    sincronizacao_id    BIGINT       NOT NULL
                            REFERENCES sih_sincronizacoes(id) ON DELETE CASCADE,
    competencia         DATE         NOT NULL,
    cnes                VARCHAR(7)   NOT NULL,
    estabelecimento_id  INT          REFERENCES estabelecimentos(id),
    proc_principal      VARCHAR(10),
    diag_principal      VARCHAR(4),
    complexidade        VARCHAR(2),
    financiamento       VARCHAR(2),   -- 2-char = RUB_ID direto (diferente do SIA 4-char)
    motivo_saida        VARCHAR(2),
    sexo                VARCHAR(1),
    qtd_aih             INT          NOT NULL DEFAULT 0,
    total_diarias       INT          NOT NULL DEFAULT 0,
    total_diarias_uti   INT          NOT NULL DEFAULT 0,
    total_valor         NUMERIC(15,2) NOT NULL DEFAULT 0,
    media_idade         NUMERIC(5,2),
    media_diarias       NUMERIC(5,2)
);

CREATE INDEX IF NOT EXISTS idx_sih_int_cns_cmp
    ON sih_internacoes (competencia, cnes);
CREATE INDEX IF NOT EXISTS idx_sih_int_estab
    ON sih_internacoes (competencia, estabelecimento_id);
CREATE INDEX IF NOT EXISTS idx_sih_int_diag
    ON sih_internacoes (competencia, diag_principal);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sih_int_grain
    ON sih_internacoes
    (sincronizacao_id, cnes,
     COALESCE(proc_principal, ''),
     COALESCE(diag_principal, ''),
     COALESCE(complexidade, ''),
     COALESCE(financiamento, ''),
     COALESCE(motivo_saida, ''),
     COALESCE(sexo, ''));

COMMENT ON TABLE sih_internacoes IS
    'Internações SIHD agregadas por competência × CNES × proc_principal × diag_principal × '
    'complexidade × financiamento × motivo_saida × sexo. '
    'financiamento = 2 chars → RUB_ID direto (não LEFT(…,4) como no SIA).';
COMMENT ON COLUMN sih_internacoes.financiamento IS
    'Código de financiamento 2 chars (s_aih.FINANCIAMENTO). JOIN direto com rubricas_sia.codigo_rubrica.';

-- ----------------------------------------------------------------------------
-- 3. sih_procedimentos — s_aih_pa agregado (grão itens)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sih_procedimentos (
    id                    BIGSERIAL    PRIMARY KEY,
    sincronizacao_id      BIGINT       NOT NULL
                              REFERENCES sih_sincronizacoes(id) ON DELETE CASCADE,
    competencia           DATE         NOT NULL,
    cnes                  VARCHAR(7)   NOT NULL,
    estabelecimento_id    INT          REFERENCES estabelecimentos(id),
    proc_detalhado        VARCHAR(10),
    cbo_profissional      VARCHAR(6),
    financiamento_detalhe VARCHAR(2),
    qtd_aih_distintas     INT          NOT NULL DEFAULT 0,
    total_quantidade      INT          NOT NULL DEFAULT 0,
    total_valor_item      NUMERIC(15,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sih_proc_cns_cmp
    ON sih_procedimentos (competencia, cnes);
CREATE INDEX IF NOT EXISTS idx_sih_proc_estab
    ON sih_procedimentos (competencia, estabelecimento_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sih_proc_grain
    ON sih_procedimentos
    (sincronizacao_id, cnes,
     COALESCE(proc_detalhado, ''),
     COALESCE(cbo_profissional, ''),
     COALESCE(financiamento_detalhe, ''));

COMMENT ON TABLE sih_procedimentos IS
    'Procedimentos por internação (s_aih_pa) agregados por competência × CNES × '
    'proc_detalhado × cbo_profissional × financiamento_detalhe.';

-- ----------------------------------------------------------------------------
-- 4. Ampliar CHECK fonte_tipo em painel_metricas_catalogo para incluir 'sih'
-- ----------------------------------------------------------------------------
ALTER TABLE painel_metricas_catalogo
    DROP CONSTRAINT IF EXISTS painel_metricas_catalogo_fonte_tipo_check;

ALTER TABLE painel_metricas_catalogo
    ADD CONSTRAINT painel_metricas_catalogo_fonte_tipo_check
    CHECK (fonte_tipo IN ('esus_raw', 'sia', 'sih', 'consolidado', 'meta', 'placeholder'));

-- ----------------------------------------------------------------------------
-- 5. Seeds — métricas SIHD (sih.*)
-- ----------------------------------------------------------------------------
INSERT INTO painel_metricas_catalogo (
    chave, fonte_tipo, label, descricao,
    campo_json, agregacao, sql_template, ocorrencias
) VALUES
(
    'sih.total_aih',
    'sih',
    'Total de internações (AIH)',
    'Soma de AIH distintas no grão gerencial da competência.',
    'valor',
    'sum',
    $sql$
SELECT SUM(si.qtd_aih)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sih.total_diarias',
    'sih',
    'Total de diárias',
    'Soma de diárias de internação na competência.',
    'valor',
    'sum',
    $sql$
SELECT SUM(si.total_diarias)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sih.total_diarias_uti',
    'sih',
    'Diárias em UTI',
    'Soma de diárias em UTI na competência.',
    'valor',
    'sum',
    $sql$
SELECT SUM(si.total_diarias_uti)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sih.total_valor',
    'sih',
    'Valor total das AIH',
    'Soma do valor total das internações (VALOR_TOTAL_AIH pré-calculado pelo SIHD).',
    'valor',
    'sum',
    $sql$
SELECT SUM(si.total_valor) AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sih.media_permanencia',
    'sih',
    'Permanência média (dias)',
    'Média de diárias por AIH na competência.',
    'valor',
    'valor_unico',
    $sql$
SELECT ROUND(
    SUM(si.total_diarias)::numeric / NULLIF(SUM(si.qtd_aih), 0),
    1
) AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sih.taxa_mortalidade',
    'sih',
    'Taxa de mortalidade (%)',
    'AIH com motivo de saída óbito (31 ou 32) sobre total de AIH × 100.',
    'valor',
    'valor_unico',
    $sql$
SELECT ROUND(
    SUM(CASE WHEN si.motivo_saida IN ('31','32') THEN si.qtd_aih ELSE 0 END)::numeric
    * 100.0 / NULLIF(SUM(si.qtd_aih), 0),
    2
) AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sih.pct_diarias_uti',
    'sih',
    'Ocupação UTI (%)',
    'Diárias UTI sobre total de diárias × 100.',
    'valor',
    'valor_unico',
    $sql$
SELECT ROUND(
    SUM(si.total_diarias_uti)::numeric * 100.0
    / NULLIF(SUM(si.total_diarias), 0),
    2
) AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sih.historico_mensal',
    'sih',
    'Série histórica — internações mensais',
    'AIH por competência (até 12 meses).',
    'valor',
    'historico',
    $sql$
SELECT to_char(si.competencia, 'YYYY-MM') AS competencia,
       SUM(si.qtd_aih)::bigint AS valor
FROM sih_internacoes si
WHERE si.competencia <= :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
GROUP BY si.competencia
ORDER BY si.competencia
LIMIT 12
$sql$,
    0
),
(
    'sih.internacoes_por_cid',
    'sih',
    'Internações por capítulo CID-10',
    'Top 10 capítulos CID-10 por número de AIH na competência.',
    'valor',
    'ranking_unidade',
    $sql$
SELECT LEFT(si.diag_principal, 1) AS unidade,
       SUM(si.qtd_aih)::bigint    AS valor
FROM sih_internacoes si
WHERE si.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL
       OR si.estabelecimento_id = :estabelecimento_id::bigint)
  AND si.diag_principal IS NOT NULL
  AND si.diag_principal <> ''
GROUP BY LEFT(si.diag_principal, 1)
ORDER BY valor DESC
LIMIT 10
$sql$,
    0
)
ON CONFLICT (chave) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. Seeds — widgets Painel Hospitalar Layout A
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
    sm.id,
    w.spark_config::jsonb,
    COALESCE(m.sql_template, sm.sql_template),
    w.delta_config::jsonb
FROM (VALUES
    (
        'total_aih',
        1,
        'card',
        'Total de internações',
        NULL,
        'numero',
        'sih.total_aih',
        '{}',
        'sih.historico_mensal',
        '{"campo":"valor","limite":12}',
        '{"tipo":"competencia_anterior","campo":"total_aih"}'
    ),
    (
        'total_valor',
        2,
        'card',
        'Valor total AIH',
        NULL,
        'moeda',
        'sih.total_valor',
        '{}',
        NULL,
        NULL,
        '{"tipo":"competencia_anterior","campo":"total_valor"}'
    ),
    (
        'media_permanencia',
        3,
        'card',
        'Permanência média',
        'dias/AIH',
        'numero',
        'sih.media_permanencia',
        '{}',
        NULL,
        NULL,
        '{"tipo":"fixo","label":"dias/internação"}'
    ),
    (
        'taxa_mortalidade',
        4,
        'card',
        'Taxa de mortalidade',
        NULL,
        'percentual',
        'sih.taxa_mortalidade',
        '{}',
        NULL,
        NULL,
        '{"tipo":"fixo","label":"óbitos/AIH × 100"}'
    ),
    (
        'pct_diarias_uti',
        5,
        'card',
        'Ocupação UTI',
        NULL,
        'percentual',
        'sih.pct_diarias_uti',
        '{}',
        NULL,
        NULL,
        '{"tipo":"fixo","label":"diárias UTI / total"}'
    ),
    (
        'total_diarias_uti',
        6,
        'card',
        'Diárias em UTI',
        NULL,
        'numero',
        'sih.total_diarias_uti',
        '{}',
        NULL,
        NULL,
        '{"tipo":"competencia_anterior","campo":"total_diarias_uti"}'
    ),
    (
        'trend_internacoes',
        7,
        'grafico_linha',
        'Internações mensais',
        'Série histórica',
        'numero',
        'sih.historico_mensal',
        '{"eixo_x":"competencia","eixo_y":"valor"}',
        NULL,
        NULL,
        NULL
    ),
    (
        'ranking_cid',
        8,
        'grafico_ranking',
        'Internações por capítulo CID-10',
        NULL,
        'numero',
        'sih.internacoes_por_cid',
        '{"eixo_label":"unidade","eixo_valor":"valor","limite":10}',
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
