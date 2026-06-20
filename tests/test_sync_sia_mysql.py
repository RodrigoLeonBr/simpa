from datetime import date

import sync_sia_mysql


def test_build_sia_query_defaults_match_producao_schema():
    query, cfg = sync_sia_mysql.build_sia_query()

    assert cfg["table_prd"] == "s_prd"
    assert cfg["col_comp"] == "prd_cmp"
    assert cfg["col_prd_uid"] == "prd_uid"
    assert cfg["col_prest_pk"] == "re_cunid"
    assert cfg["col_proc"] == "prd_pa"
    assert cfg["col_qtd"] == "PRD_QT_A"
    assert cfg["col_unidade"] == "re_cnome"
    assert cfg["col_desc"] == "procedimento"
    assert cfg["col_sexo"] == ""

    assert "nome_fantasia" not in query
    assert "razao_social" not in query
    normalized = "".join(query.split())
    assert "prd.prd_uid=p.re_cunid" in normalized
    assert "prd.prd_pa=proc.codigo" in normalized
    assert "'I' AS sexo" in query
    assert "p.ativo = 1" in query


def test_build_sia_query_custom_sexo(monkeypatch):
    monkeypatch.setenv("SIA_COL_SEXO", "BPI_SEXO")

    query, cfg = sync_sia_mysql.build_sia_query()

    assert cfg["col_sexo"] == "BPI_SEXO"
    assert "prd.BPI_SEXO AS sexo" in query
    assert "'I' AS sexo" not in query


def test_extrair_sia_comp_format(monkeypatch):
    captured = {}

    def fake_read_sql(query, conn, params=None):
        captured["query"] = query
        captured["params"] = params
        import pandas as pd

        return pd.DataFrame()

    monkeypatch.setattr(sync_sia_mysql.pd, "read_sql", fake_read_sql)

    sync_sia_mysql.extrair_sia(conn_mysql=object(), competencia_date=date(2026, 5, 1))

    assert captured["params"] == {"comp": "202605"}
    assert "prd_cmp" in captured["query"]
