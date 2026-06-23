-- ============================================================================
-- SIMPA — Migration 011: Espelho rubricas_sia (MySQL s_rub)
-- Depends on: schema_full.sql … migration_010_sia_producao_cnes.sql
-- Apply order: 01 schema → … → 10 sia_producao_cnes → 11 rubricas_sia
-- Safe to re-run on existing databases (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
--
-- Manual apply (non-Docker Postgres):
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_011_rubricas_sia.sql
-- Docker (existing container):
--   Get-Content migration_011_rubricas_sia.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- ============================================================================

CREATE TABLE IF NOT EXISTS rubricas_sia (
    codigo_rubrica  VARCHAR(4) PRIMARY KEY,
    descricao       VARCHAR(160) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'ativo',
    sincronizado_em TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rubricas_sia_status_descricao
    ON rubricas_sia (status, descricao);

COMMENT ON TABLE rubricas_sia IS
    'Espelho read-only de s_rub (MySQL/XAMPP). codigo_rubrica = RUB_ID canônico 4 chars.';
COMMENT ON COLUMN rubricas_sia.codigo_rubrica IS
    'Código da rubrica (RUB_ID) normalizado para 4 caracteres.';
COMMENT ON COLUMN rubricas_sia.sincronizado_em IS
    'Timestamp da última sincronização MySQL bem-sucedida deste registro.';

ALTER TABLE cadastros_sincronizacoes
    ADD COLUMN IF NOT EXISTS rubrica_inseridos INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rubrica_atualizados INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS rubrica_inativados INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN cadastros_sincronizacoes.rubrica_inseridos IS
    'Rubricas inseridas na execução de sync_cadastros_mysql.py.';
COMMENT ON COLUMN cadastros_sincronizacoes.rubrica_atualizados IS
    'Rubricas atualizadas na execução de sync_cadastros_mysql.py.';
COMMENT ON COLUMN cadastros_sincronizacoes.rubrica_inativados IS
    'Rubricas inativadas na execução de sync_cadastros_mysql.py.';
