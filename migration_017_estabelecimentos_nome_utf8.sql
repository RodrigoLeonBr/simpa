-- ============================================================================
-- SIMPA — Migration 017: Corrige nomes UTF-8 em estabelecimentos + nome_editado
-- Depends on: migration_004 … migration_016
--
-- Causa: espelho MySQL (prestador.re_cnome) contém '?' no lugar de acentos.
-- Manual apply (Windows):
--   Get-Content migration_017_estabelecimentos_nome_utf8.sql -Encoding UTF8 |
--     docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- ============================================================================

ALTER TABLE estabelecimentos
    ADD COLUMN IF NOT EXISTS nome_editado BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN estabelecimentos.nome_editado IS
    'Quando true, sync MySQL não sobrescreve nome (correção manual/UTF-8).';

UPDATE estabelecimentos e
SET
    nome = v.nome,
    nome_editado = true
FROM (
    VALUES
        ('5129915', 'CENTRO ATENÇÃO PSICOSOCIAL INFANTIL'),
        ('7169698', 'CAFI - CENTRO DE ASSISTÊNCIA A FAMÍLIA E AO IDOSO'),
        ('7218893', 'CENTRO AT SAÚDE DO HOMEM E MULHER'),
        ('2028077', 'DIGIMAX UNIDADE RADIOLÓGICA'),
        ('5881846', 'DA VINCI CLÍNICA MÉDICA/DR HERMINIO'),
        ('3120368', 'ASSISTÊNCIA E SAÚDE'),
        ('0751073', 'B&B SERVIÇOS MÉDICOS'),
        ('3687554', 'CLÍNICA MÉDICA CÁSIMO')
) AS v(codigo_externo, nome)
WHERE e.codigo_externo = v.codigo_externo;
