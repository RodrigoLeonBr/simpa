import json
import sys
from pathlib import Path

import pytest

import parse_esus_csv as parser

ROOT = Path(__file__).resolve().parents[1]


def test_detects_report_type_and_competencia(sample_csv):
    meta, sections = parser.parse_report(sample_csv)

    assert meta["tipo_relatorio"] == "atendimento_individual"
    assert str(meta["competencia"]) == "2026-05-01"
    assert meta["unidade"] == "CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO"
    assert meta["equipe_nome"] == "EQUIPE 9 EAP"
    assert sections


def test_infers_registros_when_resumo_missing(tmp_path):
    content = (
        "e-SUS APS\n"
        "MINISTÉRIO DA SAÚDE\n"
        "ESTADO DE SÃO PAULO\n"
        "MUNICÍPIO DE AMERICANA\n"
        "UNIDADE DE SAÚDE CAFI\n"
        "\n"
        "Relatório de atendimento individual - Analítico\n"
        "\n"
        "FILTROS\n"
        "Período;01/01/2026 a 31/01/2026\n"
        "Equipe;Todas\n"
        "\n"
        "Turno\n"
        "Descrição;Quantidade;\n"
        "Manhã;554;\n"
        "Tarde;409;\n"
        "Noite;0;\n"
        "Não informado;0;\n"
    ).encode("utf-8")

    path = tmp_path / "sem-resumo.csv"
    path.write_bytes(content)

    meta, _ = parser.parse_report(path)
    assert meta["registros_identificados"] == 963
    assert meta["registros_nao_identificados"] == 0


def test_iso8859_encoding(tmp_path):
    content = (
        "e-SUS APS\n"
        "MINISTÉRIO DA SAÚDE\n"
        "ESTADO DE SÃO PAULO\n"
        "MUNICÍPIO DE AMERICANA\n"
        "UNIDADE DE SAÚDE CAFI\n"
        "\n"
        "Relatório de atendimento individual - Analítico\n"
        "\n"
        "FILTROS\n"
        "Período;01/05/2026 a 31/05/2026;\n"
        "Equipe;0001 - EQUIPE TESTE;\n"
        "\n"
        "Resumo de produção\n"
        "Descrição;Quantidade;\n"
        "Registros identificados;10;\n"
    ).encode("latin-1")

    path = tmp_path / "latin1.csv"
    path.write_bytes(content)

    meta, _ = parser.parse_report(path)
    assert meta["tipo_relatorio"] == "atendimento_individual"
    assert meta["equipe_nome"] == "EQUIPE TESTE"


def test_detects_atendimento_domiciliar_report_type(tmp_path):
    content = (
        "e-SUS APS\n"
        "MINISTÉRIO DA SAÚDE\n"
        "ESTADO DE SÃO PAULO\n"
        "MUNICÍPIO DE AMERICANA\n"
        "UNIDADE DE SAÚDE UBS TESTE\n"
        "\n"
        "Relatório de atendimento domiciliar - Analítico\n"
        "\n"
        "FILTROS\n"
        "Período;01/06/2026 a 30/06/2026\n"
        "Equipe;Todas\n"
        "\n"
        "Resumo de produção\n"
        "Descrição;Quantidade;\n"
        "Registros identificados;12;\n"
    ).encode("utf-8")

    path = tmp_path / "domiciliar.csv"
    path.write_bytes(content)

    meta, sections = parser.parse_report(path)
    assert meta["tipo_relatorio"] == "atendimento_domiciliar"
    assert meta["unidade"] == "UBS TESTE"
    assert meta["registros_identificados"] == 12
    assert sections


def test_json_out_interface(sample_csv):
    reports = parser.collect_reports(sample_csv)
    output = []
    for meta, sections in reports:
        entry = {
            key: str(value) if hasattr(value, "isoformat") else value
            for key, value in meta.items()
        }
        entry["sections_count"] = len(sections)
        entry["indicadores_count"] = sum(len(rows) for _, rows in sections)
        output.append(entry)

    assert isinstance(output, list)
    assert output[0]["tipo_relatorio"] == "atendimento_individual"
    assert str(output[0]["competencia"]).startswith("2026-05")
    assert json.dumps(output, ensure_ascii=False)


def test_main_json_out_unchanged_without_id_args(sample_csv, monkeypatch, capsys):
    monkeypatch.setattr(
        sys,
        "argv",
        ["parse_esus_csv.py", str(sample_csv), "--json-out"],
    )

    parser.main()
    output = json.loads(capsys.readouterr().out)

    assert output[0]["tipo_relatorio"] == "atendimento_individual"
    assert "estabelecimento_id" not in output[0]


def test_collect_reports_from_directory(repo_root):
    reports = parser.collect_reports(repo_root)
    tipos = {meta["tipo_relatorio"] for meta, _ in reports}
    assert "atendimento_individual" in tipos
    assert "atividade_coletiva" in tipos


def test_build_carga_params_includes_fk_when_ids_provided(sample_csv):
    meta, _ = parser.parse_report(sample_csv)
    params = parser.build_carga_params(meta, estabelecimento_id=42, equipe_id=7)

    assert params["estabelecimento_id"] == 42
    assert params["equipe_id"] == 7
    assert params["unidade"] == meta["unidade"]


def test_build_carga_params_omits_fk_without_ids(sample_csv):
    meta, _ = parser.parse_report(sample_csv)
    params = parser.build_carga_params(meta)

    assert "estabelecimento_id" not in params
    assert "equipe_id" not in params


def test_carga_insert_sql_uses_id_conflict_when_requested():
    sql = parser.carga_insert_sql(use_id_conflict=True)

    assert "estabelecimento_id" in sql
    assert "equipe_id" in sql
    assert "ON CONFLICT (tipo_relatorio, competencia, estabelecimento_id, equipe_id)" in sql
    assert "ON CONFLICT (tipo_relatorio, competencia, unidade, equipe_nome)" not in sql


def test_carga_insert_sql_uses_text_conflict_for_legacy():
    sql = parser.carga_insert_sql(use_id_conflict=False)

    assert "estabelecimento_id" not in sql
    assert "ON CONFLICT (tipo_relatorio, competencia, unidade, equipe_nome)" in sql


class _FakeCursor:
    def __init__(self, executed):
        self.executed = executed

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchone(self):
        return [99]

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


class _FakeConn:
    def __init__(self, executed):
        self.executed = executed
        self.committed = False

    def cursor(self):
        return _FakeCursor(self.executed)

    def commit(self):
        self.committed = True

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def close(self):
        pass


def test_write_to_pg_includes_fk_columns(sample_csv, monkeypatch):
    executed = []
    fake_conn = _FakeConn(executed)

    monkeypatch.setenv("PG_HOST", "localhost")
    monkeypatch.setenv("PG_PORT", "5433")
    monkeypatch.setenv("PG_DB", "simpa")
    monkeypatch.setenv("PG_USER", "postgres")
    monkeypatch.setenv("PG_PASS", "postgres")

    import psycopg2

    monkeypatch.setattr(psycopg2, "connect", lambda *_a, **_k: fake_conn)

    reports = parser.collect_reports(sample_csv)
    results = parser.write_to_pg(reports, estabelecimento_id=42, equipe_id=7)

    insert_sql, params = executed[0]
    assert "estabelecimento_id" in insert_sql
    assert params["estabelecimento_id"] == 42
    assert params["equipe_id"] == 7
    assert (
        "ON CONFLICT (tipo_relatorio, competencia, estabelecimento_id, equipe_id)"
        in insert_sql
    )
    assert results[0]["estabelecimento_id"] == 42
    assert results[0]["equipe_id"] == 7


def test_write_to_pg_legacy_text_conflict_without_ids(sample_csv, monkeypatch):
    executed = []
    fake_conn = _FakeConn(executed)

    monkeypatch.setenv("PG_HOST", "localhost")
    monkeypatch.setenv("PG_PORT", "5433")
    monkeypatch.setenv("PG_DB", "simpa")
    monkeypatch.setenv("PG_USER", "postgres")
    monkeypatch.setenv("PG_PASS", "postgres")

    import psycopg2

    monkeypatch.setattr(psycopg2, "connect", lambda *_a, **_k: fake_conn)

    reports = parser.collect_reports(sample_csv)
    parser.write_to_pg(reports)

    insert_sql, params = executed[0]
    assert "estabelecimento_id" not in params
    assert "ON CONFLICT (tipo_relatorio, competencia, unidade, equipe_nome)" in insert_sql


def test_pg_write_requires_estabelecimento_id(sample_csv, monkeypatch, capsys):
    monkeypatch.setattr(
        sys,
        "argv",
        ["parse_esus_csv.py", str(sample_csv), "--pg-write", "--equipe-id", "7"],
    )

    with pytest.raises(SystemExit) as exc:
        parser.main()

    assert exc.value.code == 1
    assert "--estabelecimento-id" in capsys.readouterr().err


def test_pg_write_requires_equipe_id(sample_csv, monkeypatch, capsys):
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "parse_esus_csv.py",
            str(sample_csv),
            "--pg-write",
            "--estabelecimento-id",
            "42",
        ],
    )

    with pytest.raises(SystemExit) as exc:
        parser.main()

    assert exc.value.code == 1
    assert "--equipe-id" in capsys.readouterr().err


def test_pg_write_main_forwards_ids_to_write_to_pg(sample_csv, monkeypatch, capsys):
    captured = {}

    def fake_write_to_pg(reports, estabelecimento_id=None, equipe_id=None):
        captured["reports"] = len(reports)
        captured["estabelecimento_id"] = estabelecimento_id
        captured["equipe_id"] = equipe_id
        return [{"status": "ok", "carga_id": 1}]

    monkeypatch.setattr(parser, "write_to_pg", fake_write_to_pg)
    monkeypatch.setattr(parser, "load_dotenv", lambda: None)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "parse_esus_csv.py",
            str(sample_csv),
            "--pg-write",
            "--estabelecimento-id",
            "42",
            "--equipe-id",
            "7",
        ],
    )

    parser.main()
    out = capsys.readouterr().out
    payload = json.loads(out)

    assert captured == {
        "reports": 1,
        "estabelecimento_id": 42,
        "equipe_id": 7,
    }
    assert payload[0]["status"] == "ok"


@pytest.mark.integration
def test_write_to_pg_persists_fk_columns(pg_conn, sample_csv):
    migration_004 = ROOT / "migration_004_cadastros_sync.sql"
    migration_006 = ROOT / "migration_006_import_depara.sql"

    with pg_conn.cursor() as cur:
        cur.execute(migration_004.read_text(encoding="utf-8"))
        cur.execute(migration_006.read_text(encoding="utf-8"))
        cur.execute(
            """
            INSERT INTO estabelecimentos (codigo_externo, nome, perfil, status)
            VALUES ('PARSER003', 'UBS Parser Test', 'APS', 'ativo')
            ON CONFLICT (codigo_externo) DO UPDATE SET nome = EXCLUDED.nome
            RETURNING id
            """
        )
        estabelecimento_id = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO equipes (codigo, nome, tipo, estabelecimento_id, status)
            VALUES ('PARSER003-INE', 'EQUIPE PARSER', 'Outra', %s, 'ativo')
            ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome
            RETURNING id
            """,
            (estabelecimento_id,),
        )
        equipe_id = cur.fetchone()[0]
        cur.execute("TRUNCATE esus_indicadores_raw, esus_cargas RESTART IDENTITY CASCADE")
    pg_conn.commit()

    reports = parser.collect_reports(sample_csv)
    results = parser.write_to_pg(
        reports,
        estabelecimento_id=estabelecimento_id,
        equipe_id=equipe_id,
    )
    pg_conn.commit()

    assert results[0]["estabelecimento_id"] == estabelecimento_id
    assert results[0]["equipe_id"] == equipe_id

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT estabelecimento_id, equipe_id
            FROM esus_cargas
            WHERE id = %s
            """,
            (results[0]["carga_id"],),
        )
        row = cur.fetchone()
        assert row == (estabelecimento_id, equipe_id)

    results2 = parser.write_to_pg(
        reports,
        estabelecimento_id=estabelecimento_id,
        equipe_id=equipe_id,
    )
    pg_conn.commit()
    assert results2[0]["carga_id"] == results[0]["carga_id"]
