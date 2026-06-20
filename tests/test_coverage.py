import json
import subprocess
import sys
from datetime import date
from pathlib import Path

import pytest

import consolidate_dashboard
import parse_esus_csv as parser
from etl_contract import build_payload

ROOT = Path(__file__).resolve().parents[1]


def test_build_sql_contains_core_tables():
    meta = {
        "tipo_relatorio": "atendimento_individual",
        "competencia": date(2026, 5, 1),
        "periodo_inicio": date(2026, 5, 1),
        "periodo_fim": date(2026, 5, 31),
        "municipio": "AMERICANA",
        "unidade": "U",
        "equipe_codigo": "1",
        "equipe_nome": "E",
        "profissional": "Todos",
        "cbo": "Todos",
        "filtros_personalizados": "Nenhum",
        "dados_processados_em": None,
        "relatorio_gerado_em": None,
        "relatorio_gerado_por": None,
        "registros_identificados": 1,
        "registros_nao_identificados": 0,
        "arquivo_origem": "x.csv",
    }
    sections = [("Turno", [("Manhã", 0, {"quantidade": 1})])]
    sql = parser.build_sql([(meta, sections)])

    assert "INSERT INTO esus_cargas" in sql
    assert "INSERT INTO esus_indicadores_raw" in sql
    assert "BEGIN;" in sql


def test_parse_value_variants():
    assert parser.parse_value("") is None
    assert parser.parse_value("10") == 10
    assert parser.parse_value("1.234,56") == 1234.56
    assert parser.parse_value("texto") == "texto"


def test_main_json_out_cli(sample_csv):
    proc = subprocess.run(
        [sys.executable, str(ROOT / "parse_esus_csv.py"), str(sample_csv), "--json-out"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload[0]["tipo_relatorio"] == "atendimento_individual"


def test_main_requires_output_mode(sample_csv):
    proc = subprocess.run(
        [sys.executable, str(ROOT / "parse_esus_csv.py"), str(sample_csv)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 1
    assert "--json-out" in proc.stderr or "--pg-write" in proc.stderr


def test_consolidate_group_json_mode(seeded_pg, sample_competencia, sample_unidade, sample_equipe):
    payload = consolidate_dashboard.consolidate_group(
        seeded_pg,
        sample_competencia,
        "AMERICANA",
        sample_unidade,
        sample_equipe,
        pg_write=False,
    )
    assert payload["versao_schema"] == "3.1.0"
    assert payload["kpis_gerais"]["total_atendimentos_aps"] == 540


def test_fetch_groups_and_sia_helpers(seeded_pg, sample_competencia, sample_unidade, sample_equipe):
    groups = consolidate_dashboard.fetch_groups(seeded_pg, competencia="2026-05")
    assert groups

    rows = consolidate_dashboard.fetch_raw_rows(
        seeded_pg, sample_competencia, sample_unidade, sample_equipe
    )
    assert rows

    sia_rows = consolidate_dashboard.fetch_sia_rows(
        seeded_pg, sample_competencia, sample_unidade
    )
    assert sia_rows == []

    assert consolidate_dashboard.sia_sync_exists(seeded_pg, sample_competencia) is False


def test_consolidate_cli_json_out(seeded_pg, pg_dsn, sample_unidade, sample_equipe):
    env = {
        **dict(__import__("os").environ),
        "PG_HOST": pg_dsn["host"],
        "PG_PORT": str(pg_dsn["port"]),
        "PG_DB": pg_dsn["dbname"],
        "PG_USER": pg_dsn["user"],
        "PG_PASS": pg_dsn["password"],
    }
    proc = subprocess.run(
        [
            sys.executable,
            str(ROOT / "consolidate_dashboard.py"),
            "--competencia",
            "2026-05",
            "--unidade",
            sample_unidade,
            "--equipe",
            sample_equipe,
            "--json-out",
        ],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload["competencia"] == "2026-05"


def test_consolidate_main_errors():
    proc = subprocess.run(
        [sys.executable, str(ROOT / "consolidate_dashboard.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 1


def test_write_payload_returns_metadata(seeded_pg, sample_competencia, sample_unidade, sample_equipe):
    payload = build_payload(
        competencia=sample_competencia,
        municipio="AMERICANA",
        unidade=sample_unidade,
        equipe=sample_equipe,
        raw_rows=consolidate_dashboard.fetch_raw_rows(
            seeded_pg, sample_competencia, sample_unidade, sample_equipe
        ),
    )
    meta = consolidate_dashboard.write_payload(
        seeded_pg,
        sample_competencia,
        "AMERICANA",
        sample_unidade,
        sample_equipe,
        payload,
    )
    assert meta["status"] == "ok"
    assert meta["id"] > 0


def test_fetch_groups_with_filters(seeded_pg, sample_unidade, sample_equipe):
    groups = consolidate_dashboard.fetch_groups(
        seeded_pg,
        competencia="2026-05",
        unidade=sample_unidade,
        equipe=sample_equipe,
    )
    assert len(groups) == 1


def test_consolidate_all_json_out(seeded_pg, pg_dsn):
    env = {
        **dict(__import__("os").environ),
        "PG_HOST": pg_dsn["host"],
        "PG_PORT": str(pg_dsn["port"]),
        "PG_DB": pg_dsn["dbname"],
        "PG_USER": pg_dsn["user"],
        "PG_PASS": pg_dsn["password"],
    }
    proc = subprocess.run(
        [
            sys.executable,
            str(ROOT / "consolidate_dashboard.py"),
            "--all",
            "--json-out",
        ],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload["versao_schema"] == "3.1.0"


def test_consolidate_all_conflicts_with_filters(pg_dsn):
    env = {
        **dict(__import__("os").environ),
        "PG_HOST": pg_dsn["host"],
        "PG_PORT": str(pg_dsn["port"]),
        "PG_DB": pg_dsn["dbname"],
        "PG_USER": pg_dsn["user"],
        "PG_PASS": pg_dsn["password"],
    }
    proc = subprocess.run(
        [
            sys.executable,
            str(ROOT / "consolidate_dashboard.py"),
            "--all",
            "--competencia",
            "2026-05",
            "--json-out",
        ],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 1
    assert "--all" in proc.stderr


def test_consolidate_missing_filters(pg_dsn):
    env = {
        **dict(__import__("os").environ),
        "PG_HOST": pg_dsn["host"],
        "PG_PORT": str(pg_dsn["port"]),
        "PG_DB": pg_dsn["dbname"],
        "PG_USER": pg_dsn["user"],
        "PG_PASS": pg_dsn["password"],
    }
    proc = subprocess.run(
        [
            sys.executable,
            str(ROOT / "consolidate_dashboard.py"),
            "--competencia",
            "2026-05",
            "--json-out",
        ],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 1


def test_sync_sia_json_out_cli():
    proc = subprocess.run(
        [
            sys.executable,
            str(ROOT / "sync_sia_mysql.py"),
            "--competencia",
            "2026-05",
            "--json-out",
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload[0]["status"] == "erro"


def test_consolidate_main_direct_json(
    monkeypatch, capsys, pg_dsn, seeded_pg, sample_unidade, sample_equipe
):
    monkeypatch.setenv("PG_HOST", pg_dsn["host"])
    monkeypatch.setenv("PG_PORT", str(pg_dsn["port"]))
    monkeypatch.setenv("PG_DB", pg_dsn["dbname"])
    monkeypatch.setenv("PG_USER", pg_dsn["user"])
    monkeypatch.setenv("PG_PASS", pg_dsn["password"])
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "consolidate_dashboard.py",
            "--competencia",
            "2026-05",
            "--unidade",
            sample_unidade,
            "--equipe",
            sample_equipe,
            "--json-out",
        ],
    )
    consolidate_dashboard.main()
    payload = json.loads(capsys.readouterr().out)
    assert payload["competencia"] == "2026-05"


def test_consolidate_main_direct_all_pg_write(monkeypatch, capsys, pg_dsn, seeded_pg):
    monkeypatch.setenv("PG_HOST", pg_dsn["host"])
    monkeypatch.setenv("PG_PORT", str(pg_dsn["port"]))
    monkeypatch.setenv("PG_DB", pg_dsn["dbname"])
    monkeypatch.setenv("PG_USER", pg_dsn["user"])
    monkeypatch.setenv("PG_PASS", pg_dsn["password"])
    monkeypatch.setattr(
        sys,
        "argv",
        ["consolidate_dashboard.py", "--all", "--pg-write"],
    )
    consolidate_dashboard.main()
    payload = json.loads(capsys.readouterr().out)
    assert payload[0]["status"] == "ok"


def test_consolidate_main_no_output_mode(monkeypatch):
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "consolidate_dashboard.py",
            "--competencia",
            "2026-05",
            "--unidade",
            "U",
            "--equipe",
            "E",
        ],
    )
    with pytest.raises(SystemExit) as exc:
        consolidate_dashboard.main()
    assert exc.value.code == 1


def test_parse_main_legacy_sql(tmp_path, sample_csv):
    out_sql = tmp_path / "out.sql"
    argv = sys.argv
    try:
        sys.argv = [
            "parse_esus_csv.py",
            str(sample_csv),
            str(out_sql),
        ]
        parser.main()
    finally:
        sys.argv = argv
    assert out_sql.exists()
    assert "INSERT INTO esus_cargas" in out_sql.read_text(encoding="utf-8")
