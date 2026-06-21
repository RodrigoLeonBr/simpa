-- ============================================================================
-- SIMPA — Migration 009: MySQL cadastro mirror (formas + CBO para SIA/SIH)
-- Depends on: schema_full.sql … migration_008_painel_widgets.sql
-- Apply order: 01 schema → … → 08 painel widgets → 09 cadastros forma/cbo
-- Safe to re-run on existing databases (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
--
-- Manual apply (non-Docker Postgres):
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_009_cadastros_forma_cbo.sql
-- Docker (existing container):
--   Get-Content migration_009_cadastros_forma_cbo.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- ============================================================================

-- 1. Formas de organização (espelho MySQL producao.forma)
CREATE TABLE IF NOT EXISTS formas_sia (
    id               BIGSERIAL PRIMARY KEY,
    codigo_grupo     VARCHAR(2) NOT NULL,
    codigo_subgrupo  VARCHAR(4) NOT NULL,
    codigo_forma     VARCHAR(6) UNIQUE NOT NULL,
    descricao        VARCHAR(120) NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'ativo',
    sincronizado_em  TIMESTAMP,
    criado_em        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formas_sia_grupo_status
    ON formas_sia (codigo_grupo, status);

CREATE INDEX IF NOT EXISTS idx_formas_sia_subgrupo_status
    ON formas_sia (codigo_subgrupo, status);

CREATE INDEX IF NOT EXISTS idx_formas_sia_codigo_status
    ON formas_sia (codigo_forma, status);

COMMENT ON TABLE formas_sia IS
    'Espelho read-only de forma (MySQL/XAMPP). codigo_forma = chave canônica 6 dígitos para join SIA/SIH.';
COMMENT ON COLUMN formas_sia.codigo_grupo IS 'Primeiros 2 dígitos do código forma (grupo).';
COMMENT ON COLUMN formas_sia.codigo_subgrupo IS 'Primeiros 4 dígitos do código forma (subgrupo).';
COMMENT ON COLUMN formas_sia.codigo_forma IS 'Código forma canônico (6 dígitos) — join em left(prd_pa, 6).';
COMMENT ON COLUMN formas_sia.sincronizado_em IS 'Timestamp da última sincronização MySQL bem-sucedida deste registro.';

-- 2. CBO (espelho MySQL producao.cbo)
CREATE TABLE IF NOT EXISTS cbos_sia (
    id               BIGSERIAL PRIMARY KEY,
    codigo_cbo       VARCHAR(6) UNIQUE NOT NULL,
    descricao        VARCHAR(160) NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'ativo',
    sincronizado_em  TIMESTAMP,
    criado_em        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cbos_sia_codigo_status
    ON cbos_sia (codigo_cbo, status);

CREATE INDEX IF NOT EXISTS idx_cbos_sia_status_descricao
    ON cbos_sia (status, descricao);

COMMENT ON TABLE cbos_sia IS
    'Espelho read-only de cbo (MySQL/XAMPP). codigo_cbo = chave canônica 6 caracteres para join SIA/SIH.';
COMMENT ON COLUMN cbos_sia.codigo_cbo IS 'Código CBO canônico (6 caracteres) — join em left(prd_cbo, 6).';
COMMENT ON COLUMN cbos_sia.sincronizado_em IS 'Timestamp da última sincronização MySQL bem-sucedida deste registro.';

-- 3. Contadores de sync em cadastros_sincronizacoes
ALTER TABLE cadastros_sincronizacoes
    ADD COLUMN IF NOT EXISTS forma_inseridos INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS forma_atualizados INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS forma_inativados INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cbo_inseridos INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cbo_atualizados INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cbo_inativados INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN cadastros_sincronizacoes.forma_inseridos IS 'Formas inseridas na execução de sync_cadastros_mysql.py.';
COMMENT ON COLUMN cadastros_sincronizacoes.forma_atualizados IS 'Formas atualizadas na execução de sync_cadastros_mysql.py.';
COMMENT ON COLUMN cadastros_sincronizacoes.forma_inativados IS 'Formas inativadas na execução de sync_cadastros_mysql.py.';
COMMENT ON COLUMN cadastros_sincronizacoes.cbo_inseridos IS 'CBOs inseridos na execução de sync_cadastros_mysql.py.';
COMMENT ON COLUMN cadastros_sincronizacoes.cbo_atualizados IS 'CBOs atualizados na execução de sync_cadastros_mysql.py.';
COMMENT ON COLUMN cadastros_sincronizacoes.cbo_inativados IS 'CBOs inativados na execução de sync_cadastros_mysql.py.';
