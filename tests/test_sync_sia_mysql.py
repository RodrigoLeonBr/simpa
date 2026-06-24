from datetime import date
import json
from unittest.mock import MagicMock

import pandas as pd

import sync_sia_mysql


EXCLUDED_COLUMNS = (
    "prd_flh",
    "prd_seq",
    "PRD_ORG",
    "PRD_FLPA",
    "PRD_FLER",
    "PRD_APANUM",
    "PRD_CNSMED",
    "PRD_CNPJ",
    "PRD_NFIS",
    "PRD_CIDSEC",
    "PRD_CIDCAS",
)


def test_build_sia_query_defaults_match_producao_schema():
    query, cfg = sync_sia_mysql.build_sia_query()
    normalized = "".join(query.split())

    assert cfg["table_prd"] == "s_prd"
    assert cfg["table_rub"] == "s_rub"
    assert cfg["table_cbo"] == "cbo"
    assert cfg["col_comp"] == "prd_cmp"
    assert cfg["col_prd_uid"] == "prd_uid"
    assert cfg["col_proc"] == "prd_pa"
    assert cfg["col_qtd_aprovada"] == "PRD_QT_A"
    assert cfg["col_qtd_apresentada"] == "PRD_QT_P"
    assert cfg["col_valor_aprovado"] == "PRD_VL_A"
    assert cfg["col_valor_apresentado"] == "PRD_VL_P"
    assert cfg["col_rubrica"] == "PRD_RUB"
    assert cfg["join_charset"] == "utf8mb4"

    assert "prd.prd_uidAScnes" in normalized
    assert "LEFT(prd.PRD_RUB,4)ASrubrica_codigo" in normalized
    assert "sr.RUB_DCASrubrica_descricao" in normalized
    assert "SUM(CAST(prd.PRD_QT_AASUNSIGNED))ASquantidade" in normalized
    assert "SUM(CAST(prd.PRD_QT_PASUNSIGNED))ASquantidade_apresentada" in normalized
    assert "SUM(CAST(prd.PRD_VL_AASDECIMAL(15,2)))ASvalor_aprovado" in normalized
    assert "SUM(CAST(prd.PRD_VL_PASDECIMAL(15,2)))ASvalor_apresentado" in normalized
    assert "WHEREprd.prd_cmp=%(comp)s" in normalized
    assert "GROUPBY" in normalized
    assert "sr.RUB_DC" in query
    assert "LEFT JOIN cbo cb" in query
    assert "LEFT JOIN s_rub sr" in query
    assert "CONVERT(prd.prd_uid USING utf8mb4) COLLATE utf8mb4_general_ci" in query
    assert "'I' AS sexo" in query


def test_build_sia_query_excludes_admin_columns():
    query, _ = sync_sia_mysql.build_sia_query()
    for col in EXCLUDED_COLUMNS:
        assert col not in query


def test_build_sia_query_custom_sexo_and_overrides(monkeypatch):
    monkeypatch.setenv("SIA_COL_SEXO", "BPI_SEXO")
    monkeypatch.setenv("SIA_JOIN_CHARSET", "latin1")
    monkeypatch.setenv("SIA_JOIN_COLLATION", "utf8mb4_unicode_ci")
    monkeypatch.setenv("SIA_COL_RUBRICA_DESC", "DESC_RUB")

    query, cfg = sync_sia_mysql.build_sia_query()

    assert cfg["col_sexo"] == "BPI_SEXO"
    assert cfg["join_charset"] == "latin1"
    assert cfg["join_collation"] == "utf8mb4_unicode_ci"
    assert cfg["col_rub_desc"] == "DESC_RUB"
    assert "prd.BPI_SEXO AS sexo" in query
    assert "'I' AS sexo" not in query
    assert "CONVERT(prd.prd_uid USING latin1) COLLATE utf8mb4_unicode_ci" in query
    assert "sr.DESC_RUB AS rubrica_descricao" in query


def test_build_sia_query_paginated_adds_limit_offset():
    query, _ = sync_sia_mysql.build_sia_query(paginated=True)
    assert "LIMIT %(limit)s OFFSET %(offset)s" in query
    assert "ORDER BY" in query


def test_extrair_sia_comp_format(monkeypatch):
    captured = {}

    def fake_read_sql(query, conn, params=None):
        captured["query"] = query
        captured["params"] = params
        return pd.DataFrame()

    monkeypatch.setattr(sync_sia_mysql.pd, "read_sql", fake_read_sql)

    sync_sia_mysql.extrair_sia(conn_mysql=object(), competencia_date=date(2026, 5, 1))

    assert captured["params"] == {"comp": "202605"}
    assert "prd_cmp" in captured["query"]


def test_extrair_sia_em_blocos_paginated(monkeypatch):
    calls = {"n": 0}

    def fake_read_sql(query, conn, params=None):
        calls["n"] += 1
        if calls["n"] == 1:
            assert params == {"comp": "202605", "limit": 2, "offset": 0}
            assert "LIMIT %(limit)s OFFSET %(offset)s" in query
            return pd.DataFrame([{"quantidade": 1}, {"quantidade": 2}])
        if calls["n"] == 2:
            assert params == {"comp": "202605", "limit": 2, "offset": 2}
            return pd.DataFrame([{"quantidade": 3}])
        return pd.DataFrame()

    monkeypatch.setattr(sync_sia_mysql.pd, "read_sql", fake_read_sql)

    blocos = list(
        sync_sia_mysql.extrair_sia_em_blocos(
            conn_mysql=object(),
            competencia_date=date(2026, 5, 1),
            block_size=2,
        )
    )

    assert len(blocos) == 2
    assert len(blocos[0]) == 2
    assert len(blocos[1]) == 1


def test_transformar_normaliza_faixa_sexo_e_metricas():
    raw = pd.DataFrame(
        [
            {
                "cnes": "1234567",
                "unidade": "UNIDADE A",
                "codigo_sigtap": "0301010010",
                "descricao": "CONSULTA",
                "cbo": "223505",
                "rubrica_codigo": "0602",
                "rubrica_descricao": "MAC",
                "idade": 151,
                "quantidade": "10",
                "quantidade_apresentada": "12",
                "valor_aprovado": "100.50",
                "valor_apresentado": "120.90",
                "sexo": "x",
            }
        ]
    )

    out = sync_sia_mysql.transformar(raw)

    assert pd.isna(out.loc[0, "idade"])
    assert out.loc[0, "faixa_etaria"] == "Ignorado"
    assert out.loc[0, "sexo"] == "I"
    assert out.loc[0, "quantidade"] == 10
    assert out.loc[0, "quantidade_apresentada"] == 12
    assert float(out.loc[0, "valor_aprovado"]) == 100.50
    assert float(out.loc[0, "valor_apresentado"]) == 120.90


def test_transformar_preserva_grupo_idade_quando_valido():
    raw = pd.DataFrame(
        [
            {
                "idade": 34,
                "sexo": "f",
                "cbo": "223505",
                "quantidade": 1,
                "quantidade_apresentada": 1,
                "valor_aprovado": 1.0,
                "valor_apresentado": 1.0,
            }
        ]
    )

    out = sync_sia_mysql.transformar(raw)

    assert out.loc[0, "idade"] == 34
    assert out.loc[0, "faixa_etaria"] == "34"
    assert out.loc[0, "sexo"] == "F"


def test_consolidar_para_carga_mergeia_chave_unica_da_sia():
    raw = pd.DataFrame(
        [
            {
                "cnes": "0751073",
                "unidade": "UNIDADE A",
                "codigo_sigtap": "0211060127",
                "descricao": "PROC A",
                "cbo": "225265",
                "rubrica_codigo": "06",
                "rubrica_descricao": "RUB A",
                "idade": 60,
                "quantidade": 1,
                "quantidade_apresentada": 1,
                "valor_aprovado": 10.0,
                "valor_apresentado": 10.0,
                "sexo": "I",
            },
            {
                "cnes": "0751073",
                "unidade": "UNIDADE A",
                "codigo_sigtap": "0211060127",
                "descricao": "PROC A",
                "cbo": "225265",
                "rubrica_codigo": "06",
                "rubrica_descricao": "RUB A",
                "idade": 60,
                "quantidade": 2,
                "quantidade_apresentada": 2,
                "valor_aprovado": 20.0,
                "valor_apresentado": 20.0,
                "sexo": "I",
            },
        ]
    )
    transformed = sync_sia_mysql.transformar(raw)
    merged = sync_sia_mysql.consolidar_para_carga(transformed)

    assert len(merged) == 1
    assert merged.loc[0, "faixa_etaria"] == "60"
    assert merged.loc[0, "quantidade"] == 3
    assert merged.loc[0, "quantidade_apresentada"] == 3
    assert float(merged.loc[0, "valor_aprovado"]) == 30.0
    assert float(merged.loc[0, "valor_apresentado"]) == 30.0


def test_check_competencia_importada_retorna_metadata():
    conn = MagicMock()
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    conn.cursor.return_value.__exit__.return_value = False
    cur.fetchone.return_value = ("ok", 42, "2026-06-22T00:00:00")

    result = sync_sia_mysql.check_competencia_importada(conn, "2026-05")

    assert result["exists"] is True
    assert result["status"] == "ok"
    assert result["registros"] == 42
    assert result["sincronizado_em"] == "2026-06-22T00:00:00"


def test_gravar_pg_batch_resolve_estabelecimento_and_orphan(monkeypatch):
    df = pd.DataFrame(
        [
            {
                "cnes": "1234567",
                "unidade": "UNIDADE A",
                "codigo_sigtap": "0301010010",
                "descricao": "CONSULTA A",
                "quantidade": 10,
                "quantidade_apresentada": 12,
                "valor_aprovado": 100.0,
                "valor_apresentado": 120.0,
                "faixa_etaria": "30-39",
                "sexo": "F",
                "cbo": "223505",
                "rubrica_codigo": "0602",
                "rubrica_descricao": "MAC",
            },
            {
                "cnes": "9999999",
                "unidade": "UNIDADE B",
                "codigo_sigtap": "0301010020",
                "descricao": "CONSULTA B",
                "quantidade": 5,
                "quantidade_apresentada": 6,
                "valor_aprovado": 60.0,
                "valor_apresentado": 70.0,
                "faixa_etaria": "40-49",
                "sexo": "M",
                "cbo": "223510",
                "rubrica_codigo": "0603",
                "rubrica_descricao": "FAEC",
            },
        ]
    )

    conn = MagicMock()
    conn.__enter__.return_value = conn
    conn.__exit__.return_value = False
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    conn.cursor.return_value.__exit__.return_value = False
    cur.fetchone.return_value = (777,)
    cur.fetchall.return_value = [("1234567", 42)]

    batch_calls = []

    def fake_execute_batch(mock_cur, sql, payload):
        batch_calls.append((mock_cur, sql, payload))

    monkeypatch.setattr(sync_sia_mysql, "execute_batch", fake_execute_batch)

    result = sync_sia_mysql.gravar_pg(
        conn,
        df,
        date(2026, 5, 1),
        reimportar=True,
        linhas_mysql_raw=10,
        batch_size=1,
    )

    assert result["status"] == "ok"
    assert result["registros"] == 2
    assert result["orphan_cnes"] == 1
    assert result["estabelecimentos_resolvidos"] == 1
    assert result["linhas_mysql_raw"] == 10

    assert len(batch_calls) == 2
    first_chunk = batch_calls[0][2][0]
    assert first_chunk[3] == "1234567"  # cnes
    assert first_chunk[4] == 42  # estabelecimento_id
    assert first_chunk[8] == 12  # quantidade_apresentada
    assert float(first_chunk[10]) == 120.0  # valor_apresentado
    assert first_chunk[14] == "0602"  # rubrica relacional
    assert json.loads(first_chunk[15])["rubrica_codigo"] == "0602"

    delete_calls = [
        call
        for call in cur.execute.call_args_list
        if "DELETE FROM sia_producao WHERE competencia = %s" in call.args[0]
    ]
    assert len(delete_calls) == 1


def test_gravar_pg_empty_df_returns_parcial(monkeypatch):
    df = pd.DataFrame()
    conn = MagicMock()
    conn.__enter__.return_value = conn
    conn.__exit__.return_value = False
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    conn.cursor.return_value.__exit__.return_value = False
    cur.fetchone.return_value = (901,)
    cur.fetchall.return_value = []

    called = {"batch": 0}

    def fake_execute_batch(*_args, **_kwargs):
        called["batch"] += 1

    monkeypatch.setattr(sync_sia_mysql, "execute_batch", fake_execute_batch)

    result = sync_sia_mysql.gravar_pg(
        conn,
        df,
        date(2026, 5, 1),
        reimportar=False,
        linhas_mysql_raw=0,
    )

    assert result["status"] == "parcial"
    assert result["registros"] == 0
    assert result["orphan_cnes"] == 0
    assert result["estabelecimentos_resolvidos"] == 0
    assert called["batch"] == 0


def test_gravar_pg_continua_apos_falha_de_chunk(monkeypatch):
    df = pd.DataFrame(
        [
            {
                "cnes": "1234567",
                "unidade": "UNIDADE A",
                "codigo_sigtap": "0301010010",
                "descricao": "CONSULTA A",
                "quantidade": 10,
                "quantidade_apresentada": 10,
                "valor_aprovado": 100.0,
                "valor_apresentado": 100.0,
                "faixa_etaria": "30-39",
                "sexo": "F",
                "cbo": "223505",
            },
            {
                "cnes": "7654321",
                "unidade": "UNIDADE B",
                "codigo_sigtap": "0301010020",
                "descricao": "CONSULTA B",
                "quantidade": 5,
                "quantidade_apresentada": 5,
                "valor_aprovado": 50.0,
                "valor_apresentado": 50.0,
                "faixa_etaria": "40-49",
                "sexo": "M",
                "cbo": "223510",
            },
        ]
    )

    conn = MagicMock()
    conn.__enter__.return_value = conn
    conn.__exit__.return_value = False
    cur = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    conn.cursor.return_value.__exit__.return_value = False
    cur.fetchone.return_value = (1001,)
    cur.fetchall.return_value = [("1234567", 42), ("7654321", 43)]

    calls = {"n": 0}

    def fake_execute_batch(_cur, _sql, _payload):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("violacao unique")

    monkeypatch.setattr(sync_sia_mysql, "execute_batch", fake_execute_batch)

    result = sync_sia_mysql.gravar_pg(
        conn,
        df,
        date(2026, 5, 1),
        reimportar=False,
        linhas_mysql_raw=2,
        batch_size=1,
    )

    assert result["status"] == "parcial"
    assert result["registros"] == 2
    assert result["erros"] == 1
    assert calls["n"] == 2

    executed_sqls = [call.args[0] for call in cur.execute.call_args_list if call.args]
    assert any(sql == "SAVEPOINT sia_batch_0" for sql in executed_sqls)
    assert any(sql == "ROLLBACK TO SAVEPOINT sia_batch_0" for sql in executed_sqls)
    assert any(sql == "SAVEPOINT sia_batch_1" for sql in executed_sqls)


def test_sincronizar_pg_write_passes_reimportar_and_raw_count(monkeypatch):
    monkeypatch.setattr(sync_sia_mysql, "mysql_configured", lambda: True)
    monkeypatch.setattr(sync_sia_mysql, "mysql_connect", lambda: MagicMock(close=lambda: None))
    monkeypatch.setattr(
        sync_sia_mysql,
        "extrair_sia_em_blocos",
        lambda *_args, **_kwargs: iter([pd.DataFrame([{"quantidade": 1, "valor_aprovado": 1.0}])]),
    )
    monkeypatch.setattr(sync_sia_mysql, "transformar", lambda df: df)
    monkeypatch.setattr(sync_sia_mysql, "consolidar_para_carga", lambda df: df)

    conn_pg = MagicMock()
    monkeypatch.setattr(sync_sia_mysql, "pg_connect", lambda: conn_pg)
    captured = {}

    def fake_gravar_pg(conn, df, competencia_date, **kwargs):
        captured["conn"] = conn
        captured["df_len"] = len(df)
        captured["competencia_date"] = competencia_date
        captured["kwargs"] = kwargs
        return {"status": "ok", "registros": len(df)}

    monkeypatch.setattr(sync_sia_mysql, "gravar_pg", fake_gravar_pg)

    result = sync_sia_mysql.sincronizar("2026-05", pg_write=True, reimportar=True)

    assert result["status"] == "ok"
    assert captured["conn"] is conn_pg
    assert captured["df_len"] == 1
    assert captured["kwargs"]["reimportar"] is True
    assert captured["kwargs"]["linhas_mysql_raw"] == 1
