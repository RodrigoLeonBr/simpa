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
MIGRATION_009 = ROOT / "migration_009_cadastros_forma_cbo.sql"
MIGRATION_011 = ROOT / "migration_011_rubricas_sia.sql"

TEST_ESTAB_KEYS = ("9999999", "1111111", "2222222", "3333333")
TEST_PROC_KEYS = ("0301010010", "0401010010")
TEST_FORMA_KEYS = ("010101", "020202")
TEST_CBO_KEYS = ("223505", "225125")
TEST_RUBRICA_KEYS = ("0101", "0202")


@pytest.fixture
def cadastro_pg(pg_conn):
    with pg_conn.cursor() as cur:
        cur.execute(MIGRATION_004.read_text(encoding="utf-8"))
        cur.execute(MIGRATION_005.read_text(encoding="utf-8"))
        cur.execute(MIGRATION_009.read_text(encoding="utf-8"))
        cur.execute(MIGRATION_011.read_text(encoding="utf-8"))
        cur.execute(
            "DELETE FROM procedimentos WHERE codigo_sigtap = ANY(%s)",
            (list(TEST_PROC_KEYS),),
        )
        cur.execute(
            "DELETE FROM estabelecimentos WHERE codigo_externo = ANY(%s)",
            (list(TEST_ESTAB_KEYS),),
        )
        cur.execute(
            "DELETE FROM formas_sia WHERE codigo_forma = ANY(%s)",
            (list(TEST_FORMA_KEYS),),
        )
        cur.execute(
            "DELETE FROM cbos_sia WHERE codigo_cbo = ANY(%s)",
            (list(TEST_CBO_KEYS),),
        )
        cur.execute(
            "DELETE FROM rubricas_sia WHERE codigo_rubrica = ANY(%s)",
            (list(TEST_RUBRICA_KEYS),),
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


def test_build_forma_query_defaults_match_producao_schema():
    query = sync.build_forma_query()
    cfg = sync.build_cadastro_config()

    assert cfg["table_forma"] == "forma"
    assert cfg["col_forma_grupo"] == "grupo"
    assert cfg["col_forma_subgrupo"] == "subgrupo"
    assert cfg["col_forma_codigo"] == "forma"
    assert cfg["col_forma_desc"] == "descricao"
    assert "f.grupo AS codigo_grupo" in query
    assert "f.subgrupo AS codigo_subgrupo" in query
    assert "f.forma AS codigo_forma" in query
    assert "f.descricao AS descricao" in query
    assert "FROM forma f" in query


def test_build_cbo_query_defaults_match_producao_schema():
    query = sync.build_cbo_query()
    cfg = sync.build_cadastro_config()

    assert cfg["table_cbo"] == "cbo"
    assert cfg["col_cbo_codigo"] == "CBO"
    assert cfg["col_cbo_desc"] == "DS_CBO"
    assert "c.CBO AS codigo_cbo" in query
    assert "c.DS_CBO AS descricao" in query
    assert "FROM cbo c" in query


def test_build_rubrica_query_defaults_match_producao_schema():
    query = sync.build_rubrica_query()
    cfg = sync.build_cadastro_config()

    assert cfg["table_rubrica"] == "s_rub"
    assert cfg["col_rubrica_codigo"] == "RUB_ID"
    assert cfg["col_rubrica_desc"] == "RUB_DC"
    assert "r.RUB_ID AS codigo_rubrica" in query
    assert "r.RUB_DC AS descricao" in query
    assert "FROM s_rub r" in query


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


def test_normalize_forma_row_returns_expected_fields(sync_ts):
    row = sync.normalize_forma_row(
        {
            "codigo_grupo": "01",
            "codigo_subgrupo": "0101",
            "codigo_forma": "010101",
            "descricao": "CONSULTA MEDICA",
        },
        sync_ts,
    )
    assert row["codigo_grupo"] == "01"
    assert row["codigo_subgrupo"] == "0101"
    assert row["codigo_forma"] == "010101"
    assert row["descricao"] == "CONSULTA MEDICA"
    assert row["status"] == "ativo"
    assert row["sincronizado_em"] == sync_ts


def test_normalize_forma_row_derives_grupo_subgrupo_from_codigo(sync_ts):
    row = sync.normalize_forma_row(
        {
            "codigo_forma": "020202",
            "descricao": "EXAME LABORATORIAL",
        },
        sync_ts,
    )
    assert row["codigo_grupo"] == "02"
    assert row["codigo_subgrupo"] == "0202"
    assert row["codigo_forma"] == "020202"


def test_normalize_forma_row_pads_short_codigo(sync_ts):
    row = sync.normalize_forma_row(
        {
            "codigo_forma": "10101",
            "descricao": "FORMA CURTA",
        },
        sync_ts,
    )
    assert row["codigo_forma"] == "010101"
    assert row["codigo_grupo"] == "01"
    assert row["codigo_subgrupo"] == "0101"


def test_normalize_cbo_row_returns_expected_fields(sync_ts):
    row = sync.normalize_cbo_row(
        {
            "codigo_cbo": "223505",
            "descricao": "ENFERMEIRO",
        },
        sync_ts,
    )
    assert row["codigo_cbo"] == "223505"
    assert row["descricao"] == "ENFERMEIRO"
    assert row["status"] == "ativo"
    assert row["sincronizado_em"] == sync_ts


def test_normalize_cbo_row_pads_codigo_to_six_chars(sync_ts):
    row = sync.normalize_cbo_row(
        {
            "codigo_cbo": "1234",
            "descricao": "PROFISSIONAL TESTE",
        },
        sync_ts,
    )
    assert row["codigo_cbo"] == "001234"


def test_normalize_cbo_row_strips_spaces_and_truncates_prd_cbo(sync_ts):
    row = sync.normalize_cbo_row(
        {
            "codigo_cbo": " 22350501 ",
            "descricao": "ENFERMEIRO",
        },
        sync_ts,
    )
    assert row["codigo_cbo"] == "223505"


def test_normalize_rubrica_row_returns_expected_fields(sync_ts):
    row = sync.normalize_rubrica_row(
        {
            "codigo_rubrica": "101",
            "descricao": "ATENCAO BASICA",
        },
        sync_ts,
    )
    assert row["codigo_rubrica"] == "0101"
    assert row["descricao"] == "ATENCAO BASICA"
    assert row["status"] == "ativo"
    assert row["sincronizado_em"] == sync_ts


def test_snapshot_allows_inactivation_empty_snapshot():
    assert sync.snapshot_allows_inactivation(0, 10) is False


def test_snapshot_allows_inactivation_respects_min_ratio():
    assert sync.snapshot_allows_inactivation(2, 10, min_ratio=0.25) is False
    assert sync.snapshot_allows_inactivation(3, 10, min_ratio=0.25) is True
    assert sync.snapshot_allows_inactivation(5, 0, min_ratio=0.25) is True


def test_inactivate_formas_skips_empty_snapshot():
    cur = MagicMock()
    count = sync._inactivate_formas(cur, set(), pg_write=True)
    assert count == 0
    cur.execute.assert_not_called()


def test_inactivate_cbos_skips_empty_snapshot():
    cur = MagicMock()
    count = sync._inactivate_cbos(cur, set(), pg_write=True)
    assert count == 0
    cur.execute.assert_not_called()


def test_invalid_forma_cbo_rows_emit_parcial_status(monkeypatch):
    monkeypatch.setattr(sync, "mysql_configured", lambda: True)
    monkeypatch.setattr(sync, "extrair_prestadores", lambda *_: [])
    monkeypatch.setattr(sync, "extrair_procedimentos", lambda *_: [])
    monkeypatch.setattr(
        sync,
        "extrair_formas",
        lambda *_: [{"codigo_forma": "", "descricao": "INVALIDO"}],
    )
    monkeypatch.setattr(
        sync,
        "extrair_cbos",
        lambda *_: [{"codigo_cbo": "223505", "descricao": ""}],
    )
    monkeypatch.setattr(sync, "extrair_rubricas", lambda *_: [])

    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_cursor.fetchall.return_value = []
    monkeypatch.setattr(sync, "pg_connect", lambda: mock_conn)

    result = sync.sincronizar(pg_write=False, dry_run=True)

    assert result["status"] == "parcial"
    assert result["skipped"]["formas"] == 1
    assert result["skipped"]["cbos"] == 1
    assert result["formas"]["inactivated"] == 0
    assert result["cbos"]["inactivated"] == 0


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
    monkeypatch.setattr(sync, "extrair_formas", lambda *_: [])
    monkeypatch.setattr(sync, "extrair_cbos", lambda *_: [])
    monkeypatch.setattr(sync, "extrair_rubricas", lambda *_: [])

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
    assert result["formas"] == {"inserted": 0, "updated": 0, "inactivated": 0}
    assert result["cbos"] == {"inserted": 0, "updated": 0, "inactivated": 0}
    assert result["rubricas"] == {"inserted": 0, "updated": 0, "inactivated": 0}

    write_calls = [
        call
        for call in mock_cursor.execute.call_args_list
        if call.args and isinstance(call.args[0], str)
        and ("INSERT INTO" in call.args[0] or "UPDATE " in call.args[0])
    ]
    assert write_calls == []
    mock_conn.commit.assert_not_called()


def test_dry_run_includes_forma_cbo_counters(monkeypatch, sync_ts):
    formas = [
        {
            "codigo_grupo": "01",
            "codigo_subgrupo": "0101",
            "codigo_forma": "010101",
            "descricao": "CONSULTA",
        }
    ]
    cbos = [{"codigo_cbo": "223505", "descricao": "ENFERMEIRO"}]

    monkeypatch.setattr(sync, "mysql_configured", lambda: True)
    monkeypatch.setattr(sync, "extrair_prestadores", lambda *_: [])
    monkeypatch.setattr(sync, "extrair_procedimentos", lambda *_: [])
    monkeypatch.setattr(sync, "extrair_formas", lambda *_: formas)
    monkeypatch.setattr(sync, "extrair_cbos", lambda *_: cbos)
    monkeypatch.setattr(
        sync,
        "extrair_rubricas",
        lambda *_: [{"codigo_rubrica": "0101", "descricao": "ATENCAO BASICA"}],
    )

    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_cursor.fetchall.return_value = []
    monkeypatch.setattr(sync, "pg_connect", lambda: mock_conn)

    result = sync.sincronizar(pg_write=False, dry_run=True)

    assert result["status"] == "ok"
    assert result["formas"]["inserted"] == 1
    assert result["cbos"]["inserted"] == 1
    assert result["rubricas"]["inserted"] == 1
    mock_conn.commit.assert_not_called()


def test_dry_run_succeeds_when_postgres_unavailable(monkeypatch):
    monkeypatch.setattr(sync, "mysql_configured", lambda: True)
    monkeypatch.setattr(
        sync,
        "extrair_prestadores",
        lambda *_: [{"codigo_externo": "1111111", "nome": "UBS A", "ativo": 1}],
    )
    monkeypatch.setattr(
        sync,
        "extrair_procedimentos",
        lambda *_: [{"codigo_sigtap": "0301010010", "descricao": "CONSULTA"}],
    )
    monkeypatch.setattr(
        sync,
        "extrair_formas",
        lambda *_: [{"codigo_forma": "010101", "descricao": "CONSULTA"}],
    )
    monkeypatch.setattr(
        sync,
        "extrair_cbos",
        lambda *_: [{"codigo_cbo": "223505", "descricao": "ENFERMEIRO"}],
    )
    monkeypatch.setattr(
        sync,
        "extrair_rubricas",
        lambda *_: [{"codigo_rubrica": "0101", "descricao": "ATENCAO BASICA"}],
    )
    monkeypatch.setattr(
        sync,
        "pg_connect",
        lambda: (_ for _ in ()).throw(RuntimeError("pg down")),
    )

    result = sync.sincronizar(pg_write=False, dry_run=True)

    assert result["status"] == "ok"
    assert result["estabelecimentos"]["inserted"] == 1
    assert result["procedimentos"]["inserted"] == 1
    assert result["formas"]["inserted"] == 1
    assert result["cbos"]["inserted"] == 1
    assert result["rubricas"]["inserted"] == 1
    assert result["warning"].startswith("PG_UNAVAILABLE_DRY_RUN:")


@pytest.mark.integration
def test_inconsistent_forma_snapshot_skips_mass_inactivation(cadastro_pg, sync_ts):
    pg_conn = cadastro_pg
    legacy_codes = ("911111", "922222", "933333", "944444", "955555")

    with pg_conn.cursor() as cur:
        cur.execute("DELETE FROM formas_sia")
        for code in legacy_codes:
            cur.execute(
                """
                INSERT INTO formas_sia (
                    codigo_grupo, codigo_subgrupo, codigo_forma, descricao, status
                ) VALUES (%s, %s, %s, %s, 'ativo')
                """,
                (code[:2], code[:4], code, f"FORMA {code}"),
            )
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM formas_sia
            WHERE status = 'ativo' AND codigo_forma = ANY(%s)
            """,
            (list(legacy_codes),),
        )
        active_legacy_before = cur.fetchone()[0]
    assert active_legacy_before == len(legacy_codes)

    partial = [
        sync.normalize_forma_row(
            {
                "codigo_grupo": "01",
                "codigo_subgrupo": "0101",
                "codigo_forma": "010101",
                "descricao": "CONSULTA PARCIAL",
            },
            sync_ts,
        )
    ]
    counts = sync.sync_formas(pg_conn, partial, pg_write=True)
    pg_conn.commit()

    assert counts["inactivated"] == 0

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM formas_sia
            WHERE status = 'ativo' AND codigo_forma = ANY(%s)
            """,
            (list(legacy_codes),),
        )
        active_legacy_after = cur.fetchone()[0]
        cur.execute(
            "SELECT COUNT(*) FROM formas_sia WHERE codigo_forma = '010101' AND status = 'ativo'"
        )
        partial_count = cur.fetchone()[0]

    assert active_legacy_after == active_legacy_before
    assert partial_count == 1


@pytest.mark.integration
def test_partial_forma_sync_inactivates_when_ratio_allows(cadastro_pg, sync_ts, monkeypatch):
    pg_conn = cadastro_pg
    monkeypatch.setenv("CADASTRO_SNAPSHOT_MIN_RATIO", "0.01")
    forma_codes = ("966666", "977777", "988888")

    with pg_conn.cursor() as cur:
        cur.execute("DELETE FROM formas_sia WHERE codigo_forma = ANY(%s)", (list(forma_codes),))
        cur.execute(
            """
            INSERT INTO formas_sia (
                codigo_grupo, codigo_subgrupo, codigo_forma, descricao, status
            ) VALUES
                ('96', '9666', '966666', 'FORMA A', 'ativo'),
                ('97', '9777', '977777', 'FORMA B', 'ativo'),
                ('98', '9888', '988888', 'FORMA C', 'ativo')
            """
        )
    pg_conn.commit()

    rows = [
        sync.normalize_forma_row(
            {
                "codigo_grupo": "96",
                "codigo_subgrupo": "9666",
                "codigo_forma": "966666",
                "descricao": "FORMA A ATUALIZADA",
            },
            sync_ts,
        )
    ]
    counts = sync.sync_formas(pg_conn, rows, pg_write=True)
    pg_conn.commit()

    assert counts["updated"] == 1
    assert counts["inactivated"] >= 2

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM formas_sia
            WHERE status = 'ativo' AND codigo_forma = ANY(%s)
            """,
            (list(forma_codes),),
        )
        active_target_after = cur.fetchone()[0]

    assert active_target_after == 1


@pytest.mark.integration
def test_forma_inactivation_is_blocked_when_rows_were_skipped(cadastro_pg, sync_ts, monkeypatch):
    pg_conn = cadastro_pg
    monkeypatch.setenv("CADASTRO_SNAPSHOT_MIN_RATIO", "0.01")
    forma_codes = ("866666", "877777", "888888")

    with pg_conn.cursor() as cur:
        cur.execute("DELETE FROM formas_sia WHERE codigo_forma = ANY(%s)", (list(forma_codes),))
        cur.execute(
            """
            INSERT INTO formas_sia (
                codigo_grupo, codigo_subgrupo, codigo_forma, descricao, status
            ) VALUES
                ('86', '8666', '866666', 'FORMA A', 'ativo'),
                ('87', '8777', '877777', 'FORMA B', 'ativo'),
                ('88', '8888', '888888', 'FORMA C', 'ativo')
            """
        )
    pg_conn.commit()

    rows = [
        sync.normalize_forma_row(
            {
                "codigo_grupo": "86",
                "codigo_subgrupo": "8666",
                "codigo_forma": "866666",
                "descricao": "FORMA A ATUALIZADA",
            },
            sync_ts,
        )
    ]
    counts = sync.sync_formas(pg_conn, rows, pg_write=True, skipped_rows=1)
    pg_conn.commit()

    assert counts["updated"] == 1
    assert counts["inactivated"] == 0

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM formas_sia
            WHERE status = 'ativo' AND codigo_forma = ANY(%s)
            """,
            (list(forma_codes),),
        )
        active_target_after = cur.fetchone()[0]
        cur.execute("DELETE FROM formas_sia WHERE codigo_forma = ANY(%s)", (list(forma_codes),))
    pg_conn.commit()

    assert active_target_after == 3


@pytest.mark.integration
def test_cbo_inactivation_is_blocked_when_rows_were_skipped(cadastro_pg, sync_ts, monkeypatch):
    pg_conn = cadastro_pg
    monkeypatch.setenv("CADASTRO_SNAPSHOT_MIN_RATIO", "0.01")
    cbo_codes = ("123456", "123457", "123458")

    with pg_conn.cursor() as cur:
        cur.execute("DELETE FROM cbos_sia WHERE codigo_cbo = ANY(%s)", (list(cbo_codes),))
        cur.execute(
            """
            INSERT INTO cbos_sia (codigo_cbo, descricao, status) VALUES
                ('123456', 'CBO A', 'ativo'),
                ('123457', 'CBO B', 'ativo'),
                ('123458', 'CBO C', 'ativo')
            """
        )
    pg_conn.commit()

    rows = [sync.normalize_cbo_row({"codigo_cbo": "123456", "descricao": "CBO A ATUALIZADO"}, sync_ts)]
    counts = sync.sync_cbos(pg_conn, rows, pg_write=True, skipped_rows=2)
    pg_conn.commit()

    assert counts["updated"] == 1
    assert counts["inactivated"] == 0

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM cbos_sia
            WHERE status = 'ativo' AND codigo_cbo = ANY(%s)
            """,
            (list(cbo_codes),),
        )
        active_target_after = cur.fetchone()[0]
        cur.execute("DELETE FROM cbos_sia WHERE codigo_cbo = ANY(%s)", (list(cbo_codes),))
    pg_conn.commit()

    assert active_target_after == 3


@pytest.mark.integration
def test_upsert_forma_updates_existing_without_duplicate(cadastro_pg, sync_ts):
    pg_conn = cadastro_pg
    row = sync.normalize_forma_row(
        {
            "codigo_grupo": "01",
            "codigo_subgrupo": "0101",
            "codigo_forma": "010101",
            "descricao": "CONSULTA ORIGINAL",
        },
        sync_ts,
    )

    counts_first = sync.sync_formas(pg_conn, [row], pg_write=True)
    pg_conn.commit()
    assert counts_first["inserted"] == 1

    updated = sync.normalize_forma_row(
        {
            "codigo_grupo": "01",
            "codigo_subgrupo": "0101",
            "codigo_forma": "010101",
            "descricao": "CONSULTA ATUALIZADA",
        },
        sync_ts,
    )
    counts_second = sync.sync_formas(pg_conn, [updated], pg_write=True)
    pg_conn.commit()
    assert counts_second["updated"] == 1

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*), MAX(descricao)
            FROM formas_sia
            WHERE codigo_forma = '010101'
            """
        )
        count, descricao = cur.fetchone()
        assert count == 1
        assert descricao == "CONSULTA ATUALIZADA"


@pytest.mark.integration
def test_sync_rubricas_upsert_idempotent(cadastro_pg, sync_ts):
    pg_conn = cadastro_pg
    first = sync.normalize_rubrica_row(
        {
            "codigo_rubrica": "0101",
            "descricao": "ATENCAO BASICA",
        },
        sync_ts,
    )
    second = sync.normalize_rubrica_row(
        {
            "codigo_rubrica": "0101",
            "descricao": "ATENCAO BASICA ATUALIZADA",
        },
        sync_ts,
    )

    counts_first = sync.sync_rubricas(pg_conn, [first], pg_write=True)
    pg_conn.commit()
    assert counts_first["inserted"] == 1

    counts_second = sync.sync_rubricas(pg_conn, [second], pg_write=True)
    pg_conn.commit()
    assert counts_second["updated"] == 1

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*), MAX(descricao)
            FROM rubricas_sia
            WHERE codigo_rubrica = '0101'
            """
        )
        count, descricao = cur.fetchone()
        assert count == 1
        assert descricao == "ATENCAO BASICA ATUALIZADA"


@pytest.mark.integration
def test_reference_resync_updates_without_duplicate_keys(cadastro_pg, sync_ts):
    pg_conn = cadastro_pg
    procedimentos = [
        sync.normalize_procedimento_row(
            {
                "codigo_sigtap": "0301010010",
                "descricao": "CONSULTA CLINICA",
                "pa_total": 5,
                "rubrica": "0101",
                "pa_id": "PA100",
                "financiamento": "APS",
            },
            sync_ts,
        )
    ]
    formas = [
        sync.normalize_forma_row(
            {
                "codigo_grupo": "01",
                "codigo_subgrupo": "0101",
                "codigo_forma": "010101",
                "descricao": "CONSULTA",
            },
            sync_ts,
        )
    ]
    cbos = [
        sync.normalize_cbo_row(
            {
                "codigo_cbo": "223505",
                "descricao": "ENFERMEIRO",
            },
            sync_ts,
        )
    ]

    sync.sync_procedimentos(pg_conn, procedimentos, pg_write=True)
    sync.sync_formas(pg_conn, formas, pg_write=True)
    sync.sync_cbos(pg_conn, cbos, pg_write=True)
    pg_conn.commit()

    procedimentos_v2 = [
        sync.normalize_procedimento_row(
            {
                "codigo_sigtap": "0301010010",
                "descricao": "CONSULTA CLINICA ATUALIZADA",
                "pa_total": 7,
                "rubrica": "0101",
                "pa_id": "PA101",
                "financiamento": "APS",
            },
            sync_ts,
        )
    ]
    formas_v2 = [
        sync.normalize_forma_row(
            {
                "codigo_grupo": "01",
                "codigo_subgrupo": "0101",
                "codigo_forma": "010101",
                "descricao": "CONSULTA ATUALIZADA",
            },
            sync_ts,
        )
    ]
    cbos_v2 = [
        sync.normalize_cbo_row(
            {
                "codigo_cbo": "223505",
                "descricao": "ENFERMEIRO ATUALIZADO",
            },
            sync_ts,
        )
    ]

    proc_counts = sync.sync_procedimentos(pg_conn, procedimentos_v2, pg_write=True)
    forma_counts = sync.sync_formas(pg_conn, formas_v2, pg_write=True)
    cbo_counts = sync.sync_cbos(pg_conn, cbos_v2, pg_write=True)
    pg_conn.commit()

    assert proc_counts["updated"] == 1
    assert forma_counts["updated"] == 1
    assert cbo_counts["updated"] == 1

    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM procedimentos WHERE codigo_sigtap = '0301010010'"
        )
        assert cur.fetchone()[0] == 1
        cur.execute("SELECT COUNT(*) FROM formas_sia WHERE codigo_forma = '010101'")
        assert cur.fetchone()[0] == 1
        cur.execute("SELECT COUNT(*) FROM cbos_sia WHERE codigo_cbo = '223505'")
        assert cur.fetchone()[0] == 1


@pytest.mark.integration
def test_pg_write_persists_formas_and_cbos(cadastro_pg, sync_ts):
    pg_conn = cadastro_pg

    formas = [
        sync.normalize_forma_row(
            {
                "codigo_grupo": "02",
                "codigo_subgrupo": "0202",
                "codigo_forma": "020202",
                "descricao": "EXAME",
            },
            sync_ts,
        )
    ]
    cbos = [
        sync.normalize_cbo_row(
            {"codigo_cbo": "225125", "descricao": "MEDICO CLINICO"},
            sync_ts,
        )
    ]

    forma_counts = sync.sync_formas(pg_conn, formas, pg_write=True)
    cbo_counts = sync.sync_cbos(pg_conn, cbos, pg_write=True)
    result = {
        "status": "ok",
        "estabelecimentos": dict(sync.COUNT_TEMPLATE),
        "procedimentos": dict(sync.COUNT_TEMPLATE),
        "formas": forma_counts,
        "cbos": cbo_counts,
    }
    sync.insert_sync_audit(pg_conn, result)
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM formas_sia WHERE codigo_forma = '020202'")
        assert cur.fetchone()[0] == 1
        cur.execute("SELECT COUNT(*) FROM cbos_sia WHERE codigo_cbo = '225125'")
        assert cur.fetchone()[0] == 1
        cur.execute(
            """
            SELECT forma_inseridos, cbo_inseridos
            FROM cadastros_sincronizacoes
            ORDER BY id DESC
            LIMIT 1
            """
        )
        forma_inseridos, cbo_inseridos = cur.fetchone()
        assert forma_inseridos >= 1
        assert cbo_inseridos >= 1


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
        "formas": dict(sync.COUNT_TEMPLATE),
        "cbos": dict(sync.COUNT_TEMPLATE),
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
    monkeypatch.setattr(sync, "extrair_formas", lambda *_: [])
    monkeypatch.setattr(sync, "extrair_cbos", lambda *_: [])
    monkeypatch.setattr(sync, "extrair_rubricas", lambda *_: [])

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
