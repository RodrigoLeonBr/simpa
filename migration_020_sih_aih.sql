-- ============================================================================
-- SIMPA — Migration 020: sih_aih — grão AIH (cabeçalho s_aih) no PostgreSQL
-- Depends on: migration_013_sih_tabelas.sql … migration_019
-- Apply order: … → 19 → 20 sih_aih
-- Safe to re-run (IF NOT EXISTS).
--
-- Manual apply:
--   Get-Content migration_020_sih_aih.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- ============================================================================

-- Contador de cabeçalhos AIH na sincronização
ALTER TABLE sih_sincronizacoes
    ADD COLUMN IF NOT EXISTS qtd_aih INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN sih_sincronizacoes.qtd_aih IS
    'Quantidade de linhas em sih_aih (grão AIH) gravadas na última sync da competência.';

-- ----------------------------------------------------------------------------
-- sih_aih — uma linha por AIH × CNES × competência (espelho de s_aih MySQL)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sih_aih (
    id                  BIGSERIAL PRIMARY KEY,
    sincronizacao_id    BIGINT       NOT NULL
                            REFERENCES sih_sincronizacoes(id) ON DELETE CASCADE,
    competencia         DATE         NOT NULL,
    aih                 VARCHAR(13)  NOT NULL,
    cnes                VARCHAR(7)   NOT NULL,
    estabelecimento_id  INT          REFERENCES estabelecimentos(id),
    proc_principal      VARCHAR(10),
    diag_principal      VARCHAR(4),
    complexidade        VARCHAR(2),
    financiamento       VARCHAR(2),
    motivo_saida        VARCHAR(2),
    sexo                VARCHAR(1),
    especialidade       VARCHAR(3),
    idade               INT,
    diarias             INT          NOT NULL DEFAULT 0,
    diarias_uti         INT          NOT NULL DEFAULT 0,
    valor_total         NUMERIC(15,2) NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sih_aih_grain
    ON sih_aih (sincronizacao_id, aih, cnes);

CREATE INDEX IF NOT EXISTS idx_sih_aih_cmp
    ON sih_aih (competencia);

CREATE INDEX IF NOT EXISTS idx_sih_aih_estab_cmp
    ON sih_aih (competencia, estabelecimento_id);

CREATE INDEX IF NOT EXISTS idx_sih_aih_digito5
    ON sih_aih (competencia, (SUBSTRING(aih FROM 5 FOR 1)));

COMMENT ON TABLE sih_aih IS
    'Cabeçalhos AIH SIHD (s_aih MySQL) — grão AIH × CNES × competência. '
    'Permite filtros analíticos (ex.: SUBSTRING(aih,5,1) = ''5'' para PATE/cirurgia eletiva).';
COMMENT ON COLUMN sih_aih.aih IS
    'Número da AIH (13 chars). Chave natural junto com CNES e competência.';
