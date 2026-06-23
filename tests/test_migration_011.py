"""Tests for migration_011_rubricas_sia.sql schema."""

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_004 = ROOT / "migration_004_cadastros_sync.sql"
MIGRATION_011 = ROOT / "migration_011_rubricas_sia.sql"

RUBRICAS_COLUMNS = (
    "codigo_rubrica",
    "descricao",
    "status",
    "sincronizado_em",
)

SYNC_COUNTER_COLUMNS = (
    "rubrica_inseridos",
    "rubrica_atualizados",
    "rubrica_inativados",
)


@pytest.fixture
def migration_sql():
    assert MIGRATION_011.exists(), f"Missing migration: {MIGRATION_011}"
    return MIGRATION_011.read_text(encoding="utf-8")


@pytest.fixture
def rubrica_pg(pg_conn):
    with pg_conn.cursor() as cur:
        cur.execute(MIGRATION_004.read_text(encoding="utf-8"))
    pg_conn.commit()
    return pg_conn


def test_migration_011_file_is_idempotent(migration_sql):
    assert "CREATE TABLE IF NOT EXISTS rubricas_sia" in migration_sql
    assert "codigo_rubrica  VARCHAR(4) PRIMARY KEY" in migration_sql
    assert "ADD COLUMN IF NOT EXISTS rubrica_inseridos" in migration_sql
    assert "idx_rubricas_sia_status_descricao" in migration_sql


@pytest.mark.integration
def test_migration_011_applies_on_postgresql(rubrica_pg, migration_sql):
    with rubrica_pg.cursor() as cur:
        cur.execute(migration_sql)
    rubrica_pg.commit()

    with rubrica_pg.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'rubricas_sia'
            ORDER BY ordinal_position
            """
        )
        assert [row[0] for row in cur.fetchall()] == list(RUBRICAS_COLUMNS)

        cur.execute(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'idx_rubricas_sia_status_descricao'
            """
        )
        assert cur.fetchone() is not None

        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'cadastros_sincronizacoes'
              AND column_name = ANY(%s)
            ORDER BY column_name
            """,
            (list(SYNC_COUNTER_COLUMNS),),
        )
        assert [row[0] for row in cur.fetchall()] == sorted(SYNC_COUNTER_COLUMNS)


@pytest.mark.integration
def test_migration_011_is_rerunnable(rubrica_pg, migration_sql):
    with rubrica_pg.cursor() as cur:
        cur.execute(migration_sql)
        cur.execute(migration_sql)
    rubrica_pg.commit()

    with rubrica_pg.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'cadastros_sincronizacoes'
              AND column_name = 'rubrica_inseridos'
            """
        )
        assert cur.fetchone()[0] == 1
