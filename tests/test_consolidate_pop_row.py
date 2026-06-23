"""Tests for consolidate_dashboard.py — fetch_pop_row() integration."""
import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

import consolidate_dashboard as consolidator
from consolidate_dashboard import fetch_pop_row

ROOT = Path(__file__).resolve().parents[1]


# ---------------------------------------------------------------------------
# Fake DB helpers
# ---------------------------------------------------------------------------

class _FakeCursor:
    def __init__(self, fetchone_result=None, fetchall_result=None):
        self.calls: list[tuple] = []
        self._fetchone = fetchone_result
        self._fetchall = fetchall_result or []
        self.description = []

    def execute(self, sql, params=None):
        self.calls.append((sql, params))

    def fetchone(self):
        return self._fetchone

    def fetchall(self):
        return self._fetchall

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


class _FakeConn:
    def __init__(self, cursor: _FakeCursor):
        self._cursor = cursor

    def cursor(self):
        return self._cursor

    def commit(self):
        pass


# ---------------------------------------------------------------------------
# Unit tests: fetch_pop_row()
# ---------------------------------------------------------------------------

def test_fetch_pop_row_returns_none_when_estabelecimento_id_is_none():
    """Must not query DB when no estabelecimento_id (legacy path)."""
    cur = _FakeCursor()
    conn = _FakeConn(cur)
    result = fetch_pop_row(conn, date(2026, 1, 1), None)
    assert result is None
    assert len(cur.calls) == 0  # no DB call


def test_fetch_pop_row_returns_none_when_no_row():
    cur = _FakeCursor(fetchone_result=None)
    conn = _FakeConn(cur)
    result = fetch_pop_row(conn, date(2026, 1, 1), 5)
    assert result is None


def test_fetch_pop_row_returns_dict_when_row_exists():
    faixas = [{"faixa": "Menos de 01 ano", "masculino": 31, "feminino": 26}]
    conds = {"gestante": {"sim": 24, "nao": 284, "nao_informado": 3029}}
    raca = {"branca": 2570}
    cur = _FakeCursor(fetchone_result=(3337, 1198, faixas, conds, raca))
    conn = _FakeConn(cur)

    result = fetch_pop_row(conn, date(2026, 1, 1), 5)

    assert result is not None
    assert result["cidadaos_ativos"] == 3337
    assert result["saidas"] == 1198
    assert result["faixa_etaria"] == faixas
    assert result["condicoes_saude"] == conds
    assert result["raca_cor"] == raca


def test_fetch_pop_row_uses_correct_query_params():
    cur = _FakeCursor(fetchone_result=None)
    conn = _FakeConn(cur)
    fetch_pop_row(conn, date(2026, 1, 1), 99)

    assert len(cur.calls) == 1
    sql, params = cur.calls[0]
    assert "populacao_cadastrada" in sql
    assert "competencia" in sql
    assert "estabelecimento_id" in sql
    assert params == (date(2026, 1, 1), 99)


def test_fetch_pop_row_defaults_null_jsonb_to_empty():
    """JSONB columns that are NULL in DB should default to [] / {}."""
    cur = _FakeCursor(fetchone_result=(10, 0, None, None, None))
    conn = _FakeConn(cur)
    result = fetch_pop_row(conn, date(2026, 1, 1), 3)
    assert result["faixa_etaria"] == []
    assert result["condicoes_saude"] == {}
    assert result["raca_cor"] == {}


# ---------------------------------------------------------------------------
# Unit tests: consolidate_group() with pop_row injection
# ---------------------------------------------------------------------------

def _make_fake_conn_for_consolidate(pop_fetchone=None):
    """
    Returns a conn that answers differently per query:
    - fetch_cadastro_labels: returns ('UBS TESTE', 'EQUIPE 1')
    - fetch_raw_rows: returns []
    - fetch_sia_rows: returns []
    - sia_sync_exists: returns 0
    - fetch_pop_row: returns pop_fetchone
    - write_payload: returns (1, '2026-01-01')
    """
    call_count = [0]

    class _MultiCursor:
        def __init__(self):
            self.calls: list = []
            self.description = [("col",)]

        def execute(self, sql, params=None):
            self.calls.append((sql, params))
            call_count[0] += 1

        def fetchone(self):
            sql = self.calls[-1][0] if self.calls else ""
            if "populacao_cadastrada" in sql:
                return pop_fetchone
            if "estabelecimentos" in sql or "equipes" in sql:
                return ("UBS TESTE", "EQUIPE 1")
            if "sia_sincronizacoes" in sql:
                return (0,)
            return (1, "2026-01-01 00:00:00")

        def fetchall(self):
            return []

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

    class _MultiConn:
        def __init__(self):
            self._cur = _MultiCursor()

        def cursor(self):
            return self._cur

        def commit(self):
            pass

    return _MultiConn()


def test_consolidate_group_id_path_passes_pop_row_to_build_payload(monkeypatch):
    """When estabelecimento_id given + pop row exists, build_payload gets pop_row."""
    captured = {}

    import etl_contract
    original_build = etl_contract.build_payload

    def fake_build(**kwargs):
        captured["pop_row"] = kwargs.get("pop_row")
        return original_build(**kwargs)

    monkeypatch.setattr(etl_contract, "build_payload", fake_build)
    monkeypatch.setattr(consolidator, "build_payload", fake_build)

    faixas = [{"faixa": "Menos de 01 ano", "masculino": 31, "feminino": 26}]
    conn = _make_fake_conn_for_consolidate(
        pop_fetchone=(3337, 1198, faixas, {"gestante": {"sim": 24, "nao": 0, "nao_informado": 0}}, {})
    )

    result = consolidator.consolidate_group(
        conn,
        date(2026, 1, 1),
        "AMERICANA",
        "UBS TESTE",
        "EQUIPE 1",
        estabelecimento_id=5,
        equipe_id=10,
        pg_write=False,
    )

    assert captured.get("pop_row") is not None
    assert captured["pop_row"]["cidadaos_ativos"] == 3337


def test_consolidate_group_legacy_path_passes_none_pop_row(monkeypatch):
    """Legacy path (no estabelecimento_id) must pass pop_row=None to build_payload."""
    captured = {}

    import etl_contract
    original_build = etl_contract.build_payload

    def fake_build(**kwargs):
        captured["pop_row"] = kwargs.get("pop_row")
        return original_build(**kwargs)

    monkeypatch.setattr(etl_contract, "build_payload", fake_build)
    monkeypatch.setattr(consolidator, "build_payload", fake_build)

    conn = _make_fake_conn_for_consolidate()

    result = consolidator.consolidate_group(
        conn,
        date(2026, 1, 1),
        "AMERICANA",
        "UBS TESTE",
        "EQUIPE 1",
        pg_write=False,
    )

    assert captured.get("pop_row") is None


def test_consolidate_group_no_pop_data_keeps_den_dash(monkeypatch):
    """No populacao_cadastrada row → all denominators stay '—' (no regression)."""
    conn = _make_fake_conn_for_consolidate(pop_fetchone=None)

    result = consolidator.consolidate_group(
        conn,
        date(2026, 1, 1),
        "AMERICANA",
        "UBS TESTE",
        "EQUIPE 1",
        estabelecimento_id=99,
        equipe_id=100,
        pg_write=False,
    )

    indicadores = result["indicadores_qualidade"]
    assert all(e["den"] == "—" for e in indicadores)


# ---------------------------------------------------------------------------
# Integration tests (require PostgreSQL)
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_consolidate_group_with_cadastro_individual_sets_c1_den(pg_conn):
    """Full pipeline: import cadastro individual → consolidate → C1 den is numeric."""
    import parse_esus_csv as parser
    from pathlib import Path

    fixture = ROOT / "tests" / "fixtures" / "cadastro-individual" / "psf-jd-alvorada-202601.csv"
    assert fixture.exists(), f"Missing fixture: {fixture}"

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO estabelecimentos (codigo_externo, nome, perfil, status)
            VALUES ('CONS_TEST_01', 'PSF JD Alvorada Cons Test', 'APS', 'ativo')
            ON CONFLICT (codigo_externo) DO UPDATE SET nome = EXCLUDED.nome
            RETURNING id
            """
        )
        estab_id = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO equipes (codigo, nome, tipo, estabelecimento_id, status)
            VALUES ('TODAS-CONS01', 'TODAS', 'Outra', %s, 'ativo')
            ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome
            RETURNING id
            """,
            (estab_id,),
        )
        equipe_id = cur.fetchone()[0]
        cur.execute(
            """DELETE FROM esus_cargas
               WHERE tipo_relatorio = 'cadastro_individual'
                 AND unidade = 'PSF JD ALVORADA'
                 AND competencia = '2026-01-01'""",
        )
        cur.execute(
            "DELETE FROM dados_consolidados WHERE estabelecimento_id = %s",
            (estab_id,),
        )
    pg_conn.commit()

    # Import cadastro individual
    reports = parser.collect_reports(fixture)
    parser.write_to_pg(reports, estabelecimento_id=estab_id, equipe_id=equipe_id)
    pg_conn.commit()

    # Consolidate
    result = consolidator.consolidate_group(
        pg_conn,
        date(2026, 1, 1),
        "AMERICANA",
        "",
        "",
        estabelecimento_id=estab_id,
        equipe_id=equipe_id,
        pg_write=True,
    )
    pg_conn.commit()

    # Verify den in dados_consolidados
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT dados_conteudo #>> '{indicadores_qualidade,0,den}'
            FROM dados_consolidados
            WHERE estabelecimento_id = %s
            """,
            (estab_id,),
        )
        row = cur.fetchone()

    assert row is not None, "dados_consolidados row not found after consolidation"
    den_c1 = row[0]
    assert den_c1 != "—", f"C1 den should be numeric but got '—'"
    assert int(den_c1) == 3337

    # Cleanup: remove to avoid polluting seeded_pg fixture in other tests
    with pg_conn.cursor() as cur:
        cur.execute("DELETE FROM esus_cargas WHERE tipo_relatorio = 'cadastro_individual' AND estabelecimento_id = %s", (estab_id,))
        cur.execute("DELETE FROM dados_consolidados WHERE estabelecimento_id = %s", (estab_id,))
    pg_conn.commit()


@pytest.mark.integration
def test_consolidate_group_without_cadastro_individual_den_stays_dash(pg_conn):
    """No cadastro_individual → all den remain '—' (regression guard)."""
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO estabelecimentos (codigo_externo, nome, perfil, status)
            VALUES ('CONS_TEST_NO_CAD', 'Unidade Sem Cadastro', 'APS', 'ativo')
            ON CONFLICT (codigo_externo) DO UPDATE SET nome = EXCLUDED.nome
            RETURNING id
            """
        )
        estab_id = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO equipes (codigo, nome, tipo, estabelecimento_id, status)
            VALUES ('TODAS-NO-CAD', 'TODAS', 'Outra', %s, 'ativo')
            ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome
            RETURNING id
            """,
            (estab_id,),
        )
        equipe_id = cur.fetchone()[0]
        # No cadastro_individual import for this unit
    pg_conn.commit()

    result = consolidator.consolidate_group(
        pg_conn,
        date(2026, 1, 1),
        "AMERICANA",
        "",
        "",
        estabelecimento_id=estab_id,
        equipe_id=equipe_id,
        pg_write=False,
    )

    indicadores = result["indicadores_qualidade"]
    assert all(e["den"] == "—" for e in indicadores), \
        "Units without cadastro_individual must keep den='—'"
