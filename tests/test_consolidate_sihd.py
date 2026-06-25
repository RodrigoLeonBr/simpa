"""
Tests for SIHD branch in consolidate_dashboard.py and etl_contract.py.

All tests are unit-level — no real DB required.
"""
from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, call

import pytest

import consolidate_dashboard
import etl_contract


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_conn(cursor_rows: list[list]):
    """Build a psycopg2-style mock that yields rows in sequence per cursor call."""
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    conn.cursor.return_value.__exit__.return_value = False
    cur.fetchone.side_effect = [row[0] if row else None for row in cursor_rows]
    cur.fetchall.side_effect = [row for row in cursor_rows]
    return conn, cur


# ---------------------------------------------------------------------------
# fetch_sih_rows — no sync row → PENDING_AIH_FILE
# ---------------------------------------------------------------------------


def test_fetch_sih_rows_no_sync_returns_pending():
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    conn.cursor.return_value.__exit__.return_value = False
    cur.fetchone.return_value = None  # no sih_sincronizacoes row

    result = consolidate_dashboard.fetch_sih_rows(conn, date(2025, 1, 1))

    assert result["status_importacao"] == "PENDING_AIH_FILE"
    assert result["internacoes_por_capitulo_cid"] == []


# ---------------------------------------------------------------------------
# fetch_sih_rows — sync ok but zero internacoes → PENDING_AIH_FILE
# ---------------------------------------------------------------------------


def test_fetch_sih_rows_sync_ok_but_empty_internacoes():
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    conn.cursor.return_value.__exit__.return_value = False

    # First call: sih_sincronizacoes → status ok
    # Second call: KPI → total_aih = 0
    cur.fetchone.side_effect = [
        ("ok", "2025-02-01"),   # sync row
        (0, 0, None, None),     # KPI row with 0 total_aih
    ]

    result = consolidate_dashboard.fetch_sih_rows(conn, date(2025, 1, 1))

    assert result["status_importacao"] == "PENDING_AIH_FILE"
    assert result["internacoes_por_capitulo_cid"] == []


# ---------------------------------------------------------------------------
# fetch_sih_rows — sync ok with data → OK + KPIs + CID chapters
# ---------------------------------------------------------------------------


def test_fetch_sih_rows_returns_ok_with_kpis():
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    conn.cursor.return_value.__exit__.return_value = False

    cur.fetchone.side_effect = [
        ("ok", "2025-02-01"),          # sync row
        (120, 48000.0, 12.5, 3.33),   # KPI row
    ]
    cur.fetchall.return_value = [
        ("J", 45, 18000.0),
        ("I", 30, 12000.0),
    ]

    result = consolidate_dashboard.fetch_sih_rows(conn, date(2025, 1, 1))

    assert result["status_importacao"] == "OK"
    assert result["total_aih"] == 120
    assert result["total_valor"] == 48000.0
    assert result["pct_diarias_uti"] == 12.5
    assert result["taxa_mortalidade"] == 3.33
    assert result["competencia_sincronizada"] == "2025-01"


# ---------------------------------------------------------------------------
# fetch_sih_rows — CID chapter descriptions
# ---------------------------------------------------------------------------


def test_fetch_sih_rows_cid_chapter_descricao():
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    conn.cursor.return_value.__exit__.return_value = False

    cur.fetchone.side_effect = [
        ("ok", "2025-02-01"),
        (50, 20000.0, 5.0, 2.0),
    ]
    cur.fetchall.return_value = [
        ("J", 20, 8000.0),
        ("F", 10, 4000.0),
        ("Z", 5, 1000.0),
        ("X", 3, 500.0),   # maps to V/W/X/Y — Causas externas
    ]

    result = consolidate_dashboard.fetch_sih_rows(conn, date(2025, 1, 1))

    chapters = {item["capitulo"]: item["descricao"] for item in result["internacoes_por_capitulo_cid"]}
    assert chapters["J"] == "J — Doenças respiratórias"
    assert chapters["F"] == "F — Transtornos mentais"
    assert chapters["Z"] == "Z — Fatores que influenciam a saúde"
    assert chapters["X"] == "V/W/X/Y — Causas externas"


# ---------------------------------------------------------------------------
# fetch_sih_rows — with estabelecimento_id filter
# ---------------------------------------------------------------------------


def test_fetch_sih_rows_with_estabelecimento_id():
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    conn.cursor.return_value.__exit__.return_value = False

    cur.fetchone.side_effect = [
        ("ok", "2025-02-01"),
        (80, 30000.0, 8.0, 1.5),
    ]
    cur.fetchall.return_value = [("I", 40, 15000.0)]

    result = consolidate_dashboard.fetch_sih_rows(conn, date(2025, 1, 1), estabelecimento_id=5)

    assert result["status_importacao"] == "OK"
    assert result["total_aih"] == 80
    # Verify estabelecimento_id filter was applied (checking execute calls)
    kpi_call = cur.execute.call_args_list[1]
    assert 5 in kpi_call.args[1]


# ---------------------------------------------------------------------------
# fetch_sih_rows — exception inside → returns PENDING (no crash)
# ---------------------------------------------------------------------------


def test_fetch_sih_rows_exception_does_not_propagate():
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    conn.cursor.return_value.__exit__.return_value = False
    cur.fetchone.side_effect = Exception("DB error")

    result = consolidate_dashboard.fetch_sih_rows(conn, date(2025, 1, 1))

    assert result["status_importacao"] == "PENDING_AIH_FILE"
    assert result["internacoes_por_capitulo_cid"] == []


# ---------------------------------------------------------------------------
# _build_hospitalar_sihd — None → PENDING
# ---------------------------------------------------------------------------


def test_build_hospitalar_sihd_none_returns_pending():
    result = etl_contract._build_hospitalar_sihd(None)
    assert result["status_importacao"] == "PENDING_AIH_FILE"
    assert result["internacoes_por_capitulo_cid"] == []


def test_build_hospitalar_sihd_pending_input_returns_pending():
    result = etl_contract._build_hospitalar_sihd({
        "status_importacao": "PENDING_AIH_FILE",
        "internacoes_por_capitulo_cid": [],
    })
    assert result["status_importacao"] == "PENDING_AIH_FILE"


def test_build_hospitalar_sihd_ok_input_returns_full_block():
    sih_data = {
        "status_importacao": "OK",
        "competencia_sincronizada": "2025-01",
        "total_aih": 120,
        "total_valor": 48000.0,
        "pct_diarias_uti": 12.5,
        "taxa_mortalidade": 3.33,
        "internacoes_por_capitulo_cid": [
            {"capitulo": "J", "descricao": "J — Doenças respiratórias", "qtd_aih": 45, "total_valor": 18000.0},
        ],
    }
    result = etl_contract._build_hospitalar_sihd(sih_data)
    assert result["status_importacao"] == "OK"
    assert result["total_aih"] == 120
    assert result["pct_diarias_uti"] == 12.5
    assert result["taxa_mortalidade"] == 3.33
    assert len(result["internacoes_por_capitulo_cid"]) == 1
    assert result["competencia_sincronizada"] == "2025-01"


# ---------------------------------------------------------------------------
# build_payload — hospitalar_sihd block present with sih_data=None
# ---------------------------------------------------------------------------


def test_build_payload_includes_hospitalar_sihd_pending_when_no_sih_data():
    payload = etl_contract.build_payload(
        competencia=date(2025, 1, 1),
        municipio="AMERICANA",
        unidade="UBS Teste",
        equipe="Equipe 1",
        raw_rows=[],
        sia_rows=[],
        mysql_available=False,
        pop_row=None,
        sih_data=None,
    )
    assert "hospitalar_sihd" in payload["modulos"]
    assert payload["modulos"]["hospitalar_sihd"]["status_importacao"] == "PENDING_AIH_FILE"
    assert payload["modulos"]["hospitalar_sihd"]["internacoes_por_capitulo_cid"] == []


def test_build_payload_includes_hospitalar_sihd_ok_when_sih_data_present():
    sih_data = {
        "status_importacao": "OK",
        "competencia_sincronizada": "2025-01",
        "total_aih": 100,
        "total_valor": 40000.0,
        "pct_diarias_uti": 10.0,
        "taxa_mortalidade": 2.0,
        "internacoes_por_capitulo_cid": [],
    }
    payload = etl_contract.build_payload(
        competencia=date(2025, 1, 1),
        municipio="AMERICANA",
        unidade="UBS Teste",
        equipe="Equipe 1",
        raw_rows=[],
        sia_rows=[],
        mysql_available=False,
        pop_row=None,
        sih_data=sih_data,
    )
    assert payload["modulos"]["hospitalar_sihd"]["status_importacao"] == "OK"
    assert payload["modulos"]["hospitalar_sihd"]["total_aih"] == 100


# ---------------------------------------------------------------------------
# build_payload backward compatibility — no sih_data arg (old callers)
# ---------------------------------------------------------------------------


def test_build_payload_backward_compat_no_sih_data_arg():
    """Callers that don't pass sih_data should still work."""
    payload = etl_contract.build_payload(
        competencia=date(2025, 1, 1),
        municipio="AMERICANA",
        unidade="UBS Teste",
        equipe="Equipe 1",
        raw_rows=[],
    )
    assert payload["modulos"]["hospitalar_sihd"]["status_importacao"] == "PENDING_AIH_FILE"
