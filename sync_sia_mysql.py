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
from psycopg2.extras import execute_batch

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


def normalizar_idade(valor):
    idade = pd.to_numeric(valor, errors="coerce")
    if pd.isna(idade):
        return None
    idade_int = int(idade)
    if idade_int < 0 or idade_int > 150:
        return None
    return idade_int


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
        "table_cbo": _sia_env("SIA_TABLE_CBO", "cbo"),
        "table_rub": _sia_env("SIA_TABLE_RUBRICA", "s_rub"),
        "col_comp": _sia_env("SIA_COL_COMPETENCIA", "prd_cmp"),
        "col_prd_uid": _sia_env("SIA_COL_PRD_UID", "prd_uid"),
        "col_prest_pk": _sia_env("SIA_COL_PRESTADOR_PK", "re_cunid"),
        "col_proc": _sia_env("SIA_COL_COD_PROC", "prd_pa"),
        "col_proc_pk": _sia_env("SIA_COL_PROC_PK", "codigo"),
        "col_qtd_aprovada": _sia_env("SIA_COL_QTD_APROVADA", "PRD_QT_A"),
        "col_qtd_apresentada": _sia_env("SIA_COL_QTD_APRESENTADA", "PRD_QT_P"),
        "col_valor_aprovado": _sia_env("SIA_COL_VALOR_APROVADO", "PRD_VL_A"),
        "col_valor_apresentado": _sia_env("SIA_COL_VALOR_APRESENTADO", "PRD_VL_P"),
        "col_idade": _sia_env("SIA_COL_IDADE", "PRD_IDADE"),
        "col_cbo": _sia_env("SIA_COL_CBO", "prd_cbo"),
        "col_unidade": _sia_env("SIA_COL_UNIDADE", "re_cnome"),
        "col_desc": _sia_env("SIA_COL_DESC_PROC", "procedimento"),
        "col_cbo_pk": _sia_env("SIA_COL_CBO_PK", "CBO"),
        "col_rubrica": _sia_env("SIA_COL_RUBRICA", "PRD_RUB"),
        "col_rub_pk": _sia_env("SIA_COL_RUBRICA_PK", "RUB_ID"),
        "col_rub_desc": _sia_env("SIA_COL_RUBRICA_DESC", "RUB_DC"),
        "col_sexo": _sia_env("SIA_COL_SEXO", ""),
        "col_prest_ativo": _sia_env("SIA_COL_PRESTADOR_ATIVO", "ativo"),
        "join_collation": _sia_env("SIA_JOIN_COLLATION", "utf8mb4_general_ci"),
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
            prd.{cfg['col_prd_uid']} AS cnes,
            p.{cfg['col_unidade']} AS unidade,
            prd.{cfg['col_proc']} AS codigo_sigtap,
            proc.{cfg['col_desc']} AS descricao,
            prd.{cfg['col_cbo']} AS cbo,
            LEFT(prd.{cfg['col_rubrica']}, 4) AS rubrica_codigo,
            sr.{cfg['col_rub_desc']} AS rubrica_descricao,
            prd.{cfg['col_idade']} AS idade,
            SUM(CAST(prd.{cfg['col_qtd_aprovada']} AS UNSIGNED)) AS quantidade,
            SUM(CAST(prd.{cfg['col_qtd_apresentada']} AS UNSIGNED)) AS quantidade_apresentada,
            SUM(CAST(prd.{cfg['col_valor_aprovado']} AS DECIMAL(15,2))) AS valor_aprovado,
            SUM(CAST(prd.{cfg['col_valor_apresentado']} AS DECIMAL(15,2))) AS valor_apresentado,
            {sexo_expr},
            cb.{cfg['col_cbo_pk']} AS cbo_cadastro
        FROM {cfg['table_prd']} prd
        LEFT JOIN {cfg['table_prest']} p
            ON prd.{cfg['col_prd_uid']} COLLATE {cfg['join_collation']} =
               p.{cfg['col_prest_pk']} COLLATE {cfg['join_collation']}
        LEFT JOIN {cfg['table_proc']} proc
            ON prd.{cfg['col_proc']} COLLATE {cfg['join_collation']} =
               proc.{cfg['col_proc_pk']} COLLATE {cfg['join_collation']}
        LEFT JOIN {cfg['table_cbo']} cb
            ON prd.{cfg['col_cbo']} COLLATE {cfg['join_collation']} =
               cb.{cfg['col_cbo_pk']} COLLATE {cfg['join_collation']}
        LEFT JOIN {cfg['table_rub']} sr
            ON LEFT(prd.{cfg['col_rubrica']}, 4) COLLATE {cfg['join_collation']} =
               sr.{cfg['col_rub_pk']} COLLATE {cfg['join_collation']}
        WHERE prd.{cfg['col_comp']} = %(comp)s{ativo_filter}
        GROUP BY
            prd.{cfg['col_prd_uid']},
            p.{cfg['col_unidade']},
            prd.{cfg['col_proc']},
            proc.{cfg['col_desc']},
            prd.{cfg['col_cbo']},
            LEFT(prd.{cfg['col_rubrica']}, 4),
            sr.{cfg['col_rub_desc']},
            prd.{cfg['col_idade']}{sexo_group}
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
    if "quantidade_apresentada" not in out.columns:
        out["quantidade_apresentada"] = out.get("quantidade", 0)
    if "valor_apresentado" not in out.columns:
        out["valor_apresentado"] = out.get("valor_aprovado")

    out["idade"] = out["idade"].apply(normalizar_idade)
    out["faixa_etaria"] = out["idade"].apply(calcular_faixa_etaria).fillna("Ignorado")
    out["sexo"] = (
        out["sexo"]
        .astype(str)
        .str.upper()
        .str.strip()
        .where(out["sexo"].astype(str).str.upper().str.strip().isin(["M", "F"]), other="I")
    )
    out["cbo"] = out["cbo"].astype(str).str.strip().replace({"nan": None, "None": None})
    out["quantidade"] = pd.to_numeric(out["quantidade"], errors="coerce").fillna(0).astype(int)
    out["quantidade_apresentada"] = (
        pd.to_numeric(out["quantidade_apresentada"], errors="coerce").fillna(0).astype(int)
    )
    out["valor_aprovado"] = pd.to_numeric(out["valor_aprovado"], errors="coerce")
    out["valor_apresentado"] = pd.to_numeric(out["valor_apresentado"], errors="coerce")
    return out


def _batch_size() -> int:
    raw = _sia_env("SIA_PG_BATCH_SIZE", "1000")
    try:
        parsed = int(raw)
    except ValueError:
        return 1000
    return parsed if parsed > 0 else 1000


def load_estabelecimentos_map(conn_pg) -> dict[str, int]:
    with conn_pg.cursor() as cur:
        cur.execute(
            """
            SELECT codigo_externo, id
            FROM estabelecimentos
            WHERE codigo_externo IS NOT NULL
            """
        )
        rows = cur.fetchall()
    return {str(codigo).strip(): estabelecimento_id for codigo, estabelecimento_id in rows}


def check_competencia_importada(conn_pg, competencia: str | date) -> dict[str, object]:
    competencia_date = (
        competencia if isinstance(competencia, date) else competencia_para_date(competencia)
    )
    with conn_pg.cursor() as cur:
        cur.execute(
            """
            SELECT status, registros, sincronizado_em
            FROM sia_sincronizacoes
            WHERE competencia = %s
              AND status IN ('ok', 'parcial')
            ORDER BY sincronizado_em DESC
            LIMIT 1
            """,
            (competencia_date,),
        )
        row = cur.fetchone()

    if not row:
        return {"exists": False, "status": None, "registros": 0, "sincronizado_em": None}

    return {
        "exists": True,
        "status": row[0],
        "registros": int(row[1] or 0),
        "sincronizado_em": row[2],
    }


def gravar_pg(
    conn_pg,
    df: pd.DataFrame,
    competencia_date: date,
    *,
    reimportar: bool = False,
    linhas_mysql_raw: int | None = None,
    batch_size: int | None = None,
) -> dict:
    chunk_size = batch_size or _batch_size()
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

            if reimportar:
                cur.execute(
                    "DELETE FROM sia_producao WHERE competencia = %s",
                    (competencia_date,),
                )

            estab_map = load_estabelecimentos_map(conn_pg)
            orphan_cnes = 0
            estabelecimentos_resolvidos = 0
            payload: list[tuple[object, ...]] = []

            for _, row in df.iterrows():
                cnes_raw = row.get("cnes")
                cnes = str(cnes_raw).strip() if pd.notna(cnes_raw) else None
                if cnes in ("", "None", "nan"):
                    cnes = None

                estabelecimento_id = estab_map.get(cnes) if cnes else None
                if estabelecimento_id is None:
                    if cnes:
                        orphan_cnes += 1
                else:
                    estabelecimentos_resolvidos += 1

                rubrica_codigo = row.get("rubrica_codigo")
                rubrica_descricao = row.get("rubrica_descricao")
                rubrica = str(rubrica_codigo).strip() if pd.notna(rubrica_codigo) else None
                if rubrica in ("", "None", "nan"):
                    rubrica = None
                dados_extras: dict[str, object] = {}
                if pd.notna(rubrica_codigo):
                    dados_extras["rubrica_codigo"] = str(rubrica_codigo).strip()
                if pd.notna(rubrica_descricao):
                    dados_extras["rubrica_descricao"] = str(rubrica_descricao).strip()

                payload.append(
                    (
                        sinc_id,
                        competencia_date,
                        row.get("unidade"),
                        cnes,
                        estabelecimento_id,
                        row.get("codigo_sigtap"),
                        row.get("descricao"),
                        int(row.get("quantidade") or 0),
                        int(row.get("quantidade_apresentada") or 0),
                        row.get("valor_aprovado")
                        if pd.notna(row.get("valor_aprovado"))
                        else None,
                        row.get("valor_apresentado")
                        if pd.notna(row.get("valor_apresentado"))
                        else None,
                        row.get("faixa_etaria"),
                        row.get("sexo"),
                        row.get("cbo"),
                        rubrica,
                        json.dumps(dados_extras, ensure_ascii=False) if dados_extras else None,
                    )
                )

            erros = 0
            if payload:
                insert_sql = """
                    INSERT INTO sia_producao (
                        sincronizacao_id, competencia, unidade, cnes, estabelecimento_id,
                        codigo_sigtap, descricao, quantidade, quantidade_apresentada,
                        valor_aprovado, valor_apresentado, faixa_etaria, sexo, cbo, rubrica, dados_extras
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                """
                for i in range(0, len(payload), chunk_size):
                    chunk = payload[i : i + chunk_size]
                    savepoint_name = f"sia_batch_{i // chunk_size}"
                    cur.execute(f"SAVEPOINT {savepoint_name}")
                    try:
                        execute_batch(cur, insert_sql, chunk)
                        cur.execute(f"RELEASE SAVEPOINT {savepoint_name}")
                    except Exception as exc:
                        erros += len(chunk)
                        cur.execute(f"ROLLBACK TO SAVEPOINT {savepoint_name}")
                        cur.execute(f"RELEASE SAVEPOINT {savepoint_name}")
                        print(
                            f"Erro batch chunk {i // chunk_size + 1}: {exc}",
                            file=sys.stderr,
                        )

            if not payload:
                status = "parcial"
            else:
                status = "ok" if erros == 0 else ("parcial" if erros < len(df) else "erro")
            cur.execute(
                """
                UPDATE sia_sincronizacoes
                SET status = %s, erros = %s, sincronizado_em = now()
                WHERE id = %s
                """,
                (status, erros, sinc_id),
            )

    result = {
        "sincronizacao_id": sinc_id,
        "competencia": str(competencia_date),
        "registros": len(df),
        "erros": erros,
        "status": status,
        "orphan_cnes": orphan_cnes,
        "estabelecimentos_resolvidos": estabelecimentos_resolvidos,
    }
    if linhas_mysql_raw is not None:
        result["linhas_mysql_raw"] = int(linhas_mysql_raw)
    return result


def sincronizar(competencia: str, *, pg_write: bool, reimportar: bool = False) -> dict:
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
    linhas_mysql_raw = len(df_raw)

    if not pg_write:
        preview = df.head(50).replace({pd.NA: None}).to_dict(orient="records")
        return {
            "competencia": competencia,
            "registros": len(df),
            "linhas_mysql_raw": linhas_mysql_raw,
            "erros": 0,
            "status": "ok" if len(df) else "parcial",
            "preview": preview,
        }

    conn_pg = pg_connect()
    try:
        return gravar_pg(
            conn_pg,
            df,
            competencia_date,
            reimportar=reimportar,
            linhas_mysql_raw=linhas_mysql_raw,
        )
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
    parser.add_argument(
        "--reimportar",
        action="store_true",
        help="Força reimportação da competência (DELETE por competencia antes do insert)",
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
        result = sincronizar(comp, pg_write=args.pg_write, reimportar=args.reimportar)
        resultados.append(result)
        print(
            f"  {result['status']} — {result.get('registros', 0)} registros, "
            f"{result.get('erros', 0)} erros",
            file=sys.stderr,
        )

    print(json.dumps(resultados, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
