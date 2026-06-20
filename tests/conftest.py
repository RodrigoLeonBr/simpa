import json
import os
from datetime import date
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = Path(__file__).resolve().parent / "fixtures"
SAMPLE_CSV = ROOT / "Relatório de atendimento individual-20260613175047.csv"
SEED_SQL = ROOT / "seed_esus_2026-05.sql"


@pytest.fixture
def repo_root():
    return ROOT


@pytest.fixture
def sample_csv():
    assert SAMPLE_CSV.exists(), f"Missing sample CSV: {SAMPLE_CSV}"
    return SAMPLE_CSV


@pytest.fixture
def seed_sql():
    assert SEED_SQL.exists(), f"Missing seed SQL: {SEED_SQL}"
    return SEED_SQL


@pytest.fixture
def contrato_schema():
    return json.loads((FIXTURES / "contrato_v3_1_0.schema.json").read_text(encoding="utf-8"))


@pytest.fixture
def pg_dsn():
    host = os.environ.get("PG_HOST", "localhost")
    port = os.environ.get("PG_PORT", "5432")
    db = os.environ.get("PG_DB", "simpa")
    user = os.environ.get("PG_USER", "postgres")
    password = os.environ.get("PG_PASS", "change_me_in_production")
    return {
        "host": host,
        "port": port,
        "dbname": db,
        "user": user,
        "password": password,
    }


@pytest.fixture
def pg_conn(pg_dsn):
    import psycopg2

    try:
        conn = psycopg2.connect(**pg_dsn)
    except Exception as exc:
        pytest.skip(f"PostgreSQL unavailable: {exc}")
    try:
        yield conn
    finally:
        conn.close()


@pytest.fixture
def seeded_pg(pg_conn, seed_sql):
    with pg_conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM esus_cargas")
        if cur.fetchone()[0] == 0:
            pg_conn.commit()
            sql = seed_sql.read_text(encoding="utf-8")
            with pg_conn.cursor() as exec_cur:
                exec_cur.execute(sql)
            pg_conn.commit()
    yield pg_conn


@pytest.fixture
def sample_competencia():
    return date(2026, 5, 1)


@pytest.fixture
def sample_unidade():
    return "CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO"


@pytest.fixture
def sample_equipe():
    return "EQUIPE 9 EAP"
