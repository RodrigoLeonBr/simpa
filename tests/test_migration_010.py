"""Tests for migration_010_sia_producao_cnes.sql schema."""

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_010 = ROOT / "migration_010_sia_producao_cnes.sql"
DOCKER_COMPOSE = ROOT / "docker-compose.yml"

EXPECTED_NEW_COLUMNS = (
    "cnes",
    "estabelecimento_id",
    "rubrica",
    "quantidade_apresentada",
    "valor_apresentado",
)


@pytest.fixture
def migration_sql():
    assert MIGRATION_010.exists(), f"Missing migration: {MIGRATION_010}"
    return MIGRATION_010.read_text(encoding="utf-8")


@pytest.fixture
def legacy_sia_pg(pg_conn):
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS estabelecimentos (
                id BIGSERIAL PRIMARY KEY,
                codigo_externo VARCHAR(20)
            );

            CREATE TABLE IF NOT EXISTS sia_sincronizacoes (
                id BIGSERIAL PRIMARY KEY,
                competencia DATE NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS sia_producao (
                id BIGSERIAL PRIMARY KEY,
                sincronizacao_id BIGINT NOT NULL REFERENCES sia_sincronizacoes(id) ON DELETE CASCADE,
                competencia DATE NOT NULL,
                unidade VARCHAR(200),
                codigo_sigtap VARCHAR(20) NOT NULL,
                descricao VARCHAR(300),
                quantidade INT NOT NULL DEFAULT 0,
                valor_aprovado NUMERIC(12,2),
                faixa_etaria VARCHAR(20),
                sexo CHAR(1),
                cbo VARCHAR(10),
                dados_extras JSONB,
                UNIQUE (sincronizacao_id, unidade, codigo_sigtap, faixa_etaria, sexo, cbo)
            );
            """
        )
    pg_conn.commit()
    return pg_conn


def test_migration_010_file_is_idempotent(migration_sql):
    assert "ADD COLUMN IF NOT EXISTS cnes VARCHAR(7)" in migration_sql
    assert "ADD COLUMN IF NOT EXISTS estabelecimento_id BIGINT" in migration_sql
    assert "ADD COLUMN IF NOT EXISTS quantidade_apresentada INT NOT NULL DEFAULT 0" in migration_sql
    assert "ADD COLUMN IF NOT EXISTS valor_apresentado NUMERIC(15,2)" in migration_sql
    assert "CREATE INDEX IF NOT EXISTS idx_sia_producao_estab" in migration_sql
    assert "UNIQUE NULLS NOT DISTINCT" in migration_sql
    assert "uq_sia_producao_grupo_cnes" in migration_sql


def test_migration_010_documents_manual_apply(migration_sql):
    assert "Manual apply (non-Docker Postgres):" in migration_sql
    assert "migration_010_sia_producao_cnes.sql" in migration_sql


def test_docker_init_registers_migration_010():
    compose = DOCKER_COMPOSE.read_text(encoding="utf-8")
    assert "migration_010_sia_producao_cnes.sql" in compose
    assert "/docker-entrypoint-initdb.d/10-migration_010_sia_producao_cnes.sql:ro" in compose


@pytest.mark.integration
def test_migration_010_applies_on_postgresql(legacy_sia_pg, migration_sql):
    with legacy_sia_pg.cursor() as cur:
        cur.execute(migration_sql)
    legacy_sia_pg.commit()

    with legacy_sia_pg.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'sia_producao'
              AND column_name = ANY(%s)
            ORDER BY column_name
            """,
            (list(EXPECTED_NEW_COLUMNS),),
        )
        assert [row[0] for row in cur.fetchall()] == sorted(EXPECTED_NEW_COLUMNS)

        cur.execute(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'idx_sia_producao_estab'
            """
        )
        assert cur.fetchone() is not None

        cur.execute(
            """
            SELECT c.conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            WHERE c.conrelid = 'sia_producao'::regclass
              AND c.conname = 'uq_sia_producao_grupo_cnes'
            """
        )
        row = cur.fetchone()
        assert row is not None
        assert "sincronizacao_id, cnes, codigo_sigtap, faixa_etaria, sexo, cbo, rubrica" in row[1]

        cur.execute(
            """
            SELECT COUNT(*)
            FROM pg_constraint
            WHERE conrelid = 'sia_producao'::regclass
              AND contype = 'u'
              AND pg_get_constraintdef(oid) LIKE %s
            """,
            ("%sincronizacao_id, unidade, codigo_sigtap, faixa_etaria, sexo, cbo%",),
        )
        assert cur.fetchone()[0] == 0

        cur.execute(
            """
            SELECT ccu.table_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.table_name = 'sia_producao'
              AND tc.constraint_type = 'FOREIGN KEY'
              AND tc.constraint_name = 'sia_producao_estabelecimento_id_fkey'
            """
        )
        assert cur.fetchone()[0] == "estabelecimentos"


@pytest.mark.integration
def test_migration_010_is_rerunnable(legacy_sia_pg, migration_sql):
    with legacy_sia_pg.cursor() as cur:
        cur.execute(migration_sql)
        cur.execute(migration_sql)
    legacy_sia_pg.commit()

    with legacy_sia_pg.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'sia_producao'
              AND column_name = 'estabelecimento_id'
            """
        )
        assert cur.fetchone()[0] == 1

        cur.execute(
            """
            SELECT COUNT(*)
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'idx_sia_producao_estab'
            """
        )
        assert cur.fetchone()[0] == 1

        cur.execute(
            """
            SELECT COUNT(*)
            FROM pg_constraint
            WHERE conrelid = 'sia_producao'::regclass
              AND conname = 'uq_sia_producao_grupo_cnes'
            """
        )
        assert cur.fetchone()[0] == 1
