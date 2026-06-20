"""Tests for migration_005_estabelecimentos_perfil_enrichment.sql schema."""

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_004 = ROOT / "migration_004_cadastros_sync.sql"
MIGRATION_005 = ROOT / "migration_005_estabelecimentos_perfil_enrichment.sql"

ENRICHMENT_TABLES = (
    "enriquecimento_aps",
    "enriquecimento_mac",
    "enriquecimento_hospitalar",
    "enriquecimento_misto",
    "enriquecimento_outro",
)

TEST_BACKFILL_CODIGO = "MIG005TEST"


@pytest.fixture
def migration_sql():
    assert MIGRATION_005.exists(), f"Missing migration: {MIGRATION_005}"
    return MIGRATION_005.read_text(encoding="utf-8")


@pytest.fixture
def cadastro_pg(pg_conn):
    with pg_conn.cursor() as cur:
        cur.execute(MIGRATION_004.read_text(encoding="utf-8"))
        cur.execute(
            "DELETE FROM estabelecimentos WHERE codigo_externo = %s",
            (TEST_BACKFILL_CODIGO,),
        )
    pg_conn.commit()
    return pg_conn


def test_migration_005_file_is_idempotent(migration_sql):
    assert "ADD COLUMN IF NOT EXISTS perfil_editado" in migration_sql
    for table in ENRICHMENT_TABLES:
        assert f"CREATE TABLE IF NOT EXISTS {table}" in migration_sql
    assert "ON CONFLICT (estabelecimento_id) DO UPDATE SET" in migration_sql
    assert "capacidade_notas" in migration_sql


def test_migration_005_documents_manual_apply(migration_sql):
    assert "Manual apply (non-Docker Postgres):" in migration_sql
    assert "migration_005_estabelecimentos_perfil_enrichment.sql" in migration_sql


@pytest.mark.integration
def test_migration_005_applies_on_postgresql(cadastro_pg, migration_sql):
    with cadastro_pg.cursor() as cur:
        cur.execute(migration_sql)
    cadastro_pg.commit()

    with cadastro_pg.cursor() as cur:
        cur.execute(
            """
            SELECT column_name, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'estabelecimentos'
              AND column_name = 'perfil_editado'
            """
        )
        col = cur.fetchone()
        assert col is not None
        assert col[0] == "perfil_editado"
        assert col[1] == "NO"
        assert "false" in (col[2] or "")

        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = ANY(%s)
            ORDER BY table_name
            """,
            (list(ENRICHMENT_TABLES),),
        )
        tables = {row[0] for row in cur.fetchall()}
        assert tables == set(ENRICHMENT_TABLES)

        for table in ENRICHMENT_TABLES:
            cur.execute(
                """
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON kcu.constraint_name = tc.constraint_name
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_name = %s
                """,
                (table,),
            )
            pk_cols = {row[0] for row in cur.fetchall()}
            assert pk_cols == {"estabelecimento_id"}


@pytest.mark.integration
def test_migration_005_backfill_hospitalar(cadastro_pg, migration_sql):
    payload = json.dumps({"leitos": {"clinico": 10}})

    with cadastro_pg.cursor() as cur:
        cur.execute(
            """
            INSERT INTO estabelecimentos (
              codigo_externo, nome, perfil, status, enriquecimento
            ) VALUES (%s, %s, %s, %s, %s::jsonb)
            RETURNING id
            """,
            (TEST_BACKFILL_CODIGO, "Hospital Test", "Hospitalar", "ativo", payload),
        )
        estab_id = cur.fetchone()[0]
        cur.execute(migration_sql)
    cadastro_pg.commit()

    with cadastro_pg.cursor() as cur:
        cur.execute(
            """
            SELECT leitos
            FROM enriquecimento_hospitalar
            WHERE estabelecimento_id = %s
            """,
            (estab_id,),
        )
        row = cur.fetchone()
        assert row is not None
        assert row[0] == {"clinico": 10}


@pytest.mark.integration
def test_migration_005_is_rerunnable(cadastro_pg, migration_sql):
    with cadastro_pg.cursor() as cur:
        cur.execute(migration_sql)
        cur.execute(migration_sql)
    cadastro_pg.commit()

    with cadastro_pg.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'estabelecimentos'
              AND column_name = 'perfil_editado'
            """
        )
        assert cur.fetchone()[0] == 1
