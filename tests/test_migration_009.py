"""Tests for migration_009_cadastros_forma_cbo.sql schema."""

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_004 = ROOT / "migration_004_cadastros_sync.sql"
MIGRATION_009 = ROOT / "migration_009_cadastros_forma_cbo.sql"

FORMAS_COLUMNS = (
    "id",
    "codigo_grupo",
    "codigo_subgrupo",
    "codigo_forma",
    "descricao",
    "status",
    "sincronizado_em",
    "criado_em",
)

CBOS_COLUMNS = (
    "id",
    "codigo_cbo",
    "descricao",
    "status",
    "sincronizado_em",
    "criado_em",
)

SYNC_COUNTER_COLUMNS = (
    "forma_inseridos",
    "forma_atualizados",
    "forma_inativados",
    "cbo_inseridos",
    "cbo_atualizados",
    "cbo_inativados",
)

FORMAS_INDEXES = (
    "idx_formas_sia_grupo_status",
    "idx_formas_sia_subgrupo_status",
    "idx_formas_sia_codigo_status",
)

CBOS_INDEXES = (
    "idx_cbos_sia_codigo_status",
    "idx_cbos_sia_status_descricao",
)


@pytest.fixture
def migration_sql():
    assert MIGRATION_009.exists(), f"Missing migration: {MIGRATION_009}"
    return MIGRATION_009.read_text(encoding="utf-8")


@pytest.fixture
def forma_cbo_pg(pg_conn):
    with pg_conn.cursor() as cur:
        cur.execute(MIGRATION_004.read_text(encoding="utf-8"))
    pg_conn.commit()
    return pg_conn


def test_migration_009_file_is_idempotent(migration_sql):
    assert "CREATE TABLE IF NOT EXISTS formas_sia" in migration_sql
    assert "CREATE TABLE IF NOT EXISTS cbos_sia" in migration_sql
    assert "ADD COLUMN IF NOT EXISTS forma_inseridos" in migration_sql
    assert "ADD COLUMN IF NOT EXISTS cbo_inativados" in migration_sql
    for index in FORMAS_INDEXES + CBOS_INDEXES:
        assert index in migration_sql
    assert "codigo_forma     VARCHAR(6) UNIQUE NOT NULL" in migration_sql
    assert "codigo_cbo       VARCHAR(6) UNIQUE NOT NULL" in migration_sql


def test_migration_009_documents_manual_apply(migration_sql):
    assert "Manual apply (non-Docker Postgres):" in migration_sql
    assert "migration_009_cadastros_forma_cbo.sql" in migration_sql


@pytest.mark.integration
def test_migration_009_applies_on_postgresql(forma_cbo_pg, migration_sql):
    with forma_cbo_pg.cursor() as cur:
        cur.execute(migration_sql)
    forma_cbo_pg.commit()

    with forma_cbo_pg.cursor() as cur:
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('formas_sia', 'cbos_sia')
            ORDER BY table_name
            """
        )
        tables = [row[0] for row in cur.fetchall()]
        assert tables == ["cbos_sia", "formas_sia"]

        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'formas_sia'
            ORDER BY ordinal_position
            """
        )
        assert [row[0] for row in cur.fetchall()] == list(FORMAS_COLUMNS)

        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'cbos_sia'
            ORDER BY ordinal_position
            """
        )
        assert [row[0] for row in cur.fetchall()] == list(CBOS_COLUMNS)

        for index in FORMAS_INDEXES + CBOS_INDEXES:
            cur.execute(
                """
                SELECT indexname
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND indexname = %s
                """,
                (index,),
            )
            assert cur.fetchone() is not None, f"Missing index: {index}"

        cur.execute(
            """
            SELECT column_name, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'cadastros_sincronizacoes'
              AND column_name = ANY(%s)
            ORDER BY column_name
            """,
            (list(SYNC_COUNTER_COLUMNS),),
        )
        rows = cur.fetchall()
        assert len(rows) == len(SYNC_COUNTER_COLUMNS)
        assert all(row[1] == "0" for row in rows)
        assert all(row[2] == "NO" for row in rows)


@pytest.mark.integration
def test_migration_009_is_rerunnable(forma_cbo_pg, migration_sql):
    with forma_cbo_pg.cursor() as cur:
        cur.execute(migration_sql)
        cur.execute(migration_sql)
    forma_cbo_pg.commit()

    with forma_cbo_pg.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'cadastros_sincronizacoes'
              AND column_name = 'forma_inseridos'
            """
        )
        assert cur.fetchone()[0] == 1

        cur.execute(
            """
            SELECT COUNT(*)
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'idx_cbos_sia_status_descricao'
            """
        )
        assert cur.fetchone()[0] == 1
