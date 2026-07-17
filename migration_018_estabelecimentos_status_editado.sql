-- ============================================================================
-- SIMPA — Migration 018: status_editado em estabelecimentos
-- Depends on: migration_017 …
-- ============================================================================

ALTER TABLE estabelecimentos
    ADD COLUMN IF NOT EXISTS status_editado BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN estabelecimentos.status_editado IS
    'Quando true, sync MySQL não sobrescreve status (edição manual).';
