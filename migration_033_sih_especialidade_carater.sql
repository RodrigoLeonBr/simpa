-- ============================================================================
-- SIMPA — Migration 033: especialidade + carater_internacao no grão agregado
--   sih_internacoes + métrica sih.internacoes_por_especialidade + widgets
--   ranking Hospitalar Layout C (especialidade e caráter).
-- Depends on: migration_013_sih_tabelas.sql (sih_internacoes) e
--             migration_024_sih_aih_widgets.sql (sih_aih, sih.internacoes_por_carater).
-- Apply order: … → 32 widgets_hospitalar_c → 33 sih_especialidade_carater
-- Safe to re-run (ADD COLUMN IF NOT EXISTS / ON CONFLICT DO NOTHING).
--
-- Após aplicar em produção: RE-IMPORTAR SIHD (sync_sih_mysql.py já popula as
-- 2 colunas no grão agregado). Em base já carregada sem re-import, use o
-- backfill a partir de sih_aih (ver seção 5, comentada — rodar manualmente).
--
-- Docker (container existente) — UTF-8 SAFE:
--   docker cp migration_033_sih_especialidade_carater.sql <container>:/tmp/m.sql
--   docker exec <container> psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/m.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colunas no grão agregado
-- ----------------------------------------------------------------------------
ALTER TABLE sih_internacoes
    ADD COLUMN IF NOT EXISTS especialidade      VARCHAR(4),
    ADD COLUMN IF NOT EXISTS carater_internacao VARCHAR(2);

COMMENT ON COLUMN sih_internacoes.especialidade IS
    'Especialidade do leito/AIH (s_aih.ESPECIALIDADE): 01 Cirurgia, 02 Obstetrícia, '
    '03 Clínica médica, 04 Crônicos, 05 Psiquiatria, 06 Tisiologia, 07 Pediatria, '
    '08 Reabilitação, 09 Hospital-dia.';
COMMENT ON COLUMN sih_internacoes.carater_internacao IS
    'Caráter da internação (s_aih.CARATER_INTERNACAO): 01 Eletiva, 02 Urgência.';

-- ----------------------------------------------------------------------------
-- 2. Recriar índice de grão incluindo as 2 dimensões novas
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_sih_int_grain;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sih_int_grain
    ON sih_internacoes
    (sincronizacao_id, cnes,
     COALESCE(proc_principal, ''),
     COALESCE(diag_principal, ''),
     COALESCE(complexidade, ''),
     COALESCE(financiamento, ''),
     COALESCE(motivo_saida, ''),
     COALESCE(sexo, ''),
     COALESCE(especialidade, ''),
     COALESCE(carater_internacao, ''));

-- ----------------------------------------------------------------------------
-- 3. Métrica: internações por especialidade (ranking, grão agregado)
-- ----------------------------------------------------------------------------
INSERT INTO painel_metricas_catalogo (
    chave, fonte_tipo, label, descricao,
    campo_json, agregacao, sql_template, ocorrencias
) VALUES
(
    'sih.internacoes_por_especialidade',
    'sih',
    'Internações por especialidade',
    'AIH por especialidade do leito na competência (top 10).',
    'valor',
    'ranking_unidade',
    $sql$
SELECT CASE si.especialidade
         WHEN '01' THEN 'Cirurgia'
         WHEN '02' THEN 'Obstetrícia'
         WHEN '03' THEN 'Clínica médica'
         WHEN '04' THEN 'Crônicos'
         WHEN '05' THEN 'Psiquiatria'
         WHEN '06' THEN 'Tisiologia'
         WHEN '07' THEN 'Pediatria'
         WHEN '08' THEN 'Reabilitação'
         WHEN '09' THEN 'Hospital-dia'
         ELSE COALESCE(NULLIF(si.especialidade, ''), 'Não informado')
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
-- 4. Widgets Hospitalar Layout C (grafico_ranking = tabela). ordem 4 e 5.
--    caráter reusa métrica sih.internacoes_por_carater (migration 024).
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
        'ranking_especialidade_c',
        4,
        'grafico_ranking',
        'Internações por especialidade',
        'SIHD · top 10 especialidades',
        'numero',
        'sih.internacoes_por_especialidade',
        '{"eixo_label":"unidade","eixo_valor":"valor","limite":10}'
    ),
    (
        'ranking_carater_c',
        5,
        'grafico_ranking',
        'Internações por caráter',
        'SIHD · eletiva vs urgência',
        'numero',
        'sih.internacoes_por_carater',
        '{"eixo_label":"unidade","eixo_valor":"valor","limite":10}'
    )
) AS w(
    slug, ordem, tipo, titulo, subtitulo, formato, metrica_chave, fonte_config
)
JOIN painel_metricas_catalogo m ON m.chave = w.metrica_chave
ON CONFLICT (perfil, layout, slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. Backfill (base já carregada, sem re-import do MySQL) — RODAR MANUALMENTE.
--    Re-agrega sih_aih (grão AIH, já tem especialidade+carater) no novo grão.
--    Não incluído no fluxo automático porque é destrutivo (DELETE) e no init
--    Docker sih_aih está vazio.
-- ----------------------------------------------------------------------------
-- BEGIN;
-- DELETE FROM sih_internacoes;
-- INSERT INTO sih_internacoes (
--     sincronizacao_id, competencia, cnes, estabelecimento_id,
--     proc_principal, diag_principal, complexidade, financiamento,
--     motivo_saida, sexo, especialidade, carater_internacao,
--     qtd_aih, total_diarias, total_diarias_uti, total_valor,
--     media_idade, media_diarias)
-- SELECT sincronizacao_id, competencia, cnes, estabelecimento_id,
--        proc_principal, diag_principal, complexidade, financiamento,
--        motivo_saida, sexo, especialidade, carater_internacao,
--        COUNT(DISTINCT aih), SUM(diarias), SUM(diarias_uti), SUM(valor_total),
--        AVG(idade), AVG(diarias)
-- FROM sih_aih
-- GROUP BY sincronizacao_id, competencia, cnes, estabelecimento_id,
--          proc_principal, diag_principal, complexidade, financiamento,
--          motivo_saida, sexo, especialidade, carater_internacao;
-- COMMIT;
