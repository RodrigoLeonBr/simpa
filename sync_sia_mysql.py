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
import time
from datetime import date

import pandas as pd
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv
from psycopg2.extras import execute_batch

from etl_db import mysql_configured, mysql_connect, pg_connect

def competencia_para_date(competencia: str) -> date:
    ano, mes = competencia.split("-")
    return date(int(ano), int(mes), 1)


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


def _join_expr(alias: str, column: str, charset: str, collation: str) -> str:
    return f"CONVERT({alias}.{column} USING {charset}) COLLATE {collation}"


def emit_progress(
    *,
    exec_id: str | None,
    stage: str,
    event: str,
    message: str | None = None,
    **data,
) -> None:
    payload = {"stage": stage, "event": event}
    if exec_id:
        payload["exec_id"] = exec_id
    if message:
        payload["message"] = message
    for key, value in data.items():
        if value is not None:
            payload[key] = value
    print(f"SIA_PROGRESS {json.dumps(payload, ensure_ascii=False)}", file=sys.stderr, flush=True)


def _extract_block_size() -> int:
    raw = _sia_env("SIA_EXTRACT_BLOCK_SIZE", "10000")
    try:
        parsed = int(raw)
    except ValueError:
        return 10000
    return parsed if parsed > 0 else 10000


def build_sia_query(*, paginated: bool = False) -> tuple[str, dict[str, str]]:
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
        "col_apac": _sia_env("SIA_COL_APAC", "PRD_APANUM"),
        "col_rub_pk": _sia_env("SIA_COL_RUBRICA_PK", "RUB_ID"),
        "col_rub_desc": _sia_env("SIA_COL_RUBRICA_DESC", "RUB_DC"),
        "col_sexo": _sia_env("SIA_COL_SEXO", ""),
        "col_prest_ativo": _sia_env("SIA_COL_PRESTADOR_ATIVO", "ativo"),
        "join_charset": _sia_env("SIA_JOIN_CHARSET", "utf8mb4"),
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

    prd_uid_join = _join_expr("prd", cfg["col_prd_uid"], cfg["join_charset"], cfg["join_collation"])
    prest_pk_join = _join_expr("p", cfg["col_prest_pk"], cfg["join_charset"], cfg["join_collation"])
    prd_proc_join = _join_expr("prd", cfg["col_proc"], cfg["join_charset"], cfg["join_collation"])
    proc_pk_join = _join_expr("proc", cfg["col_proc_pk"], cfg["join_charset"], cfg["join_collation"])
    prd_cbo_join = _join_expr("prd", cfg["col_cbo"], cfg["join_charset"], cfg["join_collation"])
    cbo_pk_join = _join_expr("cb", cfg["col_cbo_pk"], cfg["join_charset"], cfg["join_collation"])
    prd_rub_join = (
        f"CONVERT(LEFT(prd.{cfg['col_rubrica']}, 4) USING {cfg['join_charset']}) "
        f"COLLATE {cfg['join_collation']}"
    )
    rub_pk_join = _join_expr("sr", cfg["col_rub_pk"], cfg["join_charset"], cfg["join_collation"])

    pagination_clause = ""
    if paginated:
        pagination_clause = """
        ORDER BY
            prd.{col_prd_uid},
            p.{col_unidade},
            prd.{col_proc},
            proc.{col_desc},
            prd.{col_cbo},
            LEFT(prd.{col_rubrica}, 4),
            sr.{col_rub_desc},
            prd.{col_idade}{sexo_group},
            NULLIF(TRIM(prd.{col_apac}), '')
        LIMIT %(limit)s OFFSET %(offset)s
        """.format(
            col_prd_uid=cfg["col_prd_uid"],
            col_unidade=cfg["col_unidade"],
            col_proc=cfg["col_proc"],
            col_desc=cfg["col_desc"],
            col_cbo=cfg["col_cbo"],
            col_rubrica=cfg["col_rubrica"],
            col_rub_desc=cfg["col_rub_desc"],
            col_idade=cfg["col_idade"],
            col_apac=cfg["col_apac"],
            sexo_group=sexo_group,
        )

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
            cb.{cfg['col_cbo_pk']} AS cbo_cadastro,
            NULLIF(TRIM(prd.{cfg['col_apac']}), '') AS apac_num
        FROM {cfg['table_prd']} prd
        LEFT JOIN {cfg['table_prest']} p
            ON {prd_uid_join} =
               {prest_pk_join}
        LEFT JOIN {cfg['table_proc']} proc
            ON {prd_proc_join} =
               {proc_pk_join}
        LEFT JOIN {cfg['table_cbo']} cb
            ON {prd_cbo_join} =
               {cbo_pk_join}
        LEFT JOIN {cfg['table_rub']} sr
            ON {prd_rub_join} =
               {rub_pk_join}
        WHERE prd.{cfg['col_comp']} = %(comp)s{ativo_filter}
        GROUP BY
            prd.{cfg['col_prd_uid']},
            p.{cfg['col_unidade']},
            prd.{cfg['col_proc']},
            proc.{cfg['col_desc']},
            prd.{cfg['col_cbo']},
            LEFT(prd.{cfg['col_rubrica']}, 4),
            sr.{cfg['col_rub_desc']},
            prd.{cfg['col_idade']}{sexo_group},
            NULLIF(TRIM(prd.{cfg['col_apac']}), '')
        {pagination_clause}
    """
    return query, cfg


def extrair_sia(conn_mysql, competencia_date: date) -> pd.DataFrame:
    """Extrai produção SIA do MySQL para a competência informada (prd_cmp = YYYYMM)."""
    query, _ = build_sia_query()
    comp = competencia_date.strftime("%Y%m")
    return pd.read_sql(query, conn_mysql, params={"comp": comp})


def extrair_sia_em_blocos(
    conn_mysql,
    competencia_date: date,
    block_size: int | None = None,
    *,
    exec_id: str | None = None,
):
    """
    Extrai produção SIA em páginas agregadas para reduzir risco de timeout.
    """
    query, _ = build_sia_query(paginated=True)
    comp = competencia_date.strftime("%Y%m")
    page_size = block_size or _extract_block_size()
    offset = 0

    while True:
        started_at = time.perf_counter()
        df = pd.read_sql(
            query,
            conn_mysql,
            params={
                "comp": comp,
                "limit": page_size,
                "offset": offset,
            },
        )
        if df.empty:
            emit_progress(
                exec_id=exec_id,
                stage="extracao_mysql",
                event="extract_finished",
                message="Extração MySQL concluída",
                block_index=(offset // page_size) + 1,
                block_rows=0,
                offset=offset,
                duration_ms=int((time.perf_counter() - started_at) * 1000),
            )
            break
        block_index = (offset // page_size) + 1
        emit_progress(
            exec_id=exec_id,
            stage="extracao_mysql",
            event="extract_block",
            message=f"Bloco {block_index} extraído do MySQL",
            block_index=block_index,
            block_rows=len(df),
            offset=offset,
            duration_ms=int((time.perf_counter() - started_at) * 1000),
        )
        yield df
        if len(df) < page_size:
            break
        offset += page_size


def transformar(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df.copy()

    out = df.copy()
    if "quantidade_apresentada" not in out.columns:
        out["quantidade_apresentada"] = out.get("quantidade", 0)
    if "valor_apresentado" not in out.columns:
        out["valor_apresentado"] = out.get("valor_aprovado")

    out["idade"] = out["idade"].apply(normalizar_idade)
    # Preserva o grupo de idade original do SIA para permitir
    # múltiplas estratégias de faixa etária no relatório.
    out["faixa_etaria"] = out["idade"].apply(
        lambda idade: str(int(idade)) if pd.notna(idade) else "Ignorado"
    )
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
    if "apac_num" in out.columns:
        out["apac_num"] = (
            out["apac_num"]
            .astype(str)
            .str.strip()
            .replace({"": None, "nan": None, "None": None})
        )
    return out


def _first_not_null(series: pd.Series):
    non_null = series.dropna()
    if non_null.empty:
        return None
    value = non_null.iloc[0]
    if isinstance(value, str):
        stripped = value.strip()
        return stripped if stripped else None
    return value


def consolidar_para_carga(df: pd.DataFrame) -> pd.DataFrame:
    """
    Consolida linhas na mesma chave da constraint uq_sia_producao_grupo_cnes
    para evitar duplicidade intra-sincronização.
    """
    if df.empty:
        return df.copy()

    keys = [
        "cnes",
        "codigo_sigtap",
        "faixa_etaria",
        "sexo",
        "cbo",
        "rubrica_codigo",
    ]
    if "apac_num" in df.columns:
        keys.append("apac_num")
    grouped = (
        df.groupby(keys, dropna=False, as_index=False)
        .agg(
            unidade=("unidade", _first_not_null),
            descricao=("descricao", _first_not_null),
            quantidade=("quantidade", "sum"),
            quantidade_apresentada=("quantidade_apresentada", "sum"),
            valor_aprovado=("valor_aprovado", "sum"),
            valor_apresentado=("valor_apresentado", "sum"),
            rubrica_descricao=("rubrica_descricao", _first_not_null),
        )
        .replace({pd.NA: None})
    )
    grouped["quantidade"] = pd.to_numeric(grouped["quantidade"], errors="coerce").fillna(0).astype(int)
    grouped["quantidade_apresentada"] = (
        pd.to_numeric(grouped["quantidade_apresentada"], errors="coerce").fillna(0).astype(int)
    )
    return grouped


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
    exec_id: str | None = None,
) -> dict:
    chunk_size = batch_size or _batch_size()
    first_chunk_error: str | None = None
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
                apac_raw = row.get("apac_num")
                apac_num = str(apac_raw).strip() if pd.notna(apac_raw) else None
                if apac_num in ("", "None", "nan"):
                    apac_num = None
                if apac_num:
                    dados_extras["apac_num"] = apac_num

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
                        apac_num,
                        json.dumps(dados_extras, ensure_ascii=False) if dados_extras else None,
                    )
                )

            erros = 0
            if payload:
                insert_sql = """
                    INSERT INTO sia_producao (
                        sincronizacao_id, competencia, unidade, cnes, estabelecimento_id,
                        codigo_sigtap, descricao, quantidade, quantidade_apresentada,
                        valor_aprovado, valor_apresentado, faixa_etaria, sexo, cbo, rubrica,
                        apac_num, dados_extras
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                """
                total_chunks = max(1, (len(payload) + chunk_size - 1) // chunk_size)
                for i in range(0, len(payload), chunk_size):
                    chunk = payload[i : i + chunk_size]
                    chunk_index = (i // chunk_size) + 1
                    started_chunk = time.perf_counter()
                    savepoint_name = f"sia_batch_{i // chunk_size}"
                    cur.execute(f"SAVEPOINT {savepoint_name}")
                    try:
                        execute_batch(cur, insert_sql, chunk)
                        cur.execute(f"RELEASE SAVEPOINT {savepoint_name}")
                        emit_progress(
                            exec_id=exec_id,
                            stage="gravar_postgres",
                            event="insert_chunk",
                            message=f"Chunk {chunk_index}/{total_chunks} gravado no PostgreSQL",
                            chunk_index=chunk_index,
                            chunks_total=total_chunks,
                            rows_processed=len(chunk),
                            inserted_rows_total=min(i + len(chunk), len(payload)),
                            total_rows=len(payload),
                            duration_ms=int((time.perf_counter() - started_chunk) * 1000),
                        )
                    except Exception as exc:
                        erros += len(chunk)
                        if first_chunk_error is None:
                            first_chunk_error = str(exc)
                        cur.execute(f"ROLLBACK TO SAVEPOINT {savepoint_name}")
                        cur.execute(f"RELEASE SAVEPOINT {savepoint_name}")
                        emit_progress(
                            exec_id=exec_id,
                            stage="gravar_postgres",
                            event="insert_chunk_error",
                            message=f"Falha no chunk {chunk_index}/{total_chunks}",
                            chunk_index=chunk_index,
                            chunks_total=total_chunks,
                            rows_processed=len(chunk),
                            total_rows=len(payload),
                            error=str(exc),
                            duration_ms=int((time.perf_counter() - started_chunk) * 1000),
                        )
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
    if first_chunk_error:
        result["error"] = first_chunk_error
    if linhas_mysql_raw is not None:
        result["linhas_mysql_raw"] = int(linhas_mysql_raw)
    return result


def sincronizar(
    competencia: str,
    *,
    pg_write: bool,
    reimportar: bool = False,
    exec_id: str | None = None,
) -> dict:
    emit_progress(
        exec_id=exec_id,
        stage="iniciando",
        event="sync_started",
        message="Iniciando sincronização SIA",
        competencia=competencia,
    )
    if not mysql_configured():
        emit_progress(
            exec_id=exec_id,
            stage="erro",
            event="mysql_unavailable",
            message="MySQL/XAMPP indisponível",
        )
        return {
            "competencia": competencia,
            "registros": 0,
            "erros": 0,
            "status": "erro",
            "error": "MySQL_XAMPP_UNAVAILABLE",
        }

    competencia_date = competencia_para_date(competencia)
    if not pg_write:
        conn_mysql = mysql_connect()
        try:
            emit_progress(
                exec_id=exec_id,
                stage="extracao_mysql",
                event="extract_preview_started",
                message="Extraindo prévia do MySQL",
            )
            df_raw = extrair_sia(conn_mysql, competencia_date)
        except Exception as exc:
            emit_progress(
                exec_id=exec_id,
                stage="erro",
                event="extract_error",
                message=str(exc),
            )
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
        df = consolidar_para_carga(df)
        linhas_mysql_raw = len(df_raw)
        preview = df.head(50).replace({pd.NA: None}).to_dict(orient="records")
        return {
            "competencia": competencia,
            "registros": len(df),
            "linhas_mysql_raw": linhas_mysql_raw,
            "erros": 0,
            "status": "ok" if len(df) else "parcial",
            "preview": preview,
        }

    conn_mysql = mysql_connect()
    linhas_mysql_raw = 0
    linhas_transformadas = 0
    blocos_transformados = []
    try:
        emit_progress(
            exec_id=exec_id,
            stage="extracao_mysql",
            event="extract_started",
            message="Extração MySQL em blocos iniciada",
            block_size=_extract_block_size(),
        )
        for bloco_raw in extrair_sia_em_blocos(conn_mysql, competencia_date, exec_id=exec_id):
            linhas_mysql_raw += len(bloco_raw)
            started_transform = time.perf_counter()
            bloco_transformado = transformar(bloco_raw)
            if not bloco_transformado.empty:
                blocos_transformados.append(bloco_transformado)
                linhas_transformadas += len(bloco_transformado)
            emit_progress(
                exec_id=exec_id,
                stage="transformacao",
                event="transform_block",
                message="Bloco transformado para carga",
                block_rows=len(bloco_raw),
                extracted_rows_total=linhas_mysql_raw,
                transformed_rows_total=linhas_transformadas,
                duration_ms=int((time.perf_counter() - started_transform) * 1000),
            )
    except Exception as exc:
        emit_progress(
            exec_id=exec_id,
            stage="erro",
            event="extract_or_transform_error",
            message=str(exc),
        )
        return {
            "competencia": competencia,
            "registros": 0,
            "erros": 1,
            "status": "erro",
            "error": str(exc),
        }
    finally:
        conn_mysql.close()

    if blocos_transformados:
        df = pd.concat(blocos_transformados, ignore_index=True)
        df = consolidar_para_carga(df)
    else:
        df = pd.DataFrame()

    conn_pg = pg_connect()
    try:
        emit_progress(
            exec_id=exec_id,
            stage="gravar_postgres",
            event="insert_started",
            message="Iniciando gravação no PostgreSQL",
            total_rows=len(df),
        )
        return gravar_pg(
            conn_pg,
            df,
            competencia_date,
            reimportar=reimportar,
            linhas_mysql_raw=linhas_mysql_raw,
            exec_id=exec_id,
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
    parser.add_argument("--exec-id", help="Identificador da execução para telemetria")
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
        result = sincronizar(
            comp,
            pg_write=args.pg_write,
            reimportar=args.reimportar,
            exec_id=args.exec_id,
        )
        resultados.append(result)
        print(
            f"  {result['status']} — {result.get('registros', 0)} registros, "
            f"{result.get('erros', 0)} erros",
            file=sys.stderr,
        )

    print(json.dumps(resultados, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
