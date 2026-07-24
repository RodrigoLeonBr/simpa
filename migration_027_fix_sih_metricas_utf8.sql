-- ============================================================================
-- SIMPA — Migration 027: Corrige UTF-8 em métricas SIH + formas_sia
-- Depends on: migration_013 … migration_024, migration_021
--
-- Causa: migrations 013/024 (e sync forma) aplicadas via PowerShell sem UTF-8
-- corrompem acentos (??). A 021 cobriu e-SUS/SIA/PATE; esta completa SIH +
-- as 5 formas "Atenção em …".
--
-- Manual apply (Windows — NÃO use pipe Get-Content; corrompe UTF-8):
--   docker cp migration_027_fix_sih_metricas_utf8.sql <container>:/tmp/m027.sql
--   docker exec <container> psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/m027.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. painel_metricas_catalogo — chaves sih.*
-- ----------------------------------------------------------------------------
UPDATE painel_metricas_catalogo m
SET
    label = v.label,
    descricao = v.descricao
FROM (
    VALUES
        (
            'sih.total_aih',
            'Total de internações (AIH)',
            'Soma de AIH distintas no grão gerencial da competência.'
        ),
        (
            'sih.total_diarias',
            'Total de diárias',
            'Soma de diárias de internação na competência.'
        ),
        (
            'sih.total_diarias_uti',
            'Diárias em UTI',
            'Soma de diárias em UTI na competência.'
        ),
        (
            'sih.total_valor',
            'Valor total das AIH',
            'Soma do valor total das internações (VALOR_TOTAL_AIH pré-calculado pelo SIHD).'
        ),
        (
            'sih.media_permanencia',
            'Permanência média (dias)',
            'Média de diárias por AIH na competência.'
        ),
        (
            'sih.taxa_mortalidade',
            'Taxa de mortalidade (%)',
            'AIH com motivo de saída óbito (31 ou 32) sobre total de AIH × 100.'
        ),
        (
            'sih.pct_diarias_uti',
            'Ocupação UTI (%)',
            'Diárias UTI sobre total de diárias × 100.'
        ),
        (
            'sih.historico_mensal',
            'Série histórica — internações mensais',
            'AIH por competência (até 12 meses).'
        ),
        (
            'sih.internacoes_por_cid',
            'Internações por capítulo CID-10',
            'Top 10 capítulos CID-10 por número de AIH na competência.'
        ),
        (
            'sih.permanencia_media_real',
            'Permanência média real (dias)',
            'Média de (dt_saida − dt_internacao) por AIH com ambas as datas preenchidas.'
        ),
        (
            'sih.pct_obito_cid',
            'AIH com CID de óbito (%)',
            'Percentual de AIH com cid_obito preenchido na competência.'
        ),
        (
            'sih.internacoes_por_carater',
            'Internações por caráter',
            'AIH por caráter de internação (eletiva / urgência / não informado).'
        )
) AS v(chave, label, descricao)
WHERE m.chave = v.chave;

-- ----------------------------------------------------------------------------
-- 2. painel_widgets Hospitalar — slugs da migration 024 (idempotente)
-- ----------------------------------------------------------------------------
UPDATE painel_widgets w
SET
    titulo = v.titulo,
    subtitulo = v.subtitulo,
    atualizado_em = now()
FROM (
    VALUES
        ('Hospitalar', 'A', 'permanencia_media_real', 'Permanência média real', 'dias (saída − internação)'::varchar),
        ('Hospitalar', 'A', 'pct_obito_cid', 'AIH com CID de óbito', NULL::varchar),
        ('Hospitalar', 'A', 'ranking_carater', 'Internações por caráter', NULL::varchar)
) AS v(perfil, layout, slug, titulo, subtitulo)
WHERE w.perfil = v.perfil
  AND w.layout = v.layout
  AND w.slug = v.slug;

-- ----------------------------------------------------------------------------
-- 3. formas_sia — "Atenção em …" (espelho MySQL com ? no lugar de ç/ã)
-- ----------------------------------------------------------------------------
UPDATE formas_sia f
SET descricao = v.descricao
FROM (
    VALUES
        ('090100', 'Atenção em Oncologia'),
        ('090200', 'Atenção em Cardiologia'),
        ('090300', 'Atenção em Ortopedia'),
        ('090400', 'Atenção em Otorrinolaringologia'),
        ('090500', 'Atenção em Oftalmologia')
) AS v(codigo_forma, descricao)
WHERE f.codigo_forma = v.codigo_forma;
