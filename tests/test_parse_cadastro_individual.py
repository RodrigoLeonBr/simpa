"""
Tests for parse_esus_csv.py — cadastro_individual type.
Fixtures: tests/fixtures/cadastro-individual/*.csv (real e-SUS PEC exports, Jan 2026)
"""
import json
from datetime import date
from pathlib import Path

import pytest

import parse_esus_csv as parser

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "cadastro-individual"
PSF_ALVORADA = FIXTURES / "psf-jd-alvorada-202601.csv"
PSF_BRASIL = FIXTURES / "psf-jd-brasil-202601.csv"
PA_TEBALDI = FIXTURES / "pa-luiza-tebaldi-202601.csv"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def alvorada():
    assert PSF_ALVORADA.exists(), f"Missing fixture: {PSF_ALVORADA}"
    return PSF_ALVORADA


@pytest.fixture
def brasil():
    assert PSF_BRASIL.exists(), f"Missing fixture: {PSF_BRASIL}"
    return PSF_BRASIL


@pytest.fixture
def tebaldi():
    assert PA_TEBALDI.exists(), f"Missing fixture: {PA_TEBALDI}"
    return PA_TEBALDI


# ---------------------------------------------------------------------------
# TIPO_RELATORIO_MAP
# ---------------------------------------------------------------------------

def test_tipo_relatorio_map_has_cadastro_individual():
    assert parser.TIPO_RELATORIO_MAP["Relatório de cadastro individual - Analítico"] == "cadastro_individual"


# ---------------------------------------------------------------------------
# parse_report: meta extraction
# ---------------------------------------------------------------------------

def test_parse_report_alvorada_tipo_relatorio(alvorada):
    meta, _ = parser.parse_report(alvorada)
    assert meta["tipo_relatorio"] == "cadastro_individual"


def test_parse_report_alvorada_competencia(alvorada):
    meta, _ = parser.parse_report(alvorada)
    # Data;31/01/2026 → competencia = 2026-01-01
    assert meta["competencia"] == date(2026, 1, 1)


def test_parse_report_alvorada_periodo(alvorada):
    meta, _ = parser.parse_report(alvorada)
    assert meta["periodo_inicio"] == date(2026, 1, 1)
    assert meta["periodo_fim"] == date(2026, 1, 31)


def test_parse_report_alvorada_cidadaos_ativos_in_meta(alvorada):
    meta, _ = parser.parse_report(alvorada)
    assert meta["cidadaos_ativos"] == 3337


def test_parse_report_alvorada_saidas_in_meta(alvorada):
    meta, _ = parser.parse_report(alvorada)
    assert meta["saidas_cadastro"] == 1198


def test_parse_report_alvorada_equipe_todas(alvorada):
    meta, _ = parser.parse_report(alvorada)
    assert meta["equipe_nome"] == "Todas"
    assert meta["equipe_codigo"] is None


def test_parse_report_alvorada_unidade(alvorada):
    meta, _ = parser.parse_report(alvorada)
    assert "ALVORADA" in meta["unidade"].upper()


def test_parse_report_brasil_cidadaos_ativos(brasil):
    meta, _ = parser.parse_report(brasil)
    assert meta["tipo_relatorio"] == "cadastro_individual"
    assert meta["cidadaos_ativos"] == 6834


def test_parse_report_tebaldi_cidadaos_ativos(tebaldi):
    meta, _ = parser.parse_report(tebaldi)
    assert meta["tipo_relatorio"] == "cadastro_individual"
    assert meta["cidadaos_ativos"] == 2


# ---------------------------------------------------------------------------
# _build_populacao_from_sections
# ---------------------------------------------------------------------------

def test_build_populacao_faixa_etaria_count(alvorada):
    _, sections = parser.parse_report(alvorada)
    pop = parser._build_populacao_from_sections(sections)
    assert len(pop["faixa_etaria"]) == 22  # 21 faixas etárias + "Não informado"


def test_build_populacao_faixa_etaria_first_item(alvorada):
    _, sections = parser.parse_report(alvorada)
    pop = parser._build_populacao_from_sections(sections)
    first = pop["faixa_etaria"][0]
    assert first["faixa"] == "Menos de 01 ano"
    assert first["masculino"] == 31
    assert first["feminino"] == 26


def test_build_populacao_condicoes_gestante(alvorada):
    _, sections = parser.parse_report(alvorada)
    pop = parser._build_populacao_from_sections(sections)
    assert pop["condicoes_saude"]["gestante"]["sim"] == 24


def test_build_populacao_condicoes_hipertensao(alvorada):
    _, sections = parser.parse_report(alvorada)
    pop = parser._build_populacao_from_sections(sections)
    assert pop["condicoes_saude"]["hipertensao"]["sim"] == 313


def test_build_populacao_condicoes_diabetes(alvorada):
    _, sections = parser.parse_report(alvorada)
    pop = parser._build_populacao_from_sections(sections)
    assert pop["condicoes_saude"]["diabetes"]["sim"] == 123


def test_build_populacao_cidadaos_ativos(alvorada):
    _, sections = parser.parse_report(alvorada)
    pop = parser._build_populacao_from_sections(sections)
    assert pop["cidadaos_ativos"] == 3337


def test_build_populacao_saidas(alvorada):
    _, sections = parser.parse_report(alvorada)
    pop = parser._build_populacao_from_sections(sections)
    assert pop["saidas"] == 1198


def test_build_populacao_raca_cor_branca(alvorada):
    _, sections = parser.parse_report(alvorada)
    pop = parser._build_populacao_from_sections(sections)
    assert pop["raca_cor"]["branca"] == 2570


def test_build_populacao_sexo(alvorada):
    _, sections = parser.parse_report(alvorada)
    pop = parser._build_populacao_from_sections(sections)
    assert pop["sexo_masculino"] == 1583
    assert pop["sexo_feminino"] == 1754


def test_build_populacao_missing_section_returns_defaults():
    """Empty sections list → defaults, no exception."""
    pop = parser._build_populacao_from_sections([])
    assert pop["cidadaos_ativos"] == 0
    assert pop["faixa_etaria"] == []
    assert pop["condicoes_saude"] == {}


def test_build_populacao_brasil_cidadaos_ativos(brasil):
    _, sections = parser.parse_report(brasil)
    pop = parser._build_populacao_from_sections(sections)
    assert pop["cidadaos_ativos"] == 6834


def test_build_populacao_tebaldi_cidadaos_ativos(tebaldi):
    _, sections = parser.parse_report(tebaldi)
    pop = parser._build_populacao_from_sections(sections)
    assert pop["cidadaos_ativos"] == 2


# ---------------------------------------------------------------------------
# write_to_pg branching: cadastro_individual skips esus_indicadores_raw
# ---------------------------------------------------------------------------

class _FakeCursor:
    def __init__(self):
        self.calls = []

    def execute(self, sql, params=None):
        self.calls.append((sql, params))

    def fetchone(self):
        return [42]

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


class _FakeConn:
    def __init__(self):
        self.cur = _FakeCursor()

    def cursor(self):
        return self.cur

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def test_write_to_pg_cadastro_skips_indicadores_raw(alvorada, monkeypatch):
    fake_conn = _FakeConn()

    monkeypatch.setenv("PG_HOST", "localhost")
    monkeypatch.setenv("PG_PORT", "5433")
    monkeypatch.setenv("PG_DB", "simpa")
    monkeypatch.setenv("PG_USER", "postgres")
    monkeypatch.setenv("PG_PASS", "postgres")

    import psycopg2
    monkeypatch.setattr(psycopg2, "connect", lambda *_a, **_k: fake_conn)

    reports = parser.collect_reports(alvorada)
    results = parser.write_to_pg(reports, estabelecimento_id=5, equipe_id=10)

    assert results[0]["tipo_relatorio"] == "cadastro_individual"
    assert results[0]["status"] == "ok"
    assert results[0]["cidadaos_ativos"] == 3337

    # esus_indicadores_raw deve estar ausente em todos os SQLs executados
    all_sqls = " ".join(sql for sql, _ in fake_conn.cur.calls)
    assert "esus_indicadores_raw" not in all_sqls
    assert "populacao_cadastrada" in all_sqls


def test_write_to_pg_cadastro_returns_cidadaos_ativos_in_result(brasil, monkeypatch):
    fake_conn = _FakeConn()

    monkeypatch.setenv("PG_HOST", "localhost")
    monkeypatch.setenv("PG_PORT", "5433")
    monkeypatch.setenv("PG_DB", "simpa")
    monkeypatch.setenv("PG_USER", "postgres")
    monkeypatch.setenv("PG_PASS", "postgres")

    import psycopg2
    monkeypatch.setattr(psycopg2, "connect", lambda *_a, **_k: fake_conn)

    reports = parser.collect_reports(brasil)
    results = parser.write_to_pg(reports, estabelecimento_id=6, equipe_id=11)

    assert results[0]["cidadaos_ativos"] == 6834


# ---------------------------------------------------------------------------
# Synthetic CSV: minimal cadastro_individual without sections
# ---------------------------------------------------------------------------

def _make_cadastro_csv(tmp_path, cidadaos=99, saidas=5, unidade="UBS TESTE"):
    content = (
        f"e-SUS - Atenção Primária\n"
        f"MINISTÉRIO DA SAÚDE\n"
        f"ESTADO DE SÃO PAULO\n"
        f"MUNICÍPIO DE AMERICANA\n"
        f"UNIDADE DE SAÚDE {unidade}\n"
        f"\n"
        f"Relatório de cadastro individual - Analítico\n"
        f"\n"
        f"FILTROS\n"
        f"Data;31/01/2026\n"
        f"Equipe;Todas\n"
        f"Profissional;Todos\n"
        f"CBO;Todos\n"
        f"Filtros personalizados;Nenhum\n"
        f"\n"
        f"\n"
        f"Dados gerais\n"
        f"Descrição;Quantidade;\n"
        f"Cidadãos ativos;{cidadaos};\n"
        f"Saída de cidadãos do cadastro;{saidas};\n"
        f"\n"
    ).encode("utf-8")
    path = tmp_path / "test_cadastro.csv"
    path.write_bytes(content)
    return path


def test_synthetic_cadastro_parses_tipo_relatorio(tmp_path):
    csv = _make_cadastro_csv(tmp_path)
    meta, _ = parser.parse_report(csv)
    assert meta["tipo_relatorio"] == "cadastro_individual"


def test_synthetic_cadastro_parses_competencia(tmp_path):
    csv = _make_cadastro_csv(tmp_path)
    meta, _ = parser.parse_report(csv)
    assert meta["competencia"] == date(2026, 1, 1)


def test_synthetic_cadastro_cidadaos_ativos_in_meta(tmp_path):
    csv = _make_cadastro_csv(tmp_path, cidadaos=150)
    meta, _ = parser.parse_report(csv)
    assert meta["cidadaos_ativos"] == 150


def test_synthetic_cadastro_missing_all_sections(tmp_path):
    """CSV with only dados_gerais → faixa_etaria=[], condicoes_saude={}."""
    csv = _make_cadastro_csv(tmp_path, cidadaos=10)
    _, sections = parser.parse_report(csv)
    pop = parser._build_populacao_from_sections(sections)
    assert pop["faixa_etaria"] == []
    assert pop["condicoes_saude"] == {}
    assert pop["cidadaos_ativos"] == 10


# ---------------------------------------------------------------------------
# Integration tests (require PostgreSQL)
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_write_to_pg_cadastro_inserts_populacao_cadastrada(pg_conn, alvorada):
    """Full pipeline: parse → write_to_pg → assert populacao_cadastrada row."""
    with pg_conn.cursor() as cur:
        # Ensure migration_012 is applied
        cur.execute("SELECT to_regclass('public.populacao_cadastrada')")
        assert cur.fetchone()[0] == "populacao_cadastrada", \
            "migration_012 not applied — run migration_012_populacao_cadastrada.sql first"

        # Create test estabelecimento + equipe
        cur.execute(
            """
            INSERT INTO estabelecimentos (codigo_externo, nome, perfil, status)
            VALUES ('CAD_TEST_01', 'PSF JD Alvorada Test', 'APS', 'ativo')
            ON CONFLICT (codigo_externo) DO UPDATE SET nome = EXCLUDED.nome
            RETURNING id
            """
        )
        estab_id = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO equipes (codigo, nome, tipo, estabelecimento_id, status)
            VALUES ('TODAS-CAD01', 'TODAS', 'Outra', %s, 'ativo')
            ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome
            RETURNING id
            """,
            (estab_id,),
        )
        equipe_id = cur.fetchone()[0]

        # Clean slate: remove any existing carga for this CSV (unidade+competencia unique)
        cur.execute(
            """DELETE FROM esus_cargas
               WHERE tipo_relatorio = 'cadastro_individual'
                 AND unidade = 'PSF JD ALVORADA'
                 AND competencia = '2026-01-01'""",
        )
    pg_conn.commit()

    reports = parser.collect_reports(alvorada)
    results = parser.write_to_pg(reports, estabelecimento_id=estab_id, equipe_id=equipe_id)
    pg_conn.commit()

    assert results[0]["tipo_relatorio"] == "cadastro_individual"
    assert results[0]["cidadaos_ativos"] == 3337
    carga_id = results[0]["carga_id"]

    with pg_conn.cursor() as cur:
        # esus_indicadores_raw must have no rows for this carga
        cur.execute("SELECT count(*) FROM esus_indicadores_raw WHERE carga_id = %s", (carga_id,))
        assert cur.fetchone()[0] == 0

        # populacao_cadastrada must have exactly one row
        cur.execute(
            "SELECT cidadaos_ativos, condicoes_saude->>'gestante' FROM populacao_cadastrada WHERE carga_id = %s",
            (carga_id,),
        )
        row = cur.fetchone()
        assert row is not None
        assert row[0] == 3337
        gestante_json = json.loads(row[1])
        assert gestante_json["sim"] == 24

    # Re-import: must UPSERT, not duplicate
    results2 = parser.write_to_pg(reports, estabelecimento_id=estab_id, equipe_id=equipe_id)
    pg_conn.commit()
    assert results2[0]["cidadaos_ativos"] == 3337

    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT count(*) FROM populacao_cadastrada WHERE estabelecimento_id = %s AND competencia = '2026-01-01'",
            (estab_id,),
        )
        assert cur.fetchone()[0] == 1  # still one row, not duplicated

    # Cleanup: remove cadastro_individual rows to avoid polluting seeded_pg fixture in other tests
    with pg_conn.cursor() as cur:
        cur.execute("DELETE FROM esus_cargas WHERE tipo_relatorio = 'cadastro_individual' AND estabelecimento_id = %s", (estab_id,))
    pg_conn.commit()


@pytest.mark.integration
def test_cascade_delete_removes_populacao_cadastrada(pg_conn, alvorada):
    """Deleting esus_cargas row must remove populacao_cadastrada via CASCADE."""
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO estabelecimentos (codigo_externo, nome, perfil, status)
            VALUES ('CAD_TEST_CASCADE', 'PSF Cascade Test', 'APS', 'ativo')
            ON CONFLICT (codigo_externo) DO UPDATE SET nome = EXCLUDED.nome
            RETURNING id
            """
        )
        estab_id = cur.fetchone()[0]
        cur.execute(
            """
            INSERT INTO equipes (codigo, nome, tipo, estabelecimento_id, status)
            VALUES ('TODAS-CASCADE', 'TODAS', 'Outra', %s, 'ativo')
            ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome
            RETURNING id
            """,
            (estab_id,),
        )
        equipe_id = cur.fetchone()[0]
        # Clean slate for cascade test (same CSV = same unidade string)
        cur.execute(
            """DELETE FROM esus_cargas
               WHERE tipo_relatorio = 'cadastro_individual'
                 AND unidade = 'PSF JD ALVORADA'
                 AND competencia = '2026-01-01'""",
        )
    pg_conn.commit()

    reports = parser.collect_reports(alvorada)
    results = parser.write_to_pg(reports, estabelecimento_id=estab_id, equipe_id=equipe_id)
    pg_conn.commit()
    carga_id = results[0]["carga_id"]

    with pg_conn.cursor() as cur:
        cur.execute("DELETE FROM esus_cargas WHERE id = %s", (carga_id,))
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM populacao_cadastrada WHERE carga_id = %s", (carga_id,))
        assert cur.fetchone()[0] == 0
