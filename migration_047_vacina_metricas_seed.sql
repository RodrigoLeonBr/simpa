-- =============================================================================
-- SIMPA — Migration 047: seed de métricas de vacina no catálogo do Painel
-- Depends on: migration_008_painel_widgets.sql, migration_036 + 045/046 (vacinas)
--
-- GUARD: só popula quando ainda não há métrica vacina.* (sobrevive a restore;
-- re-rode após subir backup). Join/assunção: tabelas vacina_* já existem.
-- fonte_tipo='consolidado' (CHECK do catálogo não tem 'vacina').
-- Placeholders válidos: :competencia_inicio/:fim (YYYY-MM-01). Proração de
-- cobertura % é feita por sql_override no widget (EXTRACT(MONTH ...)/12.0).
--
-- Manual:  psql -h localhost -p 5433 -U postgres -d simpa -f migration_047_vacina_metricas_seed.sql
-- Docker:  Get-Content migration_047_vacina_metricas_seed.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- =============================================================================

INSERT INTO painel_metricas_catalogo (chave, fonte_tipo, label, descricao, agregacao, sql_template, status, ocorrencias)
SELECT v.chave, 'consolidado', v.label, v.descricao, v.agregacao, v.sql_template, 'ativo', 0
FROM (VALUES
  (
    'vacina.doses_total',
    'Vacinas · Doses aplicadas (período)',
    'Total de doses aplicadas no período selecionado.',
    'valor_unico',
    $sql$SELECT COALESCE(SUM(d.doses), 0)::bigint AS valor
FROM vacina_doses d
WHERE d.competencia BETWEEN :competencia_inicio::date AND :competencia_fim::date$sql$
  ),
  (
    'vacina.doses_serie',
    'Vacinas · Doses por mês (ano)',
    'Série mensal de doses de janeiro até o mês selecionado.',
    'historico',
    $sql$SELECT to_char(d.competencia, 'YYYY-MM') AS competencia,
       COALESCE(SUM(d.doses), 0)::bigint AS valor
FROM vacina_doses d
WHERE d.competencia BETWEEN make_date(EXTRACT(YEAR FROM :competencia_fim::date)::int, 1, 1)
                        AND :competencia_fim::date
GROUP BY d.competencia
ORDER BY d.competencia$sql$
  ),
  (
    'vacina.ranking_vacina',
    'Vacinas · Ranking por imunobiológico',
    'Top imunobiológicos por doses no período.',
    'ranking_unidade',
    $sql$SELECT COALESCE(i.imuno_nome, d.imuno_codigo) AS unidade,
       COALESCE(SUM(d.doses), 0)::bigint AS valor
FROM vacina_doses d
LEFT JOIN vacina_imunobiologicos i ON i.imuno_codigo = d.imuno_codigo
WHERE d.competencia BETWEEN :competencia_inicio::date AND :competencia_fim::date
GROUP BY 1
ORDER BY valor DESC
LIMIT 10$sql$
  )
) AS v(chave, label, descricao, agregacao, sql_template)
WHERE NOT EXISTS (SELECT 1 FROM painel_metricas_catalogo WHERE chave LIKE 'vacina.%')
ON CONFLICT (chave) DO NOTHING;
