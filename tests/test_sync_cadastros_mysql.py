"""Tests for sync_cadastros_mysql.py."""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock

import pytest

import sync_cadastros_mysql as sync

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_004 = ROOT / "migration_004_cadastros_sync.sql"
MIGRATION_005 = ROOT / "migration_005_estabelecimentos_perfil_enrichment.sql"

TEST_ESTAB_KEYS = ("9999999", "1111111", "2222222", "3333333")
TEST_PROC_KEYS = ("0301010010", "0401010010")


@pytest.fixture
def cadastro_pg(pg_conn):
    with pg_conn.cursor() as cur:
        cur.execute(MIGRATION_004.read_text(encoding="utf-8"))
        cur.execute(MIGRATION_005.read_text(encoding="utf-8"))
        cur.execute(
            "DELETE FROM procedimentos WHERE codigo_sigtap = ANY(%s)",
            (list(TEST_PROC_KEYS),),
        )
        cur.execute(
            "DELETE FROM estabelecimentos WHERE codigo_externo = ANY(%s)",
            (list(TEST_ESTAB_KEYS),),
        )
    pg_conn.commit()
    return pg_conn


@pytest.fixture
def perfil_map():
    return {"tipouni": {"1": "APS", "2": "MAC", "3": "Hospitalar"}, "default": "Outro"}


@pytest.fixture
def sync_ts():
    return datetime(2026, 6, 20, 12, 0, 0, tzinfo=timezone.utc)


def test_build_prestador_query_defaults_match_producao_schema():
    query = sync.build_prestador_query()
    cfg = sync.build_cadastro_config()

    assert cfg["table_prest"] == "prestador"
    assert cfg["col_prest_pk"] == "re_cunid"
    assert cfg["col_nome"] == "re_cnome"
    assert "p.re_cunid AS codigo_externo" in query
    assert "p.re_cnome AS nome" in query
    assert "p.tipouni AS tipouni" in query
    assert "FROM prestador p" in query


def test_build_procedimento_query_defaults_match_producao_schema():
    query = sync.build_procedimento_query()
    cfg = sync.build_cadastro_config()

    assert cfg["table_proc"] == "procedimento"
    assert "proc.codigo AS codigo_sigtap" in query
    assert "proc.PA_TOTAL AS pa_total" in query
    assert "proc.RUB_TOTAL AS rubrica" in query
    assert "FROM procedimento proc" in query


def test_derive_perfil_known_tipouni(perfil_map):
    assert sync.derive_perfil("1", perfil_map) == "APS"
    assert sync.derive_perfil("2", perfil_map) == "MAC"
    assert sync.derive_perfil("3", perfil_map) == "Hospitalar"


def test_derive_perfil_unknown_defaults_to_outro(perfil_map):
    assert sync.derive_perfil("9", perfil_map) == "Outro"
    assert sync.derive_perfil(None, perfil_map) == "Outro"


def test_load_perfil_map_from_env(monkeypatch):
    monkeypatch.setenv(
        "CADASTRO_PERFIL_MAP",
        '{"tipouni": {"4": "Misto"}, "default": "Outro"}',
    )
    loaded = sync.load_perfil_map()
    assert sync.derive_perfil("4", loaded) == "Misto"


def test_upsert_estabelecimento_sql_excludes_enriquecimento():
    sql = sync.UPSERT_ESTABELECIMENTO_SQL
    assert "enriquecimento" not in sql.lower()


def test_upsert_estabelecimento_sql_preserves_manual_perfil():
    sql = sync.UPSERT_ESTABELECIMENTO_SQL
    assert "perfil_editado" in sql
    assert "WHEN estabelecimentos.perfil_editado THEN estabelecimentos.perfil" in sql
    assert "%(perfil)s, false," in sql


def test_inactivate_estabelecimentos_skips_empty_snapshot():
    cur = MagicMock()
    count = sync._inactivate_estabelecimentos(cur, set(), pg_write=True)
    assert count == 0
    cur.execute.assert_not_called()


def test_inactivate_procedimentos_skips_empty_snapshot():
    cur = MagicMock()
    count = sync._inactivate_procedimentos(cur, set(), pg_write=True)
    assert count == 0
    cur.execute.assert_not_called()


def test_normalize_prestador_row_maps_status_and_perfil(perfil_map, sync_ts):
    row = sync.normalize_prestador_row(
        {
            "codigo_externo": "1234567",
            "nome": "UBS CENTRO",
            "cnpj": "12345678000199",
            "re_tipo": "A",
            "tipouni": "1",
            "area": 10,
            "relatorio": "APS",
            "ativo": 0,
        },
        perfil_map,
        sync_ts,
    )
    assert row["perfil"] == "APS"
    assert row["status"] == "inativo"
    assert row["codigo_externo"] == "1234567"


def test_dry_run_does_not_write_to_postgresql(monkeypatch, sync_ts):
    prest = [
        {
            "codigo_externo": "1111111",
            "nome": "UBS A",
            "cnpj": None,
            "re_tipo": "A",
            "tipouni": "1",
            "area": 1,
            "relatorio": None,
            "ativo": 1,
        }
    ]
    proc = [
        {
            "codigo_sigtap": "0301010010",
            "descricao": "CONSULTA",
            "pa_total": 10.0,
            "rubrica": "0101",
            "pa_id": "PA123",
            "financiamento": "MAC",
        }
    ]

    monkeypatch.setattr(sync, "mysql_configured", lambda: True)
    monkeypatch.setattr(sync, "extrair_prestadores", lambda *_: prest)
    monkeypatch.setattr(sync, "extrair_procedimentos", lambda *_: proc)

    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_cursor.fetchall.return_value = []

    monkeypatch.setattr(sync, "pg_connect", lambda: mock_conn)

    result = sync.sincronizar(pg_write=False, dry_run=True)

    assert result["status"] == "ok"
    assert result["estabelecimentos"]["inserted"] == 1
    assert result["procedimentos"]["inserted"] == 1

    write_calls = [
        call
        for call in mock_cursor.execute.call_args_list
        if call.args and isinstance(call.args[0], str)
        and ("INSERT INTO" in call.args[0] or "UPDATE " in call.args[0])
    ]
    assert write_calls == []
    mock_conn.commit.assert_not_called()


@pytest.mark.integration
def test_inactivate_missing_estabelecimentos(cadastro_pg):
    pg_conn = cadastro_pg

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO estabelecimentos (codigo_externo, nome, status)
            VALUES ('9999999', 'LEGADO', 'ativo')
            """
        )
    pg_conn.commit()

    rows = [
        sync.normalize_prestador_row(
            {
                "codigo_externo": "1111111",
                "nome": "UBS NOVA",
                "tipouni": "1",
                "ativo": 1,
            }
        )
    ]

    sync.sync_estabelecimentos(pg_conn, rows, pg_write=True)
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT status FROM estabelecimentos WHERE codigo_externo = %s",
            ("9999999",),
        )
        assert cur.fetchone()[0] == "inativo"


@pytest.mark.integration
def test_pg_write_preserves_enriquecimento(cadastro_pg, sync_ts):
    pg_conn = cadastro_pg

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO estabelecimentos (
                codigo_externo, nome, enriquecimento, status
            ) VALUES (
                '2222222', 'HOSPITAL X', '{"leitos": 50}'::jsonb, 'ativo'
            )
            """
        )
    pg_conn.commit()

    rows = [
        sync.normalize_prestador_row(
            {
                "codigo_externo": "2222222",
                "nome": "HOSPITAL X ATUALIZADO",
                "tipouni": "3",
                "ativo": 1,
            },
            sync_ts=sync_ts,
        )
    ]
    sync.sync_estabelecimentos(pg_conn, rows, pg_write=True)
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT nome, enriquecimento
            FROM estabelecimentos
            WHERE codigo_externo = '2222222'
            """
        )
        nome, enriquecimento = cur.fetchone()
        assert nome == "HOSPITAL X ATUALIZADO"
        assert enriquecimento == {"leitos": 50}


@pytest.mark.integration
def test_pg_write_preserves_manual_perfil_when_flag_true(cadastro_pg, sync_ts, perfil_map):
    pg_conn = cadastro_pg

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO estabelecimentos (
                codigo_externo, nome, perfil, perfil_editado, tipouni, status
            ) VALUES (
                '1111111', 'UNIDADE MANUAL', 'MAC', true, '1', 'ativo'
            )
            """
        )
    pg_conn.commit()

    rows = [
        sync.normalize_prestador_row(
            {
                "codigo_externo": "1111111",
                "nome": "UNIDADE MANUAL ATUALIZADA",
                "tipouni": "1",
                "ativo": 1,
            },
            perfil_map,
            sync_ts,
        )
    ]
    assert rows[0]["perfil"] == "APS"

    counts = sync.sync_estabelecimentos(pg_conn, rows, pg_write=True)
    pg_conn.commit()

    assert counts["perfil_preserved"] == 1

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT nome, perfil, perfil_editado, tipouni
            FROM estabelecimentos
            WHERE codigo_externo = '1111111'
            """
        )
        nome, perfil, perfil_editado, tipouni = cur.fetchone()
        assert nome == "UNIDADE MANUAL ATUALIZADA"
        assert perfil == "MAC"
        assert perfil_editado is True
        assert tipouni == "1"


@pytest.mark.integration
def test_pg_write_new_row_derives_perfil_and_flag_false(cadastro_pg, sync_ts, perfil_map):
    pg_conn = cadastro_pg

    rows = [
        sync.normalize_prestador_row(
            {
                "codigo_externo": "3333333",
                "nome": "UBS NOVA SYNC",
                "tipouni": "2",
                "ativo": 1,
            },
            perfil_map,
            sync_ts,
        )
    ]
    counts = sync.sync_estabelecimentos(pg_conn, rows, pg_write=True)
    pg_conn.commit()

    assert counts["inserted"] == 1
    assert counts.get("perfil_preserved", 0) == 0

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT perfil, perfil_editado
            FROM estabelecimentos
            WHERE codigo_externo = '3333333'
            """
        )
        perfil, perfil_editado = cur.fetchone()
        assert perfil == "MAC"
        assert perfil_editado is False


@pytest.mark.integration
def test_pg_write_enriquecimento_hospitalar_unchanged(cadastro_pg, sync_ts):
    pg_conn = cadastro_pg

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO estabelecimentos (
                codigo_externo, nome, perfil, status, enriquecimento
            ) VALUES (
                '2222222', 'HOSPITAL X', 'Hospitalar', 'ativo', '{"leitos": {"clinico": 50}}'::jsonb
            )
            RETURNING id
            """
        )
        estab_id = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO enriquecimento_hospitalar (estabelecimento_id, leitos, notas)
            VALUES (%s, '{"clinico": 50}'::jsonb, 'notas legado')
            """,
            (estab_id,),
        )
    pg_conn.commit()

    rows = [
        sync.normalize_prestador_row(
            {
                "codigo_externo": "2222222",
                "nome": "HOSPITAL X ATUALIZADO",
                "tipouni": "3",
                "ativo": 1,
            },
            sync_ts=sync_ts,
        )
    ]
    sync.sync_estabelecimentos(pg_conn, rows, pg_write=True)
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT leitos, notas
            FROM enriquecimento_hospitalar
            WHERE estabelecimento_id = %s
            """,
            (estab_id,),
        )
        leitos, notas = cur.fetchone()
        assert leitos == {"clinico": 50}
        assert notas == "notas legado"


@pytest.mark.integration
def test_pg_write_inserts_estabelecimentos_and_audit(cadastro_pg):
    pg_conn = cadastro_pg

    prest = [
        sync.normalize_prestador_row(
            {
                "codigo_externo": "3333333",
                "nome": "UBS INTEGRACAO",
                "tipouni": "1",
                "ativo": 1,
            }
        )
    ]
    proc = [
        sync.normalize_procedimento_row(
            {
                "codigo_sigtap": "0401010010",
                "descricao": "EXAME",
                "pa_total": 25.5,
                "rubrica": "0202",
                "pa_id": "PA999",
                "financiamento": "APS",
            }
        )
    ]

    estab = sync.sync_estabelecimentos(pg_conn, prest, pg_write=True)
    proc_counts = sync.sync_procedimentos(pg_conn, proc, pg_write=True)
    result = {
        "status": "ok",
        "estabelecimentos": estab,
        "procedimentos": proc_counts,
    }
    sync.insert_sync_audit(pg_conn, result)
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM estabelecimentos WHERE codigo_externo = '3333333'")
        assert cur.fetchone()[0] == 1
        cur.execute("SELECT COUNT(*) FROM procedimentos WHERE codigo_sigtap = '0401010010'")
        assert cur.fetchone()[0] == 1
        cur.execute("SELECT estab_inseridos, estab_atualizados FROM cadastros_sincronizacoes ORDER BY id DESC LIMIT 1")
        inseridos, atualizados = cur.fetchone()
        assert inseridos + atualizados >= 1


def test_mysql_unavailable_returns_error_json(monkeypatch):
    monkeypatch.setattr(sync, "mysql_configured", lambda: False)

    result = sync.sincronizar(pg_write=False, dry_run=True)
    assert result["status"] == "erro"
    assert result["error"] == "MySQL_XAMPP_UNAVAILABLE"


@pytest.mark.integration
def test_mysql_unavailable_persists_audit_on_pg_write(monkeypatch, cadastro_pg):
    monkeypatch.setattr(sync, "mysql_configured", lambda: False)

    result = sync.sincronizar(pg_write=True)

    assert result["status"] == "erro"
    with cadastro_pg.cursor() as cur:
        cur.execute(
            "SELECT status, erro FROM cadastros_sincronizacoes ORDER BY id DESC LIMIT 1"
        )
        row = cur.fetchone()
    assert row[0] == "erro"
    assert row[1] == "MySQL_XAMPP_UNAVAILABLE"


def test_invalid_mysql_rows_emit_parcial_status(monkeypatch, sync_ts):
    monkeypatch.setattr(sync, "mysql_configured", lambda: True)
    monkeypatch.setattr(
        sync,
        "extrair_prestadores",
        lambda *_: [{"codigo_externo": "", "nome": "INVALIDO"}],
    )
    monkeypatch.setattr(sync, "extrair_procedimentos", lambda *_: [])

    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_cursor.fetchall.return_value = []
    monkeypatch.setattr(sync, "pg_connect", lambda: mock_conn)

    result = sync.sincronizar(pg_write=False, dry_run=True)

    assert result["status"] == "parcial"
    assert result["skipped"]["estabelecimentos"] == 1
    assert "error" in result


def test_cli_mysql_unavailable_exits_nonzero(monkeypatch):
    monkeypatch.setattr(
        sys,
        "argv",
        ["sync_cadastros_mysql.py", "--dry-run"],
    )
    monkeypatch.setattr(sync, "sincronizar", lambda **_: sync._error_result("MySQL_XAMPP_UNAVAILABLE"))

    with pytest.raises(SystemExit) as exc:
        sync.main()
    assert exc.value.code == 1


def test_cli_dry_run_prints_json(monkeypatch, capsys):
    monkeypatch.setattr(
        sys,
        "argv",
        ["sync_cadastros_mysql.py", "--dry-run"],
    )
    monkeypatch.setattr(
        sync,
        "sincronizar",
        lambda **_: {
            "status": "ok",
            "estabelecimentos": {"inserted": 1, "updated": 0, "inactivated": 0},
            "procedimentos": {"inserted": 2, "updated": 0, "inactivated": 0},
            "sincronizado_em": "2026-06-20T12:00:00+00:00",
        },
    )

    sync.main()
    payload = json.loads(capsys.readouterr().out)
    assert payload["status"] == "ok"
    assert payload["estabelecimentos"]["inserted"] == 1
