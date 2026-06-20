"""Tests for legacy cadastro migration (task 03)."""

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_003 = ROOT / "migration_003_cadastros_fase2.sql"
MIGRATION_004 = ROOT / "migration_004_cadastros_sync.sql"
LEGACY_SQL = ROOT / "scripts" / "migrate_cadastros_legacy.sql"

sys.path.insert(0, str(ROOT / "scripts"))
import cadastros_legacy_match as match  # noqa: E402


def test_resolve_codigo_externo_prefers_codigo():
    disponiveis = {"1234567", "7654321"}
    assert match.resolve_codigo_externo("1234567", "7654321", disponiveis) == "1234567"


def test_resolve_codigo_externo_falls_back_to_cnes():
    disponiveis = {"7654321"}
    assert match.resolve_codigo_externo("NOPE", "7654321", disponiveis) == "7654321"


def test_resolve_codigo_externo_no_match_returns_none():
    assert match.resolve_codigo_externo("A", "B", {"9999999"}) is None
    assert match.resolve_codigo_externo(None, None, {"9999999"}) is None


def test_legacy_sql_contains_backfill_and_rename():
    sql = LEGACY_SQL.read_text(encoding="utf-8")
    assert "UPDATE equipes e" in sql
    assert "UPDATE metas_financiamento m" in sql
    assert "equipe_sem_match" in sql
    assert "RENAME TO _deprecated_unidades_saude" in sql
    assert "RENAME TO _deprecated_prestadores_mac" in sql
    assert "RENAME TO _deprecated_hospitais" in sql
    assert "INSERT INTO estabelecimentos" not in sql


@pytest.fixture
def legacy_pg(pg_conn):
    with pg_conn.cursor() as cur:
        cur.execute(MIGRATION_003.read_text(encoding="utf-8"))
        cur.execute(MIGRATION_004.read_text(encoding="utf-8"))
        cur.execute(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = '_deprecated_unidades_saude'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'unidades_saude'
                ) THEN
                    ALTER TABLE _deprecated_unidades_saude RENAME TO unidades_saude;
                END IF;

                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = '_deprecated_prestadores_mac'
                ) AND EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'prestadores_mac'
                ) THEN
                    DROP TABLE _deprecated_prestadores_mac;
                ELSIF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = '_deprecated_prestadores_mac'
                ) THEN
                    ALTER TABLE _deprecated_prestadores_mac RENAME TO prestadores_mac;
                END IF;

                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = '_deprecated_hospitais'
                ) AND EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'hospitais'
                ) THEN
                    DROP TABLE _deprecated_hospitais;
                ELSIF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = '_deprecated_hospitais'
                ) THEN
                    ALTER TABLE _deprecated_hospitais RENAME TO hospitais;
                END IF;
            END $$;
            """
        )
        cur.execute("DELETE FROM equipes WHERE codigo LIKE 'LEG-%'")
        cur.execute(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'unidades_saude'
                ) THEN
                    DELETE FROM unidades_saude WHERE codigo LIKE 'LEG-%';
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'cadastros_migracao_relatorio'
                ) THEN
                    DELETE FROM cadastros_migracao_relatorio;
                END IF;
            END $$;
            """
        )
        cur.execute("DELETE FROM estabelecimentos WHERE codigo_externo LIKE 'LEG-%'")
    pg_conn.commit()
    return pg_conn


@pytest.mark.integration
def test_migration_maps_equipe_by_codigo(legacy_pg):
    pg_conn = legacy_pg

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO estabelecimentos (codigo_externo, nome, perfil, status)
            VALUES ('LEG-001', 'UBS LEGADO MATCH', 'APS', 'ativo')
            """
        )
        cur.execute(
            """
            INSERT INTO unidades_saude (codigo, nome, tipo, cnes, status)
            VALUES ('LEG-001', 'UBS LEGADO MATCH', 'APS', 'LEG-001', 'ativo')
            RETURNING id
            """
        )
        unidade_id = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO equipes (codigo, nome, unidade_id, tipo, status)
            VALUES ('LEG-EQ-01', 'EQUIPE LEGADO', %s, 'ESF', 'ativo')
            RETURNING id
            """,
            (unidade_id,),
        )
        equipe_id = cur.fetchone()[0]
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute(LEGACY_SQL.read_text(encoding="utf-8"))
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT e.estabelecimento_id, est.codigo_externo
            FROM equipes e
            JOIN estabelecimentos est ON est.id = e.estabelecimento_id
            WHERE e.id = %s
            """,
            (equipe_id,),
        )
        estab_id, codigo = cur.fetchone()
        assert codigo == "LEG-001"
        assert estab_id is not None

        cur.execute(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_name = '_deprecated_unidades_saude'
            """
        )
        assert cur.fetchone() is not None


@pytest.mark.integration
def test_migration_leaves_unmatched_equipe_null_and_reports(legacy_pg):
    pg_conn = legacy_pg

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO estabelecimentos (codigo_externo, nome, perfil, status)
            VALUES ('LEG-OTHER', 'OUTRA UBS', 'APS', 'ativo')
            """
        )
        cur.execute(
            """
            INSERT INTO unidades_saude (codigo, nome, tipo, status)
            VALUES ('LEG-NOMATCH', 'UBS SEM MYSQL', 'APS', 'ativo')
            RETURNING id
            """
        )
        unidade_id = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO equipes (codigo, nome, unidade_id, tipo, status)
            VALUES ('LEG-EQ-02', 'EQUIPE ORFA', %s, 'ESF', 'ativo')
            RETURNING id
            """,
            (unidade_id,),
        )
        equipe_id = cur.fetchone()[0]
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute(LEGACY_SQL.read_text(encoding="utf-8"))
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT estabelecimento_id FROM equipes WHERE id = %s",
            (equipe_id,),
        )
        assert cur.fetchone()[0] is None

        cur.execute(
            """
            SELECT COUNT(*) FROM cadastros_migracao_relatorio
            WHERE categoria = 'equipe_sem_match' AND registro_id = %s
            """,
            (equipe_id,),
        )
        assert cur.fetchone()[0] == 1


@pytest.mark.integration
def test_migration_maps_equipe_by_cnes_fallback(legacy_pg):
    pg_conn = legacy_pg

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO estabelecimentos (codigo_externo, nome, perfil, status)
            VALUES ('LEG-CNES-01', 'UBS CNES MATCH', 'APS', 'ativo')
            """
        )
        cur.execute(
            """
            INSERT INTO unidades_saude (codigo, nome, tipo, cnes, status)
            VALUES ('LEG-COD-DIF', 'UBS CNES', 'APS', 'LEG-CNES-01', 'ativo')
            RETURNING id
            """
        )
        unidade_id = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO equipes (codigo, nome, unidade_id, tipo, status)
            VALUES ('LEG-EQ-03', 'EQUIPE CNES', %s, 'ESF', 'ativo')
            """,
            (unidade_id,),
        )
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute(LEGACY_SQL.read_text(encoding="utf-8"))
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT est.codigo_externo
            FROM equipes e
            JOIN estabelecimentos est ON est.id = e.estabelecimento_id
            WHERE e.codigo = 'LEG-EQ-03'
            """
        )
        assert cur.fetchone()[0] == "LEG-CNES-01"


def test_cli_dry_run_json(monkeypatch, capsys):
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "migrate_cadastros_legacy",
        ROOT / "scripts" / "migrate_cadastros_legacy.py",
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    monkeypatch.setattr(
        sys,
        "argv",
        ["migrate_cadastros_legacy.py", "--dry-run"],
    )
    monkeypatch.setattr(
        module,
        "run_migration",
        lambda **_: {
            "status": "ok",
            "modo": "dry-run",
            "equipes_mapeaveis": 2,
            "equipes_pendentes": 1,
        },
    )

    module.main()
    payload = json.loads(capsys.readouterr().out)
    assert payload["modo"] == "dry-run"
    assert payload["equipes_mapeaveis"] == 2
