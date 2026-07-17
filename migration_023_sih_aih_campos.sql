-- ============================================================================
-- SIMPA — Migration 023: campos extras em sih_aih (grão AIH)
--   carater_internacao, diag_secundario, cid_obito, dt_internacao, dt_saida
-- Depends on: migration_020_sih_aih.sql
-- Apply order: … → 22 → 23 sih_aih_campos
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).
--
-- Manual apply:
--   Get-Content migration_023_sih_aih_campos.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- ============================================================================

ALTER TABLE sih_aih
    ADD COLUMN IF NOT EXISTS carater_internacao VARCHAR(2),
    ADD COLUMN IF NOT EXISTS diag_secundario    VARCHAR(4),
    ADD COLUMN IF NOT EXISTS cid_obito          VARCHAR(4),
    ADD COLUMN IF NOT EXISTS dt_internacao      DATE,
    ADD COLUMN IF NOT EXISTS dt_saida           DATE;

COMMENT ON COLUMN sih_aih.carater_internacao IS
    'Caráter da internação (s_aih.CARATER_INTERNACAO): 01 eletiva, 02 urgência, etc.';
COMMENT ON COLUMN sih_aih.diag_secundario IS 'CID-10 diagnóstico secundário (s_aih.DIAG_SECUNDARIO).';
COMMENT ON COLUMN sih_aih.cid_obito IS 'CID-10 do óbito, quando houver (s_aih.CID_OBITO).';
COMMENT ON COLUMN sih_aih.dt_internacao IS 'Data de internação (s_aih.DT_INT, AAAAMMDD → DATE).';
COMMENT ON COLUMN sih_aih.dt_saida IS 'Data de saída (s_aih.DT_SAIDA, AAAAMMDD → DATE).';
