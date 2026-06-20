-- ============================================================================
-- SIMPA — Legacy cadastro migration (unidades_saude → estabelecimentos FK)
-- ============================================================================
--
-- Run order (one-time, after MySQL sync populates estabelecimentos):
--   1. schema_full.sql + migration_002 + migration_003 + migration_004
--   2. python sync_cadastros_mysql.py --pg-write
--   3. python scripts/migrate_cadastros_legacy.py --pg-write
--      (or: Get-Content scripts/migrate_cadastros_legacy.sql | psql ...)
--
-- Does NOT insert legacy-only rows into estabelecimentos.
-- Renames deprecated tables to _deprecated_* (no hard drop in MVP).
-- Safe to re-run: backfill only fills NULL estabelecimento_id; renames are guarded.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS cadastros_migracao_relatorio (
    id          BIGSERIAL PRIMARY KEY,
    categoria   VARCHAR(40) NOT NULL,
    registro_id BIGINT,
    codigo      VARCHAR(40),
    nome        VARCHAR(200),
    motivo      TEXT NOT NULL,
    migrado_em  TIMESTAMP NOT NULL DEFAULT now()
);

COMMENT ON TABLE cadastros_migracao_relatorio IS
    'Relatório one-time migrate_cadastros_legacy: equipes/metas sem match MySQL.';

TRUNCATE cadastros_migracao_relatorio;

-- ---------------------------------------------------------------------------
-- 1. Backfill equipes.estabelecimento_id via unidades_saude → estabelecimentos
-- ---------------------------------------------------------------------------
UPDATE equipes e
SET estabelecimento_id = sub.est_id
FROM (
    SELECT
        e2.id AS equipe_id,
        est.id AS est_id
    FROM equipes e2
    INNER JOIN unidades_saude u ON u.id = e2.unidade_id
    INNER JOIN estabelecimentos est ON (
        est.codigo_externo = u.codigo
        OR (
            NULLIF(BTRIM(u.cnes), '') IS NOT NULL
            AND est.codigo_externo = BTRIM(u.cnes)
        )
    )
) sub
WHERE e.id = sub.equipe_id
  AND e.estabelecimento_id IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Backfill metas_financiamento.estabelecimento_id (same match logic)
-- ---------------------------------------------------------------------------
UPDATE metas_financiamento m
SET estabelecimento_id = sub.est_id
FROM (
    SELECT
        m2.id AS meta_id,
        est.id AS est_id
    FROM metas_financiamento m2
    INNER JOIN unidades_saude u ON u.id = m2.unidade_id
    INNER JOIN estabelecimentos est ON (
        est.codigo_externo = u.codigo
        OR (
            NULLIF(BTRIM(u.cnes), '') IS NOT NULL
            AND est.codigo_externo = BTRIM(u.cnes)
        )
    )
) sub
WHERE m.id = sub.meta_id
  AND m.estabelecimento_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Migration report — unmatched rows (do not auto-insert into estabelecimentos)
-- ---------------------------------------------------------------------------
INSERT INTO cadastros_migracao_relatorio (categoria, registro_id, codigo, nome, motivo)
SELECT
    'equipe_sem_match',
    e.id,
    e.codigo,
    e.nome,
    'unidade_id=' || e.unidade_id::text || ' sem estabelecimento MySQL correspondente'
FROM equipes e
WHERE e.unidade_id IS NOT NULL
  AND e.estabelecimento_id IS NULL;

INSERT INTO cadastros_migracao_relatorio (categoria, registro_id, codigo, nome, motivo)
SELECT
    'unidade_sem_match',
    u.id,
    u.codigo,
    u.nome,
    'codigo/cnes não encontrado em estabelecimentos.codigo_externo'
FROM unidades_saude u
WHERE u.status = 'ativo'
  AND NOT EXISTS (
      SELECT 1
      FROM estabelecimentos est
      WHERE est.codigo_externo = u.codigo
         OR (
             NULLIF(BTRIM(u.cnes), '') IS NOT NULL
             AND est.codigo_externo = BTRIM(u.cnes)
         )
  );

INSERT INTO cadastros_migracao_relatorio (categoria, registro_id, codigo, nome, motivo)
SELECT
    'prestador_mac_sem_match',
    p.id,
    p.cnes,
    p.nome,
    'CNES não encontrado em estabelecimentos (sem insert legado)'
FROM prestadores_mac p
WHERE p.status = 'ativo'
  AND NOT EXISTS (
      SELECT 1
      FROM estabelecimentos est
      WHERE NULLIF(BTRIM(p.cnes), '') IS NOT NULL
        AND est.codigo_externo = BTRIM(p.cnes)
  );

INSERT INTO cadastros_migracao_relatorio (categoria, registro_id, codigo, nome, motivo)
SELECT
    'hospital_sem_match',
    h.id,
    h.cnes,
    h.nome,
    'CNES não encontrado em estabelecimentos (sem insert legado)'
FROM hospitais h
WHERE h.status = 'ativo'
  AND NOT EXISTS (
      SELECT 1
      FROM estabelecimentos est
      WHERE NULLIF(BTRIM(h.cnes), '') IS NOT NULL
        AND est.codigo_externo = BTRIM(h.cnes)
  );

-- ---------------------------------------------------------------------------
-- 4. Rename legacy tables (idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'unidades_saude'
    ) THEN
        ALTER TABLE unidades_saude RENAME TO _deprecated_unidades_saude;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'prestadores_mac'
    ) THEN
        ALTER TABLE prestadores_mac RENAME TO _deprecated_prestadores_mac;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'hospitais'
    ) THEN
        ALTER TABLE hospitais RENAME TO _deprecated_hospitais;
    END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification queries (run after migration)
-- ---------------------------------------------------------------------------
-- Orphan active equipes (expect 0 or documented in cadastros_migracao_relatorio):
--   SELECT COUNT(*) AS equipes_orfas
--   FROM equipes
--   WHERE status = 'ativo'
--     AND unidade_id IS NOT NULL
--     AND estabelecimento_id IS NULL;
--
-- Unmatched report summary:
--   SELECT categoria, COUNT(*) AS total
--   FROM cadastros_migracao_relatorio
--   GROUP BY categoria
--   ORDER BY categoria;
--
-- Detail unmatched equipes:
--   SELECT * FROM cadastros_migracao_relatorio
--   WHERE categoria = 'equipe_sem_match'
--   ORDER BY registro_id;
