-- ============================================================================
-- SIMPA — Migration 016: Corrige títulos/subtítulos UTF-8 em painel_widgets
-- Depends on: migration_008 … migration_015
--
-- Causa: aplicação manual via PowerShell sem -Encoding UTF8 corrompe acentos.
-- Manual apply (Windows):
--   Get-Content migration_016_fix_painel_widgets_utf8.sql -Encoding UTF8 |
--     docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- ============================================================================

UPDATE painel_widgets w
SET
    titulo = v.titulo,
    subtitulo = v.subtitulo,
    atualizado_em = now()
FROM (
    VALUES
        -- APS Layout A
        ('APS', 'A', 'odonto', 'Produção odontológica', NULL::varchar),
        ('APS', 'A', 'atendimentos', 'Atendimentos individuais', NULL::varchar),
        ('APS', 'A', 'cobertura', 'Cobertura APS', NULL::varchar),
        ('APS', 'A', 'equipes', 'Equipes ativas', NULL::varchar),
        ('APS', 'A', 'metas', 'Metas atingidas', 'Comp. Qualidade'),
        ('APS', 'A', 'coletivas', 'Atividades coletivas', NULL::varchar),
        ('APS', 'A', 'trend_atendimentos', 'Atendimentos individuais', 'Série histórica'),
        ('APS', 'A', 'ranking_unidades', 'Produção por unidade · top 6', NULL::varchar),
        -- Hospitalar Layout A
        ('Hospitalar', 'A', 'total_aih', 'Total de internações', NULL::varchar),
        ('Hospitalar', 'A', 'total_valor', 'Valor total AIH', NULL::varchar),
        ('Hospitalar', 'A', 'media_permanencia', 'Permanência média', 'dias/AIH'),
        ('Hospitalar', 'A', 'taxa_mortalidade', 'Taxa de mortalidade', NULL::varchar),
        ('Hospitalar', 'A', 'pct_diarias_uti', 'Ocupação UTI', NULL::varchar),
        ('Hospitalar', 'A', 'total_diarias_uti', 'Diárias em UTI', NULL::varchar),
        ('Hospitalar', 'A', 'trend_internacoes', 'Internações mensais', 'Série histórica'),
        ('Hospitalar', 'A', 'ranking_cid', 'Internações por capítulo CID-10', NULL::varchar),
        -- MAC Layout A
        ('MAC', 'A', 'sia_producao_qtd', 'Procedimentos aprovados', 'Produção SIA · mês'),
        ('MAC', 'A', 'sia_valor_aprovado', 'Valor aprovado', 'Financeiro · mês'),
        ('MAC', 'A', 'sia_taxa_aprovacao', 'Taxa de aprovação', 'Quantidade · mês'),
        ('MAC', 'A', 'sia_taxa_glosa', 'Taxa de glosa', 'Financeiro · mês'),
        ('MAC', 'A', 'sia_producao_mac', 'Produção MAC', 'Rubrica 0301'),
        ('MAC', 'A', 'sia_variacao_quadrimestre', 'Variação quadrimestral', 'vs quadrimestre anterior'),
        ('MAC', 'A', 'sia_variacao_anual', 'Variação anual', 'YTD vs ano anterior'),
        ('MAC', 'A', 'oci_exames_diagnostico', 'Exames diagnósticos', 'OCI/PATE · grupo 02'),
        ('MAC', 'A', 'oci_consultas_especializadas', 'Consultas especializadas', 'OCI/PATE · 0303'),
        ('MAC', 'A', 'oci_alcance_meta_par', 'Alcance meta PAR', 'OCI · meta > 85%'),
        ('MAC', 'A', 'pate_ambulatorial_valor', 'PATE ambulatorial', 'Valor mensal MAC/FAEC/TFD'),
        ('MAC', 'A', 'oci_absenteismo', 'Absenteísmo OCI', 'Meta < 20%'),
        ('MAC', 'A', 'sia_trend_producao', 'Produção SIA mensal', 'Quantidade aprovada'),
        ('MAC', 'A', 'sia_trend_financeiro', 'Valor aprovado mensal', 'Série financeira'),
        ('MAC', 'A', 'sia_ranking_unidades', 'Top unidades · valor SIA', NULL::varchar),
        ('MAC', 'A', 'sia_ranking_rubricas', 'Produção por rubrica', 'Financiamento'),
        ('MAC', 'A', 'pate_trend_ambulatorial', 'PATE — valor ambulatorial', 'Série mensal'),
        ('MAC', 'A', 'apac_distintas', 'APAC distintas', 'Produção OCI · mês'),
        ('MAC', 'A', 'apac_por_oci', 'APAC por tipo OCI', 'Conforme metas PAR')
) AS v(perfil, layout, slug, titulo, subtitulo)
WHERE w.perfil = v.perfil
  AND w.layout = v.layout
  AND w.slug = v.slug;
