"""Tests for migration_006_import_depara.sql schema."""

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_004 = ROOT / "migration_004_cadastros_sync.sql"
MIGRATION_005 = ROOT / "migration_005_estabelecimentos_perfil_enrichment.sql"
MIGRATION_006 = ROOT / "migration_006_import_depara.sql"

MAPEAMENTO_COLUMNS = (
    "id",
    "esus_unidade_label",
    "esus_equipe_codigo",
    "esus_equipe_nome",
    "estabelecimento_id",
    "equipe_id",
    "status",
    "criado_por",
    "atualizado_por",
    "criado_em",
    "atualizado_em",
    "ultimo_uso_em",
)

FK_COLUMNS = ("estabelecimento_id", "equipe_id")


@pytest.fixture
def migration_sql():
    assert MIGRATION_006.exists(), f"Missing migration: {MIGRATION_006}"
    return MIGRATION_006.read_text(encoding="utf-8")


@pytest.fixture
def depara_pg(pg_conn):
    with pg_conn.cursor() as cur:
        cur.execute(MIGRATION_004.read_text(encoding="utf-8"))
        cur.execute(MIGRATION_005.read_text(encoding="utf-8"))
    pg_conn.commit()
    return pg_conn


def test_migration_006_file_is_idempotent(migration_sql):
    assert "CREATE TABLE IF NOT EXISTS esus_import_mapeamentos" in migration_sql
    assert "ADD COLUMN IF NOT EXISTS estabelecimento_id" in migration_sql
    assert "ADD COLUMN IF NOT EXISTS equipe_id" in migration_sql
    assert "uq_esus_mapeamento_unidade" in migration_sql
    assert "uq_esus_mapeamento_equipe" in migration_sql
    assert "uq_dados_consolidados_ids" in migration_sql
    assert "idx_esus_cargas_estabelecimento" in migration_sql
    assert "uq_esus_cargas_ids" in migration_sql
    assert "esus_cargas_estabelecimento_id_fkey" in migration_sql


def test_migration_006_documents_manual_apply(migration_sql):
    assert "Manual apply (non-Docker Postgres):" in migration_sql
    assert "migration_006_import_depara.sql" in migration_sql


@pytest.mark.integration
def test_migration_006_applies_on_postgresql(depara_pg, migration_sql):
    with depara_pg.cursor() as cur:
        cur.execute(migration_sql)
    depara_pg.commit()

    with depara_pg.cursor() as cur:
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'esus_import_mapeamentos'
            """
        )
        assert cur.fetchone() is not None

        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'esus_import_mapeamentos'
            ORDER BY ordinal_position
            """
        )
        columns = [row[0] for row in cur.fetchall()]
        assert columns == list(MAPEAMENTO_COLUMNS)

        for table in ("esus_cargas", "dados_consolidados"):
            cur.execute(
                """
                SELECT column_name, is_nullable
                FROM information_schema.columns
                WHERE table_name = %s
                  AND column_name = ANY(%s)
                ORDER BY column_name
                """,
                (table, list(FK_COLUMNS)),
            )
            rows = cur.fetchall()
            assert len(rows) == 2
            assert all(row[1] == "YES" for row in rows)

        cur.execute(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'uq_esus_cargas_ids'
            """
        )
        assert cur.fetchone() is not None

        cur.execute(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'uq_dados_consolidados_ids'
            """
        )
        assert cur.fetchone() is not None

        cur.execute(
            """
            SELECT ccu.table_name AS foreign_table
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = 'esus_cargas'
              AND tc.constraint_name LIKE '%estabelecimento%'
            """
        )
        fk_targets = {row[0] for row in cur.fetchall()}
        assert "estabelecimentos" in fk_targets


@pytest.mark.integration
def test_migration_006_is_rerunnable(depara_pg, migration_sql):
    with depara_pg.cursor() as cur:
        cur.execute(migration_sql)
        cur.execute(migration_sql)
    depara_pg.commit()

    with depara_pg.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'esus_cargas'
              AND column_name = 'estabelecimento_id'
            """
        )
        assert cur.fetchone()[0] == 1

        cur.execute(
            """
            SELECT COUNT(*)
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'uq_dados_consolidados_ids'
            """
        )
        assert cur.fetchone()[0] == 1
