"""
Tests for sync_sih_mysql.py.

All tests are unit-level (no real MySQL or PG required).
"""
from __future__ import annotations

import json
import sys
from datetime import date
from io import StringIO
from unittest.mock import MagicMock, call, patch

import pandas as pd
import pytest

import sync_sih_mysql


# ---------------------------------------------------------------------------
# 1. build_sih_query_internacoes
# ---------------------------------------------------------------------------


def test_build_sih_query_internacoes_where_clause():
    query = sync_sih_mysql.build_sih_query_internacoes()
    normalized = "".join(query.split())
    assert "WHEREsa.COMPETENCIA=%(comp)s" in normalized


def test_build_sih_query_internacoes_aggregates():
    query = sync_sih_mysql.build_sih_query_internacoes()
    normalized = "".join(query.split())
    assert "COUNT(DISTINCTsa.AIH)" in normalized
    assert "SUM(sa.DIARIAS)" in normalized
    assert "SUM(sa.VALOR_TOTAL_AIH)" in normalized


def test_build_sih_query_internacoes_no_cast():
    """s_aih fields are native int/decimal — no CAST should be present."""
    query = sync_sih_mysql.build_sih_query_internacoes()
    assert "CAST(" not in query


def test_build_sih_query_internacoes_collate():
    """JOIN prestador must use COLLATE utf8mb4_unicode_ci."""
    query = sync_sih_mysql.build_sih_query_internacoes()
    assert "COLLATE utf8mb4_unicode_ci" in query


def test_build_sih_query_internacoes_financiamento_2chars():
    """FINANCIAMENTO stored as-is (2 chars), no LEFT(…,4)."""
    query = sync_sih_mysql.build_sih_query_internacoes()
    assert "sa.FINANCIAMENTO" in query
    assert "LEFT(sa.FINANCIAMENTO" not in query


def test_build_sih_query_internacoes_group_by():
    query = sync_sih_mysql.build_sih_query_internacoes()
    normalized = "".join(query.split())
    assert "GROUPBY" in normalized
    assert "sa.PROC_PRINCIPAL" in query
    assert "sa.DIAG_PRINCIPAL" in query
    assert "sa.MOTIVO_SAIDA" in query
    assert "sa.SEXO_PACIENTE" in query


# ---------------------------------------------------------------------------
# 2. build_sih_query_procedimentos
# ---------------------------------------------------------------------------


def test_build_sih_query_procedimentos_where_clause():
    query = sync_sih_mysql.build_sih_query_procedimentos()
    assert "%(comp)s" in query


def test_build_sih_query_procedimentos_group_by():
    query = sync_sih_mysql.build_sih_query_procedimentos()
    normalized = "".join(query.split())
    assert "GROUPBY" in normalized
    assert "sp.PROC_DETALHADO" in query
    assert "sp.CBO_PROFISSIONAL" in query
    assert "sp.FINANCIAMENTO_DETALHE" in query


def test_build_sih_query_procedimentos_no_cast():
    query = sync_sih_mysql.build_sih_query_procedimentos()
    assert "CAST(" not in query


# ---------------------------------------------------------------------------
# 3. competencia_para_date
# ---------------------------------------------------------------------------


def test_competencia_para_date_valid():
    d = sync_sih_mysql.competencia_para_date("2025-01")
    assert d == date(2025, 1, 1)


def test_competencia_para_date_invalid_month():
    with pytest.raises(ValueError):
        sync_sih_mysql.competencia_para_date("2025-13")


def test_competencia_para_date_bad_format():
    with pytest.raises((ValueError, TypeError)):
        sync_sih_mysql.competencia_para_date("202501")


# ---------------------------------------------------------------------------
# 4. emit_sih_progress — prefix must be SIH_PROGRESS
# ---------------------------------------------------------------------------


def test_emit_sih_progress_prefix(capsys):
    sync_sih_mysql.emit_sih_progress(
        exec_id="test-exec",
        stage="extracao_mysql",
        event="extract_block",
        message="bloco extraído",
        block_rows=500,
    )
    captured = capsys.readouterr()
    assert captured.err.startswith("SIH_PROGRESS ")
    payload = json.loads(captured.err[len("SIH_PROGRESS "):].strip())
    assert payload["stage"] == "extracao_mysql"
    assert payload["event"] == "extract_block"
    assert payload["exec_id"] == "test-exec"
    assert payload["block_rows"] == 500


# ---------------------------------------------------------------------------
# 5. gravar_sih_pg — reimportar=True deletes children
# ---------------------------------------------------------------------------


def _make_conn_mock(sinc_id=42, estab_rows=None):
    conn = MagicMock()
    conn.__enter__.return_value = conn
    conn.__exit__.return_value = False
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    conn.cursor.return_value.__exit__.return_value = False
    cur.fetchone.return_value = (sinc_id,)
    cur.fetchall.return_value = estab_rows or []
    return conn, cur


def test_gravar_sih_pg_reimportar_deletes_children(monkeypatch):
    conn, cur = _make_conn_mock(sinc_id=10, estab_rows=[])
    monkeypatch.setattr(sync_sih_mysql, "execute_batch", lambda *_a, **_k: None)

    sync_sih_mysql.gravar_sih_pg(
        conn,
        pd.DataFrame(),
        pd.DataFrame(),
        date(2025, 1, 1),
        reimportar=True,
    )

    executed_sqls = [c.args[0] for c in cur.execute.call_args_list if c.args]
    assert any("DELETE FROM sih_internacoes WHERE sincronizacao_id" in s for s in executed_sqls)
    assert any("DELETE FROM sih_procedimentos WHERE sincronizacao_id" in s for s in executed_sqls)


def test_gravar_sih_pg_no_reimportar_no_delete(monkeypatch):
    conn, cur = _make_conn_mock(sinc_id=11, estab_rows=[])
    monkeypatch.setattr(sync_sih_mysql, "execute_batch", lambda *_a, **_k: None)

    sync_sih_mysql.gravar_sih_pg(
        conn,
        pd.DataFrame(),
        pd.DataFrame(),
        date(2025, 1, 1),
        reimportar=False,
    )

    executed_sqls = [c.args[0] for c in cur.execute.call_args_list if c.args]
    assert not any("DELETE FROM sih_internacoes" in s for s in executed_sqls)
    assert not any("DELETE FROM sih_procedimentos" in s for s in executed_sqls)


# ---------------------------------------------------------------------------
# 6. gravar_sih_pg — orphan_cnes counting
# ---------------------------------------------------------------------------


def test_gravar_sih_pg_orphan_cnes(monkeypatch):
    df_int = pd.DataFrame([
        {
            "cnes": "1111111",  # known → maps to id 1
            "proc_principal": "0301010010",
            "diag_principal": "J18",
            "complexidade": "02",
            "financiamento": "01",  # 2 chars
            "motivo_saida": "11",
            "sexo": "M",
            "qtd_aih": 3,
            "total_diarias": 9,
            "total_diarias_uti": 0,
            "total_valor": 3000.0,
            "media_idade": 45.0,
            "media_diarias": 3.0,
        },
        {
            "cnes": "9999999",  # unknown → orphan
            "proc_principal": "0301010020",
            "diag_principal": "I10",
            "complexidade": "02",
            "financiamento": "01",
            "motivo_saida": "11",
            "sexo": "F",
            "qtd_aih": 1,
            "total_diarias": 4,
            "total_diarias_uti": 0,
            "total_valor": 1000.0,
            "media_idade": 60.0,
            "media_diarias": 4.0,
        },
    ])

    conn, cur = _make_conn_mock(sinc_id=20, estab_rows=[("1111111", 1)])
    monkeypatch.setattr(sync_sih_mysql, "execute_batch", lambda *_a, **_k: None)

    result = sync_sih_mysql.gravar_sih_pg(
        conn,
        df_int,
        pd.DataFrame(),
        date(2025, 1, 1),
        reimportar=False,
    )

    assert result["orphan_cnes"] == 1
    assert result["qtd_internacoes"] == 2
    assert result["qtd_procedimentos"] == 0
    assert result["status"] == "ok"


# ---------------------------------------------------------------------------
# 7. gravar_sih_pg — SAVEPOINT per chunk + progress events in stderr
# ---------------------------------------------------------------------------


def test_gravar_sih_pg_savepoint_per_chunk(monkeypatch, capsys):
    df_int = pd.DataFrame([
        {
            "cnes": "1234567", "proc_principal": "0301010010",
            "diag_principal": "J18", "complexidade": "02",
            "financiamento": "01", "motivo_saida": "11", "sexo": "M",
            "qtd_aih": 1, "total_diarias": 3, "total_diarias_uti": 0,
            "total_valor": 1000.0, "media_idade": 40.0, "media_diarias": 3.0,
        },
        {
            "cnes": "7654321", "proc_principal": "0302010010",
            "diag_principal": "I10", "complexidade": "02",
            "financiamento": "01", "motivo_saida": "11", "sexo": "F",
            "qtd_aih": 2, "total_diarias": 6, "total_diarias_uti": 1,
            "total_valor": 2000.0, "media_idade": 55.0, "media_diarias": 3.0,
        },
    ])

    conn, cur = _make_conn_mock(sinc_id=30, estab_rows=[])
    batch_calls = []
    monkeypatch.setattr(
        sync_sih_mysql,
        "execute_batch",
        lambda _c, _s, payload: batch_calls.append(len(payload)),
    )

    sync_sih_mysql.gravar_sih_pg(
        conn,
        df_int,
        pd.DataFrame(),
        date(2025, 1, 1),
        batch_size=1,  # one row per chunk → 2 SAVEPOINTs
    )

    executed_sqls = [c.args[0] for c in cur.execute.call_args_list if c.args]
    savepoints = [s for s in executed_sqls if s.startswith("SAVEPOINT sih_int_")]
    assert len(savepoints) == 2

    # Progress events must be emitted to stderr with SIH_PROGRESS prefix
    stderr_output = capsys.readouterr().err
    progress_lines = [l for l in stderr_output.splitlines() if l.startswith("SIH_PROGRESS")]
    assert len(progress_lines) >= 2


# ---------------------------------------------------------------------------
# 8. gravar_sih_pg — chunk error → parcial, continues
# ---------------------------------------------------------------------------


def test_gravar_sih_pg_chunk_error_continues(monkeypatch):
    df_int = pd.DataFrame([
        {
            "cnes": "1111111", "proc_principal": "A", "diag_principal": "B",
            "complexidade": "01", "financiamento": "01", "motivo_saida": "11",
            "sexo": "M", "qtd_aih": 1, "total_diarias": 2, "total_diarias_uti": 0,
            "total_valor": 500.0, "media_idade": 30.0, "media_diarias": 2.0,
        },
        {
            "cnes": "2222222", "proc_principal": "C", "diag_principal": "D",
            "complexidade": "01", "financiamento": "01", "motivo_saida": "11",
            "sexo": "F", "qtd_aih": 1, "total_diarias": 2, "total_diarias_uti": 0,
            "total_valor": 500.0, "media_idade": 40.0, "media_diarias": 2.0,
        },
    ])

    conn, cur = _make_conn_mock(sinc_id=40, estab_rows=[])
    calls = {"n": 0}

    def failing_batch(_c, _s, _p):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("unique violation")

    monkeypatch.setattr(sync_sih_mysql, "execute_batch", failing_batch)

    result = sync_sih_mysql.gravar_sih_pg(
        conn,
        df_int,
        pd.DataFrame(),
        date(2025, 1, 1),
        batch_size=1,
    )

    assert result["status"] == "parcial"
    assert result["erros"] == 1
    assert calls["n"] == 2  # continued after first failure


# ---------------------------------------------------------------------------
# 9. sincronizar — mysql not configured returns error
# ---------------------------------------------------------------------------


def test_sincronizar_mysql_not_configured(monkeypatch):
    monkeypatch.setattr(sync_sih_mysql, "mysql_configured", lambda: False)
    result = sync_sih_mysql.sincronizar("2025-01", pg_write=True)
    assert result["status"] == "erro"
    assert result["error"] == "SIH_MYSQL_UNAVAILABLE"
    assert result["qtd_internacoes"] == 0


# ---------------------------------------------------------------------------
# 10. sincronizar — pg_write=False returns preview without PG write
# ---------------------------------------------------------------------------


def test_sincronizar_dry_run_no_pg_write(monkeypatch):
    monkeypatch.setattr(sync_sih_mysql, "mysql_configured", lambda: True)

    mock_conn = MagicMock()
    mock_conn.close = MagicMock()
    monkeypatch.setattr(sync_sih_mysql, "mysql_connect", lambda: mock_conn)

    df_int_sample = pd.DataFrame([
        {"cnes": "1234567", "qtd_aih": 10, "total_diarias": 30,
         "total_diarias_uti": 2, "total_valor": 5000.0},
    ])
    df_proc_sample = pd.DataFrame([
        {"cnes": "1234567", "proc_detalhado": "0301010010", "total_quantidade": 5},
    ])
    monkeypatch.setattr(sync_sih_mysql, "extrair_sih_internacoes", lambda *_: df_int_sample)
    monkeypatch.setattr(sync_sih_mysql, "extrair_sih_procedimentos", lambda *_: df_proc_sample)

    pg_connect_called = {"called": False}
    monkeypatch.setattr(sync_sih_mysql, "pg_connect", lambda: pg_connect_called.update({"called": True}))

    result = sync_sih_mysql.sincronizar("2025-01", pg_write=False)

    assert result["status"] == "ok"
    assert result["qtd_internacoes"] == 1
    assert result["qtd_procedimentos"] == 1
    assert "preview_internacoes" in result
    assert pg_connect_called["called"] is False


# ---------------------------------------------------------------------------
# 11. sincronizar — pg_write=True passes reimportar and raw count
# ---------------------------------------------------------------------------


def test_sincronizar_pg_write_passes_reimportar(monkeypatch):
    monkeypatch.setattr(sync_sih_mysql, "mysql_configured", lambda: True)

    mock_mysql = MagicMock()
    mock_mysql.close = MagicMock()
    monkeypatch.setattr(sync_sih_mysql, "mysql_connect", lambda: mock_mysql)

    df_int = pd.DataFrame([
        {"cnes": "1111111", "qtd_aih": 5, "total_diarias": 15,
         "total_diarias_uti": 0, "total_valor": 3000.0},
    ])
    df_proc = pd.DataFrame([
        {"cnes": "1111111", "proc_detalhado": "0301010010", "total_quantidade": 2},
    ])
    monkeypatch.setattr(sync_sih_mysql, "extrair_sih_internacoes", lambda *_: df_int)
    monkeypatch.setattr(sync_sih_mysql, "extrair_sih_procedimentos", lambda *_: df_proc)

    mock_pg = MagicMock()
    mock_pg.close = MagicMock()
    monkeypatch.setattr(sync_sih_mysql, "pg_connect", lambda: mock_pg)

    captured = {}

    def fake_gravar(conn_pg, df_int_, df_proc_, comp_date, *, reimportar, **kwargs):
        captured["reimportar"] = reimportar
        captured["qtd_int"] = len(df_int_)
        captured["qtd_proc"] = len(df_proc_)
        return {
            "sincronizacao_id": 1,
            "competencia": str(comp_date),
            "status": "ok",
            "qtd_internacoes": len(df_int_),
            "qtd_procedimentos": len(df_proc_),
            "orphan_cnes": 0,
            "erros": 0,
        }

    monkeypatch.setattr(sync_sih_mysql, "gravar_sih_pg", fake_gravar)

    result = sync_sih_mysql.sincronizar("2025-01", pg_write=True, reimportar=True)

    assert result["status"] == "ok"
    assert captured["reimportar"] is True
    assert captured["qtd_int"] == 1
    assert captured["qtd_proc"] == 1
    assert result["linhas_mysql_raw"] == 2  # len(df_int) + len(df_proc)
