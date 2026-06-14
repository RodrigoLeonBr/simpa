#!/usr/bin/env python3
"""
SIMPA - Conector SIA/SUS: MySQL/XAMPP -> PostgreSQL
====================================================

Extrai producao ambulatorial do banco MySQL/XAMPP (SIA/SUS),
transforma e grava em sia_producao no PostgreSQL.

Uso:
    python sync_sia_mysql.py --competencia 2026-05
    python sync_sia_mysql.py --competencia 2026-05 --json-out
    python sync_sia_mysql.py --meses 6
"""

import argparse
import json
import os
import sys
from datetime import date

import mysql.connector
import pandas as pd
import psycopg2
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv

load_dotenv()

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


def conectar_mysql():
    return mysql.connector.connect(
        host=os.environ["MYSQL_HOST"],
        port=int(os.environ["MYSQL_PORT"]),
        database=os.environ["MYSQL_DB"],
        user=os.environ["MYSQL_USER"],
        password=os.environ["MYSQL_PASS"],
    )


def conectar_pg():
    return psycopg2.connect(
        host=os.environ["PG_HOST"],
        port=os.environ["PG_PORT"],
        dbname=os.environ["PG_DB"],
        user=os.environ["PG_USER"],
        password=os.environ["PG_PASS"],
    )


def competencia_para_date(competencia: str) -> date:
    """'2026-05' -> date(2026, 5, 1)"""
    ano, mes = competencia.split("-")
    return date(int(ano), int(mes), 1)


def calcular_faixa_etaria(idade):
    """45 -> '40-49'"""
    if pd.isna(idade):
        return None
    for i, limite in enumerate(FAIXA_ETARIA_BINS[1:]):
        if int(idade) < limite:
            return FAIXA_ETARIA_LABELS[i]
    return "80+"


def extrair_sia(conn_mysql, competencia_date: date) -> pd.DataFrame:
    """
    Extrai producao do MySQL para a competencia informada.

    AJUSTE a query abaixo conforme as tabelas reais do seu banco SIA/XAMPP.
    Use phpMyAdmin para descobrir os nomes das colunas e tabelas.
    """
    ano = competencia_date.year
    mes = str(competencia_date.month).zfill(2)

    query = """
        SELECT
            estabelecimento AS unidade,
            procedimento    AS codigo_sigtap,
            descricao_proc  AS descricao,
            SUM(quantidade) AS quantidade,
            SUM(valor_aprovado) AS valor_aprovado,
            idade,
            sexo,
            cbo
        FROM producao_ambulatorial
        WHERE ano_competencia = %(ano)s
          AND mes_competencia = %(mes)s
        GROUP BY
            estabelecimento, procedimento, descricao_proc,
            idade, sexo, cbo
    """
    # NOTA: ajuste o nome da tabela (`producao_ambulatorial`) e das colunas
    # conforme o schema real do seu banco SIA no XAMPP.

    df = pd.read_sql(query, conn_mysql, params={"ano": ano, "mes": mes})
    return df


def transformar(df: pd.DataFrame) -> pd.DataFrame:
    """Normaliza tipos e calcula faixa_etaria."""
    df = df.copy()
    df["faixa_etaria"] = df["idade"].apply(calcular_faixa_etaria)
    df["sexo"] = (
        df["sexo"]
        .astype(str)
        .str.upper()
        .str.strip()
        .where(df["sexo"].astype(str).str.upper().str.strip().isin(["M", "F"]), other="I")
    )
    df["cbo"] = df["cbo"].astype(str).str.strip().replace("nan", None)
    df["quantidade"] = pd.to_numeric(df["quantidade"], errors="coerce").fillna(0).astype(int)
    df["valor_aprovado"] = pd.to_numeric(df["valor_aprovado"], errors="coerce")
    return df


def gravar_pg(conn_pg, df: pd.DataFrame, competencia_date: date) -> dict:
    """Grava DataFrame transformado no PostgreSQL."""
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

            erros = 0
            for _, row in df.iterrows():
                try:
                    extras = {}
                    cur.execute(
                        """
                        INSERT INTO sia_producao (
                            sincronizacao_id, competencia, unidade,
                            codigo_sigtap, descricao, quantidade, valor_aprovado,
                            faixa_etaria, sexo, cbo, dados_extras
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (sincronizacao_id, unidade, codigo_sigtap,
                                     faixa_etaria, sexo, cbo)
                        DO UPDATE SET
                            quantidade     = EXCLUDED.quantidade,
                            valor_aprovado = EXCLUDED.valor_aprovado
                        """,
                        (
                            sinc_id,
                            competencia_date,
                            row.get("unidade"),
                            row.get("codigo_sigtap"),
                            row.get("descricao"),
                            int(row.get("quantidade", 0)),
                            row.get("valor_aprovado")
                            if pd.notna(row.get("valor_aprovado"))
                            else None,
                            row.get("faixa_etaria"),
                            row.get("sexo"),
                            row.get("cbo"),
                            json.dumps(extras) if extras else None,
                        ),
                    )
                except Exception as e:
                    erros += 1
                    print(f"Erro linha: {e}", file=sys.stderr)

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


def sincronizar(competencia: str) -> dict:
    competencia_date = competencia_para_date(competencia)
    conn_mysql = conectar_mysql()
    try:
        df_raw = extrair_sia(conn_mysql, competencia_date)
    finally:
        conn_mysql.close()

    df = transformar(df_raw)
    conn_pg = conectar_pg()
    try:
        result = gravar_pg(conn_pg, df, competencia_date)
    finally:
        conn_pg.close()

    return result


def main():
    parser = argparse.ArgumentParser(description="SIMPA — Sync SIA MySQL -> PostgreSQL")
    parser.add_argument(
        "--competencia", help="Competência no formato YYYY-MM (ex: 2026-05)"
    )
    parser.add_argument("--meses", type=int, help="Sincronizar últimos N meses")
    parser.add_argument(
        "--json-out", action="store_true", help="Imprime resultado JSON no stdout"
    )
    args = parser.parse_args()

    if not args.competencia and not args.meses:
        parser.error("Informe --competencia YYYY-MM ou --meses N")

    competencias = []
    if args.competencia:
        competencias = [args.competencia]
    elif args.meses:
        hoje = date.today()
        for i in range(args.meses):
            d = hoje - relativedelta(months=i)
            competencias.append(f"{d.year}-{str(d.month).zfill(2)}")

    resultados = []
    for comp in competencias:
        print(f"Sincronizando {comp}...", file=sys.stderr)
        result = sincronizar(comp)
        resultados.append(result)
        print(
            f"  {result['status']} — {result['registros']} registros, "
            f"{result['erros']} erros",
            file=sys.stderr,
        )

    if args.json_out or True:
        print(json.dumps(resultados, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
