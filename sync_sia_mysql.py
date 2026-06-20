#!/usr/bin/env python3
"""
SIMPA - Conector SIA/SUS: MySQL/XAMPP -> PostgreSQL
====================================================

Lê produção ambulatorial do MySQL/XAMPP (somente leitura) conforme ADR-003
(tabelas s_prd, prestador, procedimento) e grava em sia_producao.

Uso:
    python sync_sia_mysql.py --competencia 2026-05 --json-out
    python sync_sia_mysql.py --competencia 2026-05 --pg-write
    python sync_sia_mysql.py --meses 6 --pg-write
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date

import pandas as pd
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv

from etl_db import mysql_configured, mysql_connect, pg_connect

FAIXA_ETARIA_BINS = [0, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 200]
FAIXA_ETARIA_LABELS = [
    "0-4",
    "5-9",
    "10-14",
    "15-19",
    "20-29",
    "30-39",
    "40-49",
    "50-59",
    "60-69",
    "70-79",
    "80+",
]


def competencia_para_date(competencia: str) -> date:
    ano, mes = competencia.split("-")
    return date(int(ano), int(mes), 1)


def calcular_faixa_etaria(idade):
    if pd.isna(idade):
        return None
    for i, limite in enumerate(FAIXA_ETARIA_BINS[1:]):
        if int(idade) < limite:
            return FAIXA_ETARIA_LABELS[i]
    return "80+"


def _sia_env(name: str, default: str) -> str:
    return os.environ.get(name, default)


def build_sia_query() -> tuple[str, dict[str, str]]:
    """
    Monta SQL de extração conforme schema DATASUS do banco producao/XAMPP.

    Defaults: s_prd + prestador + procedimento (dump producao MariaDB).
    Override via SIA_TABLE_* / SIA_COL_* no .env.
    """
    cfg = {
        "table_prd": _sia_env("SIA_TABLE_PRD", "s_prd"),
        "table_prest": _sia_env("SIA_TABLE_PRESTADOR", "prestador"),
        "table_proc": _sia_env("SIA_TABLE_PROCEDIMENTO", "procedimento"),
        "col_comp": _sia_env("SIA_COL_COMPETENCIA", "prd_cmp"),
        "col_prd_uid": _sia_env("SIA_COL_PRD_UID", "prd_uid"),
        "col_prest_pk": _sia_env("SIA_COL_PRESTADOR_PK", "re_cunid"),
        "col_proc": _sia_env("SIA_COL_COD_PROC", "prd_pa"),
        "col_proc_pk": _sia_env("SIA_COL_PROC_PK", "codigo"),
        "col_qtd": _sia_env("SIA_COL_QTD", "PRD_QT_A"),
        "col_valor": _sia_env("SIA_COL_VALOR", "PRD_VL_A"),
        "col_idade": _sia_env("SIA_COL_IDADE", "PRD_IDADE"),
        "col_cbo": _sia_env("SIA_COL_CBO", "prd_cbo"),
        "col_unidade": _sia_env("SIA_COL_UNIDADE", "re_cnome"),
        "col_desc": _sia_env("SIA_COL_DESC_PROC", "procedimento"),
        "col_sexo": _sia_env("SIA_COL_SEXO", ""),
        "col_prest_ativo": _sia_env("SIA_COL_PRESTADOR_ATIVO", "ativo"),
    }

    sexo_expr = (
        f"prd.{cfg['col_sexo']} AS sexo"
        if cfg["col_sexo"]
        else "'I' AS sexo"
    )
    sexo_group = f", prd.{cfg['col_sexo']}" if cfg["col_sexo"] else ""
    ativo_filter = ""
    if cfg["col_prest_ativo"]:
        ativo_filter = f" AND (p.{cfg['col_prest_ativo']} = 1 OR p.{cfg['col_prest_ativo']} IS NULL)"

    query = f"""
        SELECT
            p.{cfg['col_unidade']} AS unidade,
            prd.{cfg['col_proc']} AS codigo_sigtap,
            proc.{cfg['col_desc']} AS descricao,
            SUM(prd.{cfg['col_qtd']}) AS quantidade,
            SUM(prd.{cfg['col_valor']}) AS valor_aprovado,
            prd.{cfg['col_idade']} AS idade,
            {sexo_expr},
            prd.{cfg['col_cbo']} AS cbo
        FROM {cfg['table_prd']} prd
        LEFT JOIN {cfg['table_prest']} p
            ON prd.{cfg['col_prd_uid']} = p.{cfg['col_prest_pk']}
        LEFT JOIN {cfg['table_proc']} proc
            ON prd.{cfg['col_proc']} = proc.{cfg['col_proc_pk']}
        WHERE prd.{cfg['col_comp']} = %(comp)s{ativo_filter}
        GROUP BY
            p.{cfg['col_unidade']},
            prd.{cfg['col_proc']},
            proc.{cfg['col_desc']},
            prd.{cfg['col_idade']}{sexo_group},
            prd.{cfg['col_cbo']}
    """
    return query, cfg


def extrair_sia(conn_mysql, competencia_date: date) -> pd.DataFrame:
    """Extrai produção SIA do MySQL para a competência informada (prd_cmp = YYYYMM)."""
    query, _ = build_sia_query()
    comp = competencia_date.strftime("%Y%m")
    return pd.read_sql(query, conn_mysql, params={"comp": comp})


def transformar(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df.copy()

    out = df.copy()
    out["faixa_etaria"] = out["idade"].apply(calcular_faixa_etaria)
    out["sexo"] = (
        out["sexo"]
        .astype(str)
        .str.upper()
        .str.strip()
        .where(out["sexo"].astype(str).str.upper().str.strip().isin(["M", "F"]), other="I")
    )
    out["cbo"] = out["cbo"].astype(str).str.strip().replace({"nan": None, "None": None})
    out["quantidade"] = pd.to_numeric(out["quantidade"], errors="coerce").fillna(0).astype(int)
    out["valor_aprovado"] = pd.to_numeric(out["valor_aprovado"], errors="coerce")
    return out


def gravar_pg(conn_pg, df: pd.DataFrame, competencia_date: date) -> dict:
    with conn_pg:
        with conn_pg.cursor() as cur:
            cur.execute(
                """
                INSERT INTO sia_sincronizacoes (competencia, status, registros)
                VALUES (%s, 'pendente', %s)
                ON CONFLICT (competencia) DO UPDATE SET
                    status = 'pendente',
                    registros = EXCLUDED.registros,
                    sincronizado_em = now()
                RETURNING id
                """,
                (competencia_date, len(df)),
            )
            sinc_id = cur.fetchone()[0]

            cur.execute(
                "DELETE FROM sia_producao WHERE sincronizacao_id = %s",
                (sinc_id,),
            )

            erros = 0
            for _, row in df.iterrows():
                try:
                    cur.execute(
                        """
                        INSERT INTO sia_producao (
                            sincronizacao_id, competencia, unidade,
                            codigo_sigtap, descricao, quantidade, valor_aprovado,
                            faixa_etaria, sexo, cbo, dados_extras
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            sinc_id,
                            competencia_date,
                            row.get("unidade"),
                            row.get("codigo_sigtap"),
                            row.get("descricao"),
                            int(row.get("quantidade") or 0),
                            row.get("valor_aprovado")
                            if pd.notna(row.get("valor_aprovado"))
                            else None,
                            row.get("faixa_etaria"),
                            row.get("sexo"),
                            row.get("cbo"),
                            None,
                        ),
                    )
                except Exception as exc:
                    erros += 1
                    print(f"Erro linha: {exc}", file=sys.stderr)

            status = "ok" if erros == 0 else ("parcial" if erros < len(df) else "erro")
            cur.execute(
                """
                UPDATE sia_sincronizacoes
                SET status = %s, erros = %s, sincronizado_em = now()
                WHERE id = %s
                """,
                (status, erros, sinc_id),
            )

    return {
        "sincronizacao_id": sinc_id,
        "competencia": str(competencia_date),
        "registros": len(df),
        "erros": erros,
        "status": status,
    }


def sincronizar(competencia: str, *, pg_write: bool) -> dict:
    if not mysql_configured():
        return {
            "competencia": competencia,
            "registros": 0,
            "erros": 0,
            "status": "erro",
            "error": "MySQL_XAMPP_UNAVAILABLE",
        }

    competencia_date = competencia_para_date(competencia)
    conn_mysql = mysql_connect()
    try:
        df_raw = extrair_sia(conn_mysql, competencia_date)
    except Exception as exc:
        return {
            "competencia": competencia,
            "registros": 0,
            "erros": 1,
            "status": "erro",
            "error": str(exc),
        }
    finally:
        conn_mysql.close()

    df = transformar(df_raw)

    if not pg_write:
        preview = df.head(50).replace({pd.NA: None}).to_dict(orient="records")
        return {
            "competencia": competencia,
            "registros": len(df),
            "erros": 0,
            "status": "ok" if len(df) else "parcial",
            "preview": preview,
        }

    conn_pg = pg_connect()
    try:
        return gravar_pg(conn_pg, df, competencia_date)
    finally:
        conn_pg.close()


def main():
    parser = argparse.ArgumentParser(description="SIMPA — Sync SIA MySQL -> PostgreSQL")
    parser.add_argument("--competencia", help="Competência YYYY-MM")
    parser.add_argument("--meses", type=int, help="Sincronizar últimos N meses")
    parser.add_argument(
        "--json-out",
        action="store_true",
        help="Imprime resultado JSON no stdout",
    )
    parser.add_argument(
        "--pg-write",
        action="store_true",
        help="Grava em sia_sincronizacoes + sia_producao",
    )
    args = parser.parse_args()

    if not args.json_out and not args.pg_write:
        print("Erro: use --json-out ou --pg-write", file=sys.stderr)
        sys.exit(1)

    if not args.competencia and not args.meses:
        parser.error("Informe --competencia YYYY-MM ou --meses N")

    load_dotenv()

    competencias = []
    if args.competencia:
        competencias = [args.competencia]
    else:
        hoje = date.today()
        for i in range(args.meses):
            d = hoje - relativedelta(months=i)
            competencias.append(f"{d.year}-{d.month:02d}")

    resultados = []
    for comp in competencias:
        print(f"Sincronizando {comp}...", file=sys.stderr)
        result = sincronizar(comp, pg_write=args.pg_write)
        resultados.append(result)
        print(
            f"  {result['status']} — {result.get('registros', 0)} registros, "
            f"{result.get('erros', 0)} erros",
            file=sys.stderr,
        )

    print(json.dumps(resultados, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
