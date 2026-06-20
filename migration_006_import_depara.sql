-- ============================================================================
-- SIMPA — Migration 006: e-SUS import de-para registry and cadastro FKs
-- Depends on: schema_full.sql … migration_005_estabelecimentos_perfil_enrichment.sql
-- Apply order: 01 schema → 02 auth → 03 cadastros fase2 → 04 cadastros sync →
--              05 perfil enrichment → 06 import depara
-- Safe to re-run on existing databases (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
--
-- Manual apply (non-Docker Postgres):
--   psql -h localhost -p 5433 -U postgres -d simpa -f migration_006_import_depara.sql
-- Docker (existing container):
--   Get-Content migration_006_import_depara.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- ============================================================================

-- 1. Mapping registry
CREATE TABLE IF NOT EXISTS esus_import_mapeamentos (
    id                  BIGSERIAL PRIMARY KEY,
    esus_unidade_label  VARCHAR(300) NOT NULL,
    esus_equipe_codigo  VARCHAR(40),
    esus_equipe_nome    VARCHAR(200),
    estabelecimento_id  BIGINT NOT NULL REFERENCES estabelecimentos(id),
    equipe_id           BIGINT REFERENCES equipes(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'ativo'
                        CHECK (status IN ('ativo', 'inativo')),
    criado_por          BIGINT REFERENCES usuarios(id),
    atualizado_por      BIGINT REFERENCES usuarios(id),
    criado_em           TIMESTAMP NOT NULL DEFAULT now(),
    atualizado_em       TIMESTAMP NOT NULL DEFAULT now(),
    ultimo_uso_em       TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_esus_mapeamento_unidade
    ON esus_import_mapeamentos (esus_unidade_label)
    WHERE status = 'ativo' AND esus_equipe_codigo IS NULL AND esus_equipe_nome IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_esus_mapeamento_equipe
    ON esus_import_mapeamentos (estabelecimento_id, esus_equipe_codigo)
    WHERE status = 'ativo' AND esus_equipe_codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_esus_mapeamento_estabelecimento
    ON esus_import_mapeamentos (estabelecimento_id);

COMMENT ON TABLE esus_import_mapeamentos IS
    'Registro persistente de-para e-SUS unidade/equipe → cadastro estabelecimento/equipe.';

-- 2. esus_cargas FKs (nullable for legacy rows)
ALTER TABLE esus_cargas
    ADD COLUMN IF NOT EXISTS estabelecimento_id BIGINT,
    ADD COLUMN IF NOT EXISTS equipe_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'esus_cargas' AND c.conname = 'esus_cargas_estabelecimento_id_fkey'
    ) THEN
        ALTER TABLE esus_cargas
            ADD CONSTRAINT esus_cargas_estabelecimento_id_fkey
            FOREIGN KEY (estabelecimento_id) REFERENCES estabelecimentos(id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'esus_cargas' AND c.conname = 'esus_cargas_equipe_id_fkey'
    ) THEN
        ALTER TABLE esus_cargas
            ADD CONSTRAINT esus_cargas_equipe_id_fkey
            FOREIGN KEY (equipe_id) REFERENCES equipes(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_esus_cargas_estabelecimento
    ON esus_cargas (competencia, estabelecimento_id, equipe_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_esus_cargas_ids
    ON esus_cargas (tipo_relatorio, competencia, estabelecimento_id, equipe_id)
    WHERE estabelecimento_id IS NOT NULL AND equipe_id IS NOT NULL;

COMMENT ON COLUMN esus_cargas.estabelecimento_id IS
    'FK cadastro estabelecimentos; obrigatório em novas importações após de-para.';
COMMENT ON COLUMN esus_cargas.equipe_id IS
    'FK cadastro equipes; obrigatório em novas importações após de-para.';

-- 3. dados_consolidados FKs
ALTER TABLE dados_consolidados
    ADD COLUMN IF NOT EXISTS estabelecimento_id BIGINT,
    ADD COLUMN IF NOT EXISTS equipe_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'dados_consolidados' AND c.conname = 'dados_consolidados_estabelecimento_id_fkey'
    ) THEN
        ALTER TABLE dados_consolidados
            ADD CONSTRAINT dados_consolidados_estabelecimento_id_fkey
            FOREIGN KEY (estabelecimento_id) REFERENCES estabelecimentos(id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'dados_consolidados' AND c.conname = 'dados_consolidados_equipe_id_fkey'
    ) THEN
        ALTER TABLE dados_consolidados
            ADD CONSTRAINT dados_consolidados_equipe_id_fkey
            FOREIGN KEY (equipe_id) REFERENCES equipes(id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dados_consolidados_ids
    ON dados_consolidados (competencia, estabelecimento_id, equipe_id)
    WHERE estabelecimento_id IS NOT NULL AND equipe_id IS NOT NULL;

COMMENT ON COLUMN dados_consolidados.estabelecimento_id IS
    'Dimensão autoritativa para Painel/Metas; texto unidade permanece para exibição.';
COMMENT ON COLUMN dados_consolidados.equipe_id IS
    'Dimensão autoritativa para Painel/Metas; texto equipe permanece para exibição.';

-- Legacy UNIQUE (competencia, unidade, equipe) retained until Phase 2 backfill completes.
