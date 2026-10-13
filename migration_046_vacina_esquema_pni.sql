-- =============================================================================
-- SIMPA — Migration 046: seed do esquema vacinal PNI (núcleo de rotina)
-- Depends on: migration_036_vacinas.sql, migration_045_vacina_grupos_seed.sql
--
-- GUARD: só popula quando vacina_esquema está VAZIA. Após restaurar backup de
-- outro servidor, re-rode esta migration (045 antes) para repor o esquema sem
-- sobrescrever ajustes manuais (WHERE NOT EXISTS + ON CONFLICT DO NOTHING).
-- Join por slug do grupo → robusto a IDs diferentes entre servidores.
--
-- Escopo: calendário PNI de rotina, onde o denominador é a coorte etária
-- (cobertura = frações de esquema completo). num_doses = nº de doses do
-- esquema administradas DENTRO da janela etária do grupo (reforços contam no
-- grupo onde ocorrem). Vacinas de campanha/sazonal/público especial ficam de
-- fora (não-alvo): COVID, Dengue, VSR, Nirsevimabe, Herpes-zóster, Pneumo
-- 13/15/20/23, Hib isolada, Raiva, Febre tifóide, Soro, DTPa variantes.
--
-- Manual (non-Docker PG):
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_046_vacina_esquema_pni.sql
-- Docker:
--   Get-Content migration_046_vacina_esquema_pni.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- =============================================================================

INSERT INTO vacina_esquema (imuno_codigo, grupo_id, num_doses)
SELECT v.imuno, g.id, v.num_doses
FROM (VALUES
    -- Crianças menores de 1 ano -------------------------------------------
    ('15', 'criancas-menores-1-ano', 1),  -- BCG (ao nascer)
    ('9',  'criancas-menores-1-ano', 1),  -- Hepatite B (dose ao nascer)
    ('42', 'criancas-menores-1-ano', 3),  -- Penta (2,4,6 m)
    ('22', 'criancas-menores-1-ano', 3),  -- Polio injetável VIP (2,4,6 m)
    ('26', 'criancas-menores-1-ano', 2),  -- Pneumo 10 (2,4 m)
    ('45', 'criancas-menores-1-ano', 2),  -- Rotavírus (2,4 m)
    ('41', 'criancas-menores-1-ano', 2),  -- Meningo C (3,5 m)
    ('78', 'criancas-menores-1-ano', 2),  -- Meningo B (3,5 m)
    ('14', 'criancas-menores-1-ano', 1),  -- Febre amarela (9 m)
    -- Crianças de 1 ano (reforços 12/15 m) --------------------------------
    ('24', 'criancas-1-ano', 1),  -- SCR tríplice viral (12 m)
    ('56', 'criancas-1-ano', 1),  -- SCRV tetra viral (15 m)
    ('26', 'criancas-1-ano', 1),  -- Pneumo 10 reforço (12 m)
    ('41', 'criancas-1-ano', 1),  -- Meningo C reforço (12 m)
    ('78', 'criancas-1-ano', 1),  -- Meningo B reforço (12 m)
    ('55', 'criancas-1-ano', 1),  -- Hepatite A (15 m)
    ('46', 'criancas-1-ano', 1),  -- DTP 1º reforço (15 m)
    ('22', 'criancas-1-ano', 1),  -- Polio 1º reforço (15 m)
    -- Crianças de 2 a 4 anos (reforços 4 anos) ----------------------------
    ('46', 'criancas-2-4-anos', 1),  -- DTP 2º reforço (4 a)
    ('22', 'criancas-2-4-anos', 1),  -- Polio 2º reforço (4 a)
    ('14', 'criancas-2-4-anos', 1),  -- Febre amarela reforço (4 a)
    ('34', 'criancas-2-4-anos', 1),  -- Varicela 2ª dose (4 a)
    -- Adolescentes 12 a 17 anos -------------------------------------------
    ('67', 'adolescentes-12-17-anos', 1),  -- HPV quadrivalente (dose única 9-14)
    ('74', 'adolescentes-12-17-anos', 1),  -- Meningo ACWY (11-14)
    -- Adultos 18 a 59 anos ------------------------------------------------
    ('25', 'adultos-18-59-anos', 3),  -- dT dupla adulto (esquema básico)
    ('9',  'adultos-18-59-anos', 3),  -- Hepatite B (não vacinados)
    ('14', 'adultos-18-59-anos', 1),  -- Febre amarela (dose única até 59 a)
    -- Idosos 60 anos ou mais ----------------------------------------------
    ('33', 'idosos-60-mais', 1),  -- Influenza (campanha anual)
    ('25', 'idosos-60-mais', 1)   -- dT reforço (10/10 anos)
) AS v(imuno, slug, num_doses)
JOIN vacina_grupos g ON g.slug = v.slug
WHERE NOT EXISTS (SELECT 1 FROM vacina_esquema)
ON CONFLICT (imuno_codigo, grupo_id) DO NOTHING;
