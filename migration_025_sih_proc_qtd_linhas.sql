-- ============================================================================
-- SIMPA — Migration 025: sih_procedimentos.qtd_linhas (linhas brutas s_aih_pa)
-- Depends on: migration_013 … migration_024
-- Safe to re-run (IF NOT EXISTS).
--
-- Conta linhas HPA originais por grupo agregado (COUNT(*) no MySQL), para o
-- histórico de importação exibir o total comparável ao ConsultaSIA (não o
-- número de grupos gerenciais).
-- ============================================================================

ALTER TABLE sih_procedimentos
    ADD COLUMN IF NOT EXISTS qtd_linhas INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN sih_procedimentos.qtd_linhas IS
    'Quantidade de linhas brutas em s_aih_pa que formaram este grupo agregado (COUNT(*) no MySQL).';
