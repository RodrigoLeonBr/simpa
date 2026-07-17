-- ============================================================================
-- SIMPA — Migration 015: APAC no SIA + metas OCI/PAR + métricas ativas
-- Depends on: … migration_014_sia_painel_indicadores.sql
-- ============================================================================

-- 1. Coluna APAC em sia_producao
ALTER TABLE sia_producao
    ADD COLUMN IF NOT EXISTS apac_num VARCHAR(13);

CREATE INDEX IF NOT EXISTS idx_sia_producao_apac
    ON sia_producao (competencia, apac_num)
    WHERE apac_num IS NOT NULL AND BTRIM(apac_num) <> '';

COMMENT ON COLUMN sia_producao.apac_num IS
    'Número APAC (PRD_APANUM no MySQL). Vazio = produção BPA sem APAC.';

-- 2. Ajuste UNIQUE para incluir APAC no grão
DO $$
DECLARE
    legacy_unique_name TEXT;
BEGIN
    SELECT c.conname
      INTO legacy_unique_name
      FROM pg_constraint c
     WHERE c.conrelid = 'sia_producao'::regclass
       AND c.contype = 'u'
       AND c.conname = 'uq_sia_producao_grupo_cnes';

    IF legacy_unique_name IS NOT NULL THEN
        ALTER TABLE sia_producao DROP CONSTRAINT uq_sia_producao_grupo_cnes;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_sia_producao_grupo_cnes_apac'
          AND conrelid = 'sia_producao'::regclass
    ) THEN
        ALTER TABLE sia_producao
            ADD CONSTRAINT uq_sia_producao_grupo_cnes_apac
            UNIQUE NULLS NOT DISTINCT (
                sincronizacao_id, cnes, codigo_sigtap, faixa_etaria, sexo, cbo, rubrica, apac_num
            );
    END IF;
END $$;

-- 3. Metas OCI previstas no PAR (PMAE/PATE)
CREATE TABLE IF NOT EXISTS metas_oci_par (
    id                  BIGSERIAL PRIMARY KEY,
    competencia         DATE NOT NULL,
    tipo_oci            VARCHAR(60) NOT NULL,
    estabelecimento_id  BIGINT REFERENCES estabelecimentos(id) ON DELETE SET NULL,
    meta_quantidade     INT NOT NULL DEFAULT 0 CHECK (meta_quantidade >= 0),
    meta_valor          NUMERIC(15,2),
    codigo_sigtap_prefix VARCHAR(10),
    periodicidade       VARCHAR(20) NOT NULL DEFAULT 'mensal'
        CHECK (periodicidade IN ('mensal', 'quadrimestral', 'anual')),
    origem              VARCHAR(80) NOT NULL DEFAULT 'PAR-PMAE',
    status              VARCHAR(20) NOT NULL DEFAULT 'ativo',
    criado_em           TIMESTAMP NOT NULL DEFAULT now(),
    atualizado_em       TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE NULLS NOT DISTINCT (competencia, tipo_oci, estabelecimento_id, periodicidade)
);

CREATE INDEX IF NOT EXISTS idx_metas_oci_par_competencia
    ON metas_oci_par (competencia, status, periodicidade);

COMMENT ON TABLE metas_oci_par IS
    'Metas de produção OCI pactuadas no PAR (PMAE/PATE). Alimenta indicador de alcance no Painel MAC.';

-- 4. Seed metas PAR ilustrativas (município — estabelecimento_id NULL)
INSERT INTO metas_oci_par (
    competencia, tipo_oci, meta_quantidade, codigo_sigtap_prefix, periodicidade, origem
) VALUES
    (DATE '2026-01-01', 'cardiologia', 120, '0303', 'mensal', 'PAR-PMAE'),
    (DATE '2026-01-01', 'ortopedia', 80, '0303', 'mensal', 'PAR-PMAE'),
    (DATE '2026-01-01', 'oftalmologia', 100, '0303', 'mensal', 'PAR-PMAE'),
    (DATE '2026-01-01', 'otorrinolaringologia', 60, '0303', 'mensal', 'PAR-PMAE'),
    (DATE '2026-01-01', 'oncologia', 40, '0303', 'mensal', 'PAR-PMAE'),
    (DATE '2026-01-01', 'exames_diagnostico', 500, '02', 'mensal', 'PAR-PMAE')
ON CONFLICT DO NOTHING;

-- 5. Métricas APAC/OCI (ativas)
INSERT INTO painel_metricas_catalogo (
    chave, fonte_tipo, label, descricao, campo_json, agregacao, sql_template, ocorrencias
) VALUES
(
    'sia.apac_distintas_mes',
    'sia',
    'APAC distintas (mês)',
    'Contagem de números APAC distintos com produção na competência.',
    'valor',
    'valor_unico',
    $sql$
SELECT COUNT(DISTINCT sp.apac_num)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND sp.apac_num IS NOT NULL AND BTRIM(sp.apac_num) <> ''
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sia.apac_producao_qtd',
    'sia',
    'Procedimentos via APAC',
    'Soma de quantidade aprovada em linhas com APAC vinculada.',
    'valor',
    'sum',
    $sql$
SELECT COALESCE(SUM(sp.quantidade), 0)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND sp.apac_num IS NOT NULL AND BTRIM(sp.apac_num) <> ''
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$,
    0
),
(
    'sia.apac_por_tipo_oci',
    'sia',
    'APAC por tipo OCI (PAR)',
    'APAC distintas por tipo OCI conforme metas PAR da competência.',
    'valor',
    'ranking_unidade',
    $sql$
SELECT m.tipo_oci AS unidade,
       COUNT(DISTINCT sp.apac_num)::bigint AS valor
FROM metas_oci_par m
LEFT JOIN sia_producao sp
       ON sp.competencia = :competencia::date
      AND sp.apac_num IS NOT NULL AND BTRIM(sp.apac_num) <> ''
      AND (m.codigo_sigtap_prefix IS NULL
           OR LEFT(sp.codigo_sigtap, LENGTH(m.codigo_sigtap_prefix)) = m.codigo_sigtap_prefix)
      AND (m.estabelecimento_id IS NULL
           OR sp.estabelecimento_id = m.estabelecimento_id)
WHERE m.competencia = :competencia::date
  AND m.status = 'ativo'
  AND m.periodicidade = 'mensal'
GROUP BY m.tipo_oci
ORDER BY valor DESC
LIMIT 10
$sql$,
    0
)
ON CONFLICT (chave) DO NOTHING;

-- 6. Atualizar placeholders OCI → métricas reais
UPDATE painel_metricas_catalogo
SET fonte_tipo = 'sia',
    label = 'Produção APAC (procedimentos)',
    descricao = 'Soma de procedimentos aprovados em linhas com APAC (PRD_APANUM).',
    agregacao = 'sum',
    sql_template = $sql$
SELECT COALESCE(SUM(sp.quantidade), 0)::bigint AS valor
FROM sia_producao sp
WHERE sp.competencia = :competencia::date
  AND sp.apac_num IS NOT NULL AND BTRIM(sp.apac_num) <> ''
  AND (:estabelecimento_id::bigint IS NULL
       OR sp.estabelecimento_id = :estabelecimento_id::bigint)
$sql$
WHERE chave = 'sia.oci_apac_producao_qtd';

UPDATE painel_metricas_catalogo
SET fonte_tipo = 'sia',
    label = 'OCI — alcance meta PAR (%)',
    descricao = 'Produção APAC / meta_quantidade PAR × 100 na competência.',
    agregacao = 'valor_unico',
    sql_template = $sql$
WITH realizado AS (
  SELECT COALESCE(SUM(sp.quantidade), 0)::numeric AS v
  FROM sia_producao sp
  WHERE sp.competencia = :competencia::date
    AND sp.apac_num IS NOT NULL AND BTRIM(sp.apac_num) <> ''
    AND (:estabelecimento_id::bigint IS NULL
         OR sp.estabelecimento_id = :estabelecimento_id::bigint)
),
meta AS (
  SELECT COALESCE(SUM(m.meta_quantidade), 0)::numeric AS v
  FROM metas_oci_par m
  WHERE m.competencia = :competencia::date
    AND m.status = 'ativo'
    AND m.periodicidade = 'mensal'
    AND (m.estabelecimento_id IS NULL
         OR :estabelecimento_id::bigint IS NULL
         OR m.estabelecimento_id = :estabelecimento_id::bigint)
)
SELECT ROUND(realizado.v * 100.0 / NULLIF(meta.v, 0), 2) AS valor
FROM realizado, meta
$sql$
WHERE chave = 'sia.oci_alcance_meta_par_pct';

-- absenteísmo permanece placeholder até SISREG
UPDATE painel_metricas_catalogo
SET descricao = 'Indicador PMAE #2. Requer integração SISREG/filas (lacuna conhecida).'
WHERE chave = 'sia.oci_absenteismo_pct';

-- 7. Widget APAC distintas no Painel MAC
INSERT INTO painel_widgets (
    slug, perfil, layout, ordem, tipo, titulo, subtitulo, formato,
    metrica_id, fonte_config, spark_metrica_id, spark_config, sql_preview, delta_config
)
SELECT
    'apac_distintas',
    'MAC', 'A', 18, 'card', 'APAC distintas', 'Produção OCI · mês',
    'numero', m.id, '{}', NULL, NULL, m.sql_template,
    '{"tipo":"competencia_anterior","campo":"apac"}'::jsonb
FROM painel_metricas_catalogo m
WHERE m.chave = 'sia.apac_distintas_mes'
ON CONFLICT (perfil, layout, slug) DO NOTHING;

INSERT INTO painel_widgets (
    slug, perfil, layout, ordem, tipo, titulo, subtitulo, formato,
    metrica_id, fonte_config, spark_metrica_id, spark_config, sql_preview, delta_config
)
SELECT
    'apac_por_oci',
    'MAC', 'A', 19, 'grafico_ranking', 'APAC por tipo OCI', 'Conforme metas PAR',
    'numero', m.id,
    '{"eixo_label":"unidade","eixo_valor":"valor","limite":10}'::jsonb,
    NULL, NULL, m.sql_template, NULL
FROM painel_metricas_catalogo m
WHERE m.chave = 'sia.apac_por_tipo_oci'
ON CONFLICT (perfil, layout, slug) DO NOTHING;
