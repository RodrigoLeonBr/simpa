-- ============================================================================
-- SIMPA — Migration 010: sia_producao CNES + métricas de apresentado
-- Depends on: schema_full.sql … migration_009_cadastros_forma_cbo.sql
-- Apply order: 01 schema → … → 09 cadastros forma/cbo → 10 sia_producao cnes
-- Safe to re-run on existing databases (IF NOT EXISTS + guarded DO blocks).
--
-- Manual apply (non-Docker Postgres):
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_010_sia_producao_cnes.sql
-- Docker (existing container):
--   Get-Content migration_010_sia_producao_cnes.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- ============================================================================

-- 1. Novas colunas no fato SIA
ALTER TABLE sia_producao
    ADD COLUMN IF NOT EXISTS cnes VARCHAR(7),
    ADD COLUMN IF NOT EXISTS estabelecimento_id BIGINT,
    ADD COLUMN IF NOT EXISTS rubrica VARCHAR(4),
    ADD COLUMN IF NOT EXISTS quantidade_apresentada INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS valor_apresentado NUMERIC(15,2);

-- 2. FK opcional para estabelecimentos
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'sia_producao_estabelecimento_id_fkey'
          AND conrelid = 'sia_producao'::regclass
    ) THEN
        ALTER TABLE sia_producao
            ADD CONSTRAINT sia_producao_estabelecimento_id_fkey
            FOREIGN KEY (estabelecimento_id) REFERENCES estabelecimentos(id);
    END IF;
END $$;

-- 3. Índice para lookup por competência + estabelecimento
CREATE INDEX IF NOT EXISTS idx_sia_producao_estab
    ON sia_producao (competencia, estabelecimento_id);

-- 4. Troca de UNIQUE do grão legado (unidade) para grão com CNES
DO $$
DECLARE
    legacy_unique_name TEXT;
BEGIN
    SELECT c.conname
      INTO legacy_unique_name
      FROM pg_constraint c
     WHERE c.conrelid = 'sia_producao'::regclass
       AND c.contype = 'u'
       AND pg_get_constraintdef(c.oid) LIKE '%sincronizacao_id, unidade, codigo_sigtap, faixa_etaria, sexo, cbo%';

    IF legacy_unique_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE sia_producao DROP CONSTRAINT %I', legacy_unique_name);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_sia_producao_grupo_cnes'
          AND conrelid = 'sia_producao'::regclass
    ) THEN
        ALTER TABLE sia_producao
            ADD CONSTRAINT uq_sia_producao_grupo_cnes
            UNIQUE NULLS NOT DISTINCT (sincronizacao_id, cnes, codigo_sigtap, faixa_etaria, sexo, cbo, rubrica);
    END IF;
END $$;
