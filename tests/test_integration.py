import json
import subprocess
import sys
from pathlib import Path

import jsonschema
import pytest

import consolidate_dashboard
import sync_sia_mysql

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.integration
def test_parse_pg_write_round_trip(pg_conn, sample_csv):
    import parse_esus_csv as parser

    with pg_conn.cursor() as cur:
        cur.execute("TRUNCATE esus_indicadores_raw, esus_cargas RESTART IDENTITY CASCADE")
    pg_conn.commit()

    reports = parser.collect_reports(sample_csv)
    results = parser.write_to_pg(reports)
    pg_conn.commit()

    assert results[0]["status"] == "ok"
    assert results[0]["tipo_relatorio"] == "atendimento_individual"

    with pg_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM esus_indicadores_raw")
        assert cur.fetchone()[0] > 0


@pytest.mark.integration
def test_consolidate_pg_write_round_trip(
    seeded_pg,
    sample_competencia,
    sample_unidade,
    sample_equipe,
    contrato_schema,
):
    result = consolidate_dashboard.consolidate_group(
        seeded_pg,
        sample_competencia,
        "AMERICANA",
        sample_unidade,
        sample_equipe,
        pg_write=True,
    )

    assert result["status"] == "ok"
    jsonschema.validate(result["payload"], contrato_schema)

    with seeded_pg.cursor() as cur:
        cur.execute(
            """
            SELECT dados_conteudo->>'versao_schema', dados_conteudo->'kpis_gerais'
            FROM dados_consolidados
            WHERE competencia = %s AND unidade = %s AND equipe = %s
            """,
            (sample_competencia, sample_unidade, sample_equipe),
        )
        versao, kpis = cur.fetchone()
        assert versao == "3.1.0"
        assert kpis["total_atendimentos_aps"] == 540


@pytest.mark.integration
def test_consolidate_all_cli(seeded_pg, pg_dsn):
    env = {
        **dict(
            PG_HOST=pg_dsn["host"],
            PG_PORT=str(pg_dsn["port"]),
            PG_DB=pg_dsn["dbname"],
            PG_USER=pg_dsn["user"],
            PG_PASS=pg_dsn["password"],
        )
    }

    proc = subprocess.run(
        [sys.executable, str(ROOT / "consolidate_dashboard.py"), "--all", "--pg-write"],
        cwd=ROOT,
        env={**dict(**__import__("os").environ), **env},
        capture_output=True,
        text=True,
        check=False,
    )

    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert isinstance(payload, list)
    assert payload[0]["status"] == "ok"


def test_sync_without_mysql_returns_error(monkeypatch):
    monkeypatch.setattr(sync_sia_mysql, "mysql_configured", lambda: False)

    result = sync_sia_mysql.sincronizar("2026-05", pg_write=False)
    assert result["status"] == "erro"
    assert result["error"] == "MySQL_XAMPP_UNAVAILABLE"


def test_sync_transform_faixa_etaria():
    import pandas as pd

    df = pd.DataFrame(
        {
            "unidade": ["U1"],
            "codigo_sigtap": ["010101"],
            "descricao": ["CONSULTA"],
            "quantidade": [1],
            "valor_aprovado": [10.0],
            "idade": [45],
            "sexo": ["m"],
            "cbo": ["225125"],
        }
    )
    out = sync_sia_mysql.transformar(df)
    assert out.iloc[0]["faixa_etaria"] == "40-49"
    assert out.iloc[0]["sexo"] == "M"
