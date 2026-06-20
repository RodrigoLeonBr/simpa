"""Tests for migration_004_cadastros_sync.sql schema."""

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_004 = ROOT / "migration_004_cadastros_sync.sql"


@pytest.fixture
def migration_sql():
    assert MIGRATION_004.exists(), f"Missing migration: {MIGRATION_004}"
    return MIGRATION_004.read_text(encoding="utf-8")


def test_migration_004_file_is_idempotent(migration_sql):
    assert "CREATE TABLE IF NOT EXISTS estabelecimentos" in migration_sql
    assert "CREATE TABLE IF NOT EXISTS cadastros_sincronizacoes" in migration_sql
    assert "ADD COLUMN IF NOT EXISTS estabelecimento_id" in migration_sql
    assert "ADD COLUMN IF NOT EXISTS pa_total" in migration_sql
    assert "idx_estabelecimentos_perfil_status" in migration_sql


def test_migration_004_documents_tables(migration_sql):
    assert "COMMENT ON TABLE estabelecimentos" in migration_sql
    assert "COMMENT ON TABLE cadastros_sincronizacoes" in migration_sql


@pytest.mark.integration
def test_migration_004_applies_on_postgresql(pg_conn, migration_sql):
    with pg_conn.cursor() as cur:
        cur.execute(migration_sql)
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('estabelecimentos', 'cadastros_sincronizacoes')
            ORDER BY table_name
            """
        )
        tables = {row[0] for row in cur.fetchall()}
        assert tables == {"cadastros_sincronizacoes", "estabelecimentos"}

        cur.execute(
            """
            SELECT COUNT(*)
            FROM information_schema.columns
            WHERE table_name = 'procedimentos'
              AND column_name IN (
                'pa_total', 'rubrica', 'pa_id', 'financiamento',
                'sincronizado_em', 'fonte'
              )
            """
        )
        assert cur.fetchone()[0] == 6

        cur.execute(
            """
            SELECT ccu.table_name AS foreign_table
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = 'equipes'
              AND tc.constraint_name LIKE '%estabelecimento%'
            """
        )
        fk_targets = {row[0] for row in cur.fetchall()}
        assert "estabelecimentos" in fk_targets


@pytest.mark.integration
def test_migration_004_is_rerunnable(pg_conn, migration_sql):
    with pg_conn.cursor() as cur:
        cur.execute(migration_sql)
        cur.execute(migration_sql)
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM estabelecimentos")
        assert cur.fetchone()[0] >= 0
