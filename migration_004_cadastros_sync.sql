-- ============================================================================
-- SIMPA — Migration 004: MySQL cadastro mirror (estabelecimentos + sync audit)
-- Depends on: schema_full.sql, migration_003_cadastros_fase2.sql
-- Apply order: 01 schema → 02 auth → 03 cadastros fase2 → 04 cadastros sync
-- Safe to re-run on existing databases (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- ============================================================================

CREATE TABLE IF NOT EXISTS estabelecimentos (
    id              BIGSERIAL PRIMARY KEY,
    codigo_externo  VARCHAR(20) UNIQUE NOT NULL,
    nome            VARCHAR(200) NOT NULL,
    cnpj            VARCHAR(14),
    re_tipo         CHAR(1),
    tipouni         CHAR(1),
    perfil          VARCHAR(20) NOT NULL DEFAULT 'Outro',
    area            INT,
    relatorio       VARCHAR(40),
    status          VARCHAR(20) NOT NULL DEFAULT 'ativo',
    enriquecimento  JSONB NOT NULL DEFAULT '{}',
    sincronizado_em TIMESTAMP,
    criado_em       TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT estabelecimentos_perfil_check CHECK (
        perfil IN ('APS', 'MAC', 'Hospitalar', 'Misto', 'Outro')
    )
);

CREATE INDEX IF NOT EXISTS idx_estabelecimentos_perfil_status
    ON estabelecimentos (perfil, status);

COMMENT ON TABLE estabelecimentos IS
    'Espelho read-only de prestador (MySQL/XAMPP). codigo_externo = re_cunid. enriquecimento é SIMPA-only.';
COMMENT ON COLUMN estabelecimentos.codigo_externo IS 'Chave de negócio MySQL prestador.re_cunid (CNES/unidade SIA).';
COMMENT ON COLUMN estabelecimentos.enriquecimento IS 'Campos editáveis SIMPA: leitos, especialidades, habilitacoes, notas (JSONB).';
COMMENT ON COLUMN estabelecimentos.sincronizado_em IS 'Timestamp da última sincronização MySQL bem-sucedida deste registro.';

CREATE TABLE IF NOT EXISTS cadastros_sincronizacoes (
    id                BIGSERIAL PRIMARY KEY,
    status            VARCHAR(20) NOT NULL,
    estab_inseridos   INT NOT NULL DEFAULT 0,
    estab_atualizados INT NOT NULL DEFAULT 0,
    estab_inativados  INT NOT NULL DEFAULT 0,
    proc_inseridos    INT NOT NULL DEFAULT 0,
    proc_atualizados  INT NOT NULL DEFAULT 0,
    proc_inativados   INT NOT NULL DEFAULT 0,
    erro              TEXT,
    sincronizado_em   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cadastros_sincronizacoes_em
    ON cadastros_sincronizacoes (sincronizado_em DESC);

COMMENT ON TABLE cadastros_sincronizacoes IS
    'Histórico de execuções POST /api/cadastros/sincronizar (sync_cadastros_mysql.py).';

ALTER TABLE procedimentos
    ADD COLUMN IF NOT EXISTS pa_total NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS rubrica VARCHAR(4),
    ADD COLUMN IF NOT EXISTS pa_id VARCHAR(9),
    ADD COLUMN IF NOT EXISTS financiamento VARCHAR(60),
    ADD COLUMN IF NOT EXISTS sincronizado_em TIMESTAMP,
    ADD COLUMN IF NOT EXISTS fonte VARCHAR(20) NOT NULL DEFAULT 'mysql_sync';

COMMENT ON COLUMN procedimentos.fonte IS 'Origem do registro: mysql_sync (espelho) ou legado manual.';
COMMENT ON COLUMN procedimentos.sincronizado_em IS 'Última sincronização a partir de procedimento MySQL.';

ALTER TABLE equipes
    ADD COLUMN IF NOT EXISTS estabelecimento_id BIGINT REFERENCES estabelecimentos(id);

ALTER TABLE metas_financiamento
    ADD COLUMN IF NOT EXISTS estabelecimento_id BIGINT REFERENCES estabelecimentos(id);

CREATE INDEX IF NOT EXISTS idx_equipes_estabelecimento
    ON equipes (estabelecimento_id);

CREATE INDEX IF NOT EXISTS idx_metas_estabelecimento
    ON metas_financiamento (estabelecimento_id);
