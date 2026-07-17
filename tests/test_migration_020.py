"""
Tests for migration_020_sih_aih.sql.

Run with a live PG connection:
    pytest tests/test_migration_020.py -v
"""
from __future__ import annotations

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_020 = ROOT / "migration_020_sih_aih.sql"


def apply_migration(conn) -> None:
    sql = MIGRATION_020.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


def table_exists(conn, table: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
            """,
            (table,),
        )
        return cur.fetchone() is not None


def get_columns(conn, table: str) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            """,
            (table,),
        )
        return {row[0] for row in cur.fetchall()}


@pytest.fixture(scope="module")
def pg_conn():
    try:
        from etl_db import pg_connect
    except ImportError:
        pytest.skip("etl_db unavailable")
    conn = pg_connect()
    try:
        apply_migration(conn)
        apply_migration(conn)  # idempotent
        yield conn
    finally:
        conn.close()


def test_sih_aih_table_exists(pg_conn):
    assert table_exists(pg_conn, "sih_aih")


def test_sih_aih_columns(pg_conn):
    cols = get_columns(pg_conn, "sih_aih")
    assert {
        "id",
        "sincronizacao_id",
        "competencia",
        "aih",
        "cnes",
        "estabelecimento_id",
        "proc_principal",
        "valor_total",
    }.issubset(cols)


def test_sih_sincronizacoes_qtd_aih_column(pg_conn):
    cols = get_columns(pg_conn, "sih_sincronizacoes")
    assert "qtd_aih" in cols
