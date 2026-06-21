import json
import sys
from datetime import date
from pathlib import Path

import jsonschema
import pytest

import consolidate_dashboard as consolidator
from etl_contract import build_payload

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_004 = ROOT / "migration_004_cadastros_sync.sql"
MIGRATION_006 = ROOT / "migration_006_import_depara.sql"


def _sample_raw_rows():
    return [
        {
            "tipo_relatorio": "atendimento_individual",
            "secao": "Resumo de produção",
            "descricao": "Registros identificados",
            "valores": {"quantidade": 540},
        },
        {
            "tipo_relatorio": "atendimento_individual",
            "secao": "Turno",
            "descricao": "Manhã",
            "valores": {"quantidade": 290},
        },
        {
            "tipo_relatorio": "atendimento_individual",
            "secao": "Turno",
            "descricao": "Tarde",
            "valores": {"quantidade": 249},
        },
        {
            "tipo_relatorio": "atendimento_odontologico",
            "secao": "Resumo de produção",
            "descricao": "Registros identificados",
            "valores": {"quantidade": 209},
        },
        {
            "tipo_relatorio": "atividade_coletiva",
            "secao": "Número de participantes",
            "descricao": "Total de participantes",
            "valores": {"quantidade": 810},
        },
        {
            "tipo_relatorio": "atividade_coletiva",
            "secao": "Temas para saúde",
            "descricao": "Alimentação saudável",
            "valores": {"quantidade": 37},
        },
        {
            "tipo_relatorio": "procedimentos_individualizados",
            "secao": "Resumo de produção",
            "descricao": "Registros identificados",
            "valores": {"quantidade": 1426},
        },
        {
            "tipo_relatorio": "procedimentos_individualizados",
            "secao": "Turno",
            "descricao": "Manhã",
            "valores": {"quantidade": 882},
        },
        {
            "tipo_relatorio": "procedimentos_individualizados",
            "secao": "Turno",
            "descricao": "Tarde",
            "valores": {"quantidade": 543},
        },
    ]


def test_build_payload_matches_schema(contrato_schema):
    payload = build_payload(
        competencia=date(2026, 5, 1),
        municipio="AMERICANA",
        unidade="CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO",
        equipe="EQUIPE 9 EAP",
        raw_rows=_sample_raw_rows(),
    )

    jsonschema.validate(payload, contrato_schema)
    assert payload["versao_schema"] == "3.1.0"
    assert payload["kpis_gerais"]["total_atendimentos_aps"] == 540
    assert payload["kpis_gerais"]["atendimentos_odonto"] == 209
    assert payload["kpis_gerais"]["total_participantes_coletivos"] == 810


def test_build_payload_uses_turno_when_resumo_missing():
    payload = build_payload(
        competencia=date(2026, 1, 1),
        municipio="AMERICANA",
        unidade="ESF 24 MARIO COVAS",
        equipe="Todas",
        raw_rows=[
            {
                "tipo_relatorio": "atendimento_individual",
                "secao": "Turno",
                "descricao": "Manhã",
                "valores": {"quantidade": 345},
            },
            {
                "tipo_relatorio": "atendimento_individual",
                "secao": "Turno",
                "descricao": "Tarde",
                "valores": {"quantidade": 247},
            },
        ],
    )

    assert payload["kpis_gerais"]["total_atendimentos_aps"] == 592


def test_null_indicator_values_remain_null():
    payload = build_payload(
        competencia=date(2026, 5, 1),
        municipio="AMERICANA",
        unidade="U",
        equipe="E",
        raw_rows=[],
    )

    for item in payload["indicadores_qualidade"]:
        assert item["exec"] is None
        assert item["meta"] is None

    for item in payload["modulos"]["financiamento_metas"]["componente_qualidade_aps"][
        "indicadores"
    ]:
        assert item["valor"] is None
        assert item["meta"] is None


def test_sia_merge_updates_ambulatorial_module():
    payload = build_payload(
        competencia=date(2026, 5, 1),
        municipio="AMERICANA",
        unidade="U",
        equipe="E",
        raw_rows=[],
        sia_rows=[
            {
                "codigo_sigtap": "0205020046",
                "descricao": "ULTRASSONOGRAFIA DE ABDOMEN TOTAL",
                "quantidade": 11,
            }
        ],
        mysql_available=True,
    )

    amb = payload["modulos"]["ambulatorial_sia"]
    assert amb["status_conexao"] == "MySQL_XAMPP_CONNECTED"
    assert amb["procedimentos_especializados"][0]["quantidade"] == 11
    assert payload["kpis_gerais"]["total_procedimentos_ambulatoriais"] == 11


def test_write_payload_sql_uses_id_conflict_when_requested():
    sql = consolidator.write_payload_sql(use_id_conflict=True)

    assert "estabelecimento_id" in sql
    assert "equipe_id" in sql
    assert (
        "ON CONFLICT (competencia, estabelecimento_id, equipe_id)"
        in sql
    )
    assert "ON CONFLICT (competencia, unidade, equipe)" not in sql


def test_write_payload_sql_uses_text_conflict_for_legacy():
    sql = consolidator.write_payload_sql(use_id_conflict=False)

    assert "estabelecimento_id" not in sql
    assert "ON CONFLICT (competencia, unidade, equipe)" in sql


class _FakeCursor:
    def __init__(self, executed):
        self.executed = executed

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchone(self):
        return [1, "2026-05-01 12:00:00"]

    def fetchall(self):
        return []

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class _FakeConn:
    def __init__(self, executed):
        self.executed = executed

    def cursor(self):
        return _FakeCursor(self.executed)

    def commit(self):
        pass


def test_write_payload_sets_fk_columns_on_insert():
    executed = []
    conn = _FakeConn(executed)
    payload = build_payload(
        competencia=date(2026, 5, 1),
        municipio="AMERICANA",
        unidade="UBS TESTE",
        equipe="EQUIPE 1",
        raw_rows=[],
    )

    meta = consolidator.write_payload(
        conn,
        date(2026, 5, 1),
        "AMERICANA",
        "UBS TESTE",
        "EQUIPE 1",
        payload,
        estabelecimento_id=42,
        equipe_id=7,
    )

    sql, params = executed[0]
    assert "estabelecimento_id" in sql
    assert params[-2:] == [42, 7]
    assert meta["estabelecimento_id"] == 42
    assert meta["equipe_id"] == 7


def test_fetch_raw_rows_id_path_uses_fk_filters():
    executed = []

    class Cursor(_FakeCursor):
        @property
        def description(self):
            return [
                ("tipo_relatorio",),
                ("municipio",),
                ("unidade",),
                ("equipe_nome",),
                ("secao",),
                ("descricao",),
                ("valores",),
            ]

    class Conn:
        def cursor(self):
            return Cursor(executed)

    consolidator.fetch_raw_rows(
        Conn(),
        date(2026, 5, 1),
        estabelecimento_id=42,
        equipe_id=7,
    )

    sql, params = executed[0]
    assert "c.estabelecimento_id = %s" in sql
    assert "c.equipe_id = %s" in sql
    assert "c.unidade = %s" not in sql
    assert "Todas" not in sql
    assert params == (date(2026, 5, 1), 42, 7)


def test_fetch_raw_rows_legacy_keeps_text_match_and_todas_fallback():
    executed = []

    class Cursor(_FakeCursor):
        @property
        def description(self):
            return [("tipo_relatorio",)]

    class Conn:
        def cursor(self):
            return Cursor(executed)

    consolidator.fetch_raw_rows(
        Conn(),
        date(2026, 5, 1),
        unidade="CAFI",
        equipe="EQUIPE 9 EAP",
    )

    sql, params = executed[0]
    assert "c.unidade = %s" in sql
    assert "Todas" in sql
    assert "estabelecimento_id" not in sql


def test_fetch_groups_includes_id_based_union():
    executed = []

    class Conn:
        def cursor(self):
            return _FakeCursor(executed)

    consolidator.fetch_groups(Conn())

    sql = executed[0][0]
    assert "estabelecimento_id IS NOT NULL" in sql
    assert "estabelecimento_id IS NULL" in sql
    assert "JOIN estabelecimentos" in sql


def test_fetch_cadastro_labels_returns_names():
    executed = []

    class Cursor(_FakeCursor):
        def fetchone(self):
            return ["UBS A", "EQUIPE 1"]

    class Conn:
        def cursor(self):
            return Cursor(executed)

    labels = consolidator.fetch_cadastro_labels(Conn(), 42, 7)

    assert labels == {"unidade": "UBS A", "equipe": "EQUIPE 1"}
    assert executed[0][1] == (7, 42)


def test_fetch_cadastro_labels_raises_when_missing():
    class Cursor(_FakeCursor):
        def fetchone(self):
            return None

    class Conn:
        def cursor(self):
            return Cursor([])

    with pytest.raises(ValueError, match="Cadastro não encontrado"):
        consolidator.fetch_cadastro_labels(Conn(), 99, 99)


def test_write_payload_legacy_omits_fk_metadata():
    executed = []
    conn = _FakeConn(executed)
    payload = build_payload(
        competencia=date(2026, 5, 1),
        municipio="AMERICANA",
        unidade="UBS",
        equipe="E1",
        raw_rows=[],
    )

    meta = consolidator.write_payload(
        conn,
        date(2026, 5, 1),
        "AMERICANA",
        "UBS",
        "E1",
        payload,
    )

    assert "estabelecimento_id" not in meta
    assert "ON CONFLICT (competencia, unidade, equipe)" in executed[0][0]


def test_sia_helpers_query_database():
    executed = []

    class Cursor(_FakeCursor):
        @property
        def description(self):
            return [("codigo_sigtap",)]

        def fetchone(self):
            return [1]

    class Conn:
        def cursor(self):
            return Cursor(executed)

    rows = consolidator.fetch_sia_rows(Conn(), date(2026, 5, 1), "UBS")
    assert rows == []
    assert "FROM sia_producao" in executed[0][0]

    assert consolidator.sia_sync_exists(Conn(), date(2026, 5, 1)) is True


def test_consolidate_group_id_path_uses_cadastro_labels(monkeypatch):
    monkeypatch.setattr(
        consolidator,
        "fetch_cadastro_labels",
        lambda *_a, **_k: {"unidade": "UBS ID", "equipe": "EQ ID"},
    )
    monkeypatch.setattr(consolidator, "fetch_raw_rows", lambda *_a, **_k: _sample_raw_rows())
    monkeypatch.setattr(consolidator, "fetch_sia_rows", lambda *_a, **_k: [])
    monkeypatch.setattr(consolidator, "sia_sync_exists", lambda *_a, **_k: False)

    payload = consolidator.consolidate_group(
        object(),
        date(2026, 5, 1),
        "AMERICANA",
        "ignored",
        "ignored",
        estabelecimento_id=42,
        equipe_id=7,
        pg_write=False,
    )

    assert payload["filtros_ativos"]["unidade"] == "UBS ID"
    assert payload["filtros_ativos"]["equipe"] == "EQ ID"


def test_consolidate_group_legacy_path_without_ids(monkeypatch):
    monkeypatch.setattr(
        consolidator,
        "fetch_raw_rows",
        lambda *_a, **kwargs: _sample_raw_rows()
        if kwargs.get("unidade")
        else [],
    )
    monkeypatch.setattr(consolidator, "fetch_sia_rows", lambda *_a, **_k: [])
    monkeypatch.setattr(consolidator, "sia_sync_exists", lambda *_a, **_k: False)

    payload = consolidator.consolidate_group(
        object(),
        date(2026, 5, 1),
        "AMERICANA",
        "CAFI",
        "EQUIPE 9 EAP",
        pg_write=False,
    )

    assert payload["filtros_ativos"]["unidade"] == "CAFI"


def test_fetch_groups_applies_optional_filters():
    executed = []

    class Conn:
        def cursor(self):
            return _FakeCursor(executed)

    consolidator.fetch_groups(
        Conn(), competencia="2026-05", unidade="UBS", equipe="E1"
    )

    sql, params = executed[0]
    assert params == [
        date(2026, 5, 1),
        "UBS",
        "E1",
        date(2026, 5, 1),
        "UBS",
        "E1",
    ]
    assert "est.nome = %s" in sql
    assert "c.unidade = %s" in sql


def test_main_id_cli_invokes_consolidate_group(sample_csv, monkeypatch, capsys):
    captured = {}

    def fake_consolidate_group(conn, comp, mun, uni, eq, **kwargs):
        captured.update(
            {
                "comp": comp,
                "uni": uni,
                "eq": eq,
                "estabelecimento_id": kwargs.get("estabelecimento_id"),
                "equipe_id": kwargs.get("equipe_id"),
                "pg_write": kwargs.get("pg_write"),
            }
        )
        return {"status": "ok", "competencia": "2026-05"}

    class FakeConn:
        def close(self):
            pass

    monkeypatch.setattr(consolidator, "pg_connect", lambda: FakeConn())
    monkeypatch.setattr(consolidator, "load_dotenv", lambda: None)
    monkeypatch.setattr(
        consolidator,
        "fetch_cadastro_labels",
        lambda *_a, **_k: {"unidade": "UBS ID", "equipe": "EQ ID"},
    )
    monkeypatch.setattr(consolidator, "consolidate_group", fake_consolidate_group)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "consolidate_dashboard.py",
            "--competencia",
            "2026-05",
            "--estabelecimento-id",
            "42",
            "--equipe-id",
            "7",
            "--json-out",
        ],
    )

    consolidator.main()
    out = json.loads(capsys.readouterr().out)

    assert captured["estabelecimento_id"] == 42
    assert captured["equipe_id"] == 7
    assert captured["pg_write"] is False
    assert out["status"] == "ok"


@pytest.mark.integration
def test_consolidate_by_ids_writes_fk_and_cadastro_names(pg_conn, sample_csv):
    import parse_esus_csv as parser

    with pg_conn.cursor() as cur:
        cur.execute(MIGRATION_004.read_text(encoding="utf-8"))
        cur.execute(MIGRATION_006.read_text(encoding="utf-8"))
        cur.execute(
            """
            INSERT INTO estabelecimentos (codigo_externo, nome, perfil, status)
            VALUES ('CONS004', 'UBS Consolidador ID', 'APS', 'ativo')
            ON CONFLICT (codigo_externo) DO UPDATE SET nome = EXCLUDED.nome
            RETURNING id
            """
        )
        estabelecimento_id = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO equipes (codigo, nome, tipo, estabelecimento_id, status)
            VALUES ('CONS004-INE', 'EQUIPE CONS', 'Outra', %s, 'ativo')
            ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome
            RETURNING id
            """,
            (estabelecimento_id,),
        )
        equipe_id = cur.fetchone()[0]
        cur.execute("TRUNCATE esus_indicadores_raw, esus_cargas, dados_consolidados RESTART IDENTITY CASCADE")
    pg_conn.commit()

    reports = parser.collect_reports(sample_csv)
    parser.write_to_pg(reports, estabelecimento_id=estabelecimento_id, equipe_id=equipe_id)
    pg_conn.commit()

    meta = consolidator.consolidate_group(
        pg_conn,
        date(2026, 5, 1),
        "AMERICANA",
        "placeholder",
        "placeholder",
        estabelecimento_id=estabelecimento_id,
        equipe_id=equipe_id,
        pg_write=True,
    )

    assert meta["estabelecimento_id"] == estabelecimento_id
    assert meta["equipe_id"] == equipe_id
    assert meta["unidade"] == "UBS Consolidador ID"
    assert meta["equipe"] == "EQUIPE CONS"

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT estabelecimento_id, equipe_id, unidade, equipe
            FROM dados_consolidados
            WHERE id = %s
            """,
            (meta["id"],),
        )
        row = cur.fetchone()
        assert row == (
            estabelecimento_id,
            equipe_id,
            "UBS Consolidador ID",
            "EQUIPE CONS",
        )
