-- =============================================================================
-- SIMPA — Migration 045: seed de grupos vacinais + de-para faixa→grupo + pop-alvo
-- Depends on: migration_036_vacinas.sql
-- Idempotente (ON CONFLICT / UPDATE por slug). Re-run seguro.
--
-- Grupos por fase de vida (calendário PNI). População-alvo = Censo IBGE 2022,
-- Americana/SP (cód. 3501608), tabela SIDRA 9514, agregada por idade simples.
-- Validação: <15 anos = 38.723 e 60+ = 45.060 batem com o resumo oficial;
-- soma dos 7 grupos = 237.240 (total do município no Censo 2022).
--
-- Manual (non-Docker PG):
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_045_vacina_grupos_seed.sql
-- Docker:
--   Get-Content migration_045_vacina_grupos_seed.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- =============================================================================

-- 1) Grupos populacionais -----------------------------------------------------
INSERT INTO vacina_grupos (nome, slug, ordem) VALUES
    ('Crianças menores de 1 ano',   'criancas-menores-1-ano',   10),
    ('Crianças de 1 ano',           'criancas-1-ano',           20),
    ('Crianças de 2 a 4 anos',      'criancas-2-4-anos',        30),
    ('Crianças de 5 a 11 anos',     'criancas-5-11-anos',       40),
    ('Adolescentes de 12 a 17 anos','adolescentes-12-17-anos',  50),
    ('Adultos de 18 a 59 anos',     'adultos-18-59-anos',       60),
    ('Idosos de 60 anos ou mais',   'idosos-60-mais',           70)
ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem;

-- 2) De-para faixa_nies → grupo ----------------------------------------------
UPDATE vacina_faixa_grupo SET grupo_id = (SELECT id FROM vacina_grupos WHERE slug='criancas-menores-1-ano')
 WHERE faixa_nies IN ('< 30 dias', '< 01 ano');

UPDATE vacina_faixa_grupo SET grupo_id = (SELECT id FROM vacina_grupos WHERE slug='criancas-1-ano')
 WHERE faixa_nies = '01 ano';

UPDATE vacina_faixa_grupo SET grupo_id = (SELECT id FROM vacina_grupos WHERE slug='criancas-2-4-anos')
 WHERE faixa_nies = '02 a 04 anos';

UPDATE vacina_faixa_grupo SET grupo_id = (SELECT id FROM vacina_grupos WHERE slug='criancas-5-11-anos')
 WHERE faixa_nies = '05 a 11 anos';

UPDATE vacina_faixa_grupo SET grupo_id = (SELECT id FROM vacina_grupos WHERE slug='adolescentes-12-17-anos')
 WHERE faixa_nies = '12 a 17 anos';

UPDATE vacina_faixa_grupo SET grupo_id = (SELECT id FROM vacina_grupos WHERE slug='adultos-18-59-anos')
 WHERE faixa_nies IN ('18 a 19 anos','20 a 24 anos','25 a 29 anos','30 a 34 anos',
                      '35 a 39 anos','40 a 44 anos','45 a 49 anos','50 a 54 anos','55 a 59 anos');

UPDATE vacina_faixa_grupo SET grupo_id = (SELECT id FROM vacina_grupos WHERE slug='idosos-60-mais')
 WHERE faixa_nies IN ('60 a 64 anos','65 a 69 anos','70 a 74 anos','75 a 79 anos','80 anos ou mais');

-- 3) População-alvo 2026 (Censo IBGE 2022) -----------------------------------
INSERT INTO vacina_populacao_alvo (ano, grupo_id, populacao)
SELECT 2026, g.id, v.pop
FROM (VALUES
    ('criancas-menores-1-ano',    2320),
    ('criancas-1-ano',            2232),
    ('criancas-2-4-anos',         7749),
    ('criancas-5-11-anos',       18494),
    ('adolescentes-12-17-anos',  16187),
    ('adultos-18-59-anos',      145198),
    ('idosos-60-mais',           45060)
) AS v(slug, pop)
JOIN vacina_grupos g ON g.slug = v.slug
ON CONFLICT (ano, grupo_id) DO UPDATE SET populacao = EXCLUDED.populacao;
