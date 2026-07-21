#!/usr/bin/env python3
"""
SIMPA - Conector SIHD: MySQL/XAMPP -> PostgreSQL
=================================================

Lê internações do MySQL/XAMPP (somente leitura) conforme ADR-001 e ADR-002
(tabelas s_aih, s_aih_pa, prestador) e grava em sih_aih (grão AIH),
sih_internacoes e sih_procedimentos.

Uso:
    python sync_sih_mysql.py --competencia 2025-01 --json-out
    python sync_sih_mysql.py --competencia 2025-01 --pg-write
    python sync_sih_mysql.py --competencia 2025-01 --pg-write --reimportar
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import date

import pandas as pd
from dotenv import load_dotenv
from psycopg2.extras import execute_batch

from etl_db import mysql_configured, mysql_connect, pg_connect


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def competencia_para_date(competencia: str) -> date:
    try:
        ano, mes = competencia.split("-")
        return date(int(ano), int(mes), 1)
    except Exception:
        raise ValueError(
            f"Competência inválida: '{competencia}'. Use formato YYYY-MM."
        )


def _sih_env(name: str, default: str) -> str:
    return os.environ.get(name, default)


def _sih_batch_size() -> int:
    raw = _sih_env("SIH_PG_BATCH_SIZE", "1000")
    try:
        parsed = int(raw)
    except ValueError:
        return 1000
    return parsed if parsed > 0 else 1000


def _clean_str(value) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip()
    return s if s not in ("", "None", "nan") else None


def _total_proc_linhas(df_proc: pd.DataFrame) -> int:
    """Total de linhas brutas HPA (s_aih_pa), não o nº de grupos agregados."""
    if df_proc is None or df_proc.empty:
        return 0
    if "qtd_linhas" in df_proc.columns:
        return int(df_proc["qtd_linhas"].fillna(0).sum())
    return int(len(df_proc))


def _parse_yyyymmdd(value) -> date | None:
    """AAAAMMDD (s_aih.DT_INT/DT_SAIDA) -> date, ou None se vazio/inválido."""
    s = _clean_str(value)
    if not s or len(s) != 8 or not s.isdigit():
        return None
    try:
        return date(int(s[:4]), int(s[4:6]), int(s[6:8]))
    except ValueError:
        return None


def emit_sih_progress(
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
    print(
        f"SIH_PROGRESS {json.dumps(payload, ensure_ascii=False)}",
        file=sys.stderr,
        flush=True,
    )


# ---------------------------------------------------------------------------
# MySQL queries
# ---------------------------------------------------------------------------


def build_sih_query_internacoes() -> str:
    """
    Extração de s_aih com GROUP BY gerencial.

    Grão: COMPETENCIA × CNES × PROC_PRINCIPAL × DIAG_PRINCIPAL ×
          COMPLEXIDADE × FINANCIAMENTO × MOTIVO_SAIDA × SEXO_PACIENTE

    Notas:
    - Sem CAST: DIARIAS, DIARIAS_UTI, VALOR_TOTAL_AIH são int/decimal nativo.
    - FINANCIAMENTO = 2 chars → RUB_ID direto (não LEFT(…,4) como no SIA).
    - JOIN prestador usa COLLATE utf8mb4_unicode_ci (s_aih é unicode_ci).
    """
    table_aih = _sih_env("SIH_TABLE_AIH", "s_aih")
    table_prestador = _sih_env("SIH_TABLE_PRESTADOR", "prestador")
    col_cnes = _sih_env("SIH_COL_CNES", "re_cnome")

    return f"""
        SELECT
            sa.CNES                                            AS cnes,
            pr.{col_cnes}                                     AS unidade,
            sa.PROC_PRINCIPAL                                  AS proc_principal,
            sa.DIAG_PRINCIPAL                                  AS diag_principal,
            sa.COMPLEXIDADE                                    AS complexidade,
            sa.FINANCIAMENTO                                   AS financiamento,
            sa.MOTIVO_SAIDA                                    AS motivo_saida,
            sa.SEXO_PACIENTE                                   AS sexo,
            COUNT(DISTINCT sa.AIH)                             AS qtd_aih,
            SUM(sa.DIARIAS)                                    AS total_diarias,
            SUM(sa.DIARIAS_UTI)                                AS total_diarias_uti,
            SUM(sa.VALOR_TOTAL_AIH)                            AS total_valor,
            AVG(sa.IDADE)                                      AS media_idade,
            AVG(sa.DIARIAS)                                    AS media_diarias
        FROM {table_aih} sa
        LEFT JOIN {table_prestador} pr
            ON sa.CNES      COLLATE utf8mb4_unicode_ci
             = pr.re_cunid  COLLATE utf8mb4_unicode_ci
        WHERE sa.COMPETENCIA = %(comp)s
        GROUP BY
            sa.CNES, pr.{col_cnes},
            sa.PROC_PRINCIPAL, sa.DIAG_PRINCIPAL,
            sa.COMPLEXIDADE, sa.FINANCIAMENTO,
            sa.MOTIVO_SAIDA, sa.SEXO_PACIENTE
    """


def build_sih_query_aih_cabecalho() -> str:
    """
    Extração de s_aih no grão AIH (sem GROUP BY).

    Grão: AIH × CNES × COMPETENCIA — espelha uk_aih do MySQL.
    Usado em sih_aih (PG) para filtros analíticos (máscara no número AIH, etc.).
    """
    table_aih = _sih_env("SIH_TABLE_AIH", "s_aih")

    return f"""
        SELECT
            sa.AIH                                             AS aih,
            sa.CNES                                            AS cnes,
            sa.PROC_PRINCIPAL                                  AS proc_principal,
            sa.DIAG_PRINCIPAL                                  AS diag_principal,
            sa.DIAG_SECUNDARIO                                 AS diag_secundario,
            sa.CID_OBITO                                       AS cid_obito,
            sa.CARATER_INTERNACAO                              AS carater_internacao,
            sa.COMPLEXIDADE                                    AS complexidade,
            sa.FINANCIAMENTO                                   AS financiamento,
            sa.MOTIVO_SAIDA                                    AS motivo_saida,
            sa.SEXO_PACIENTE                                   AS sexo,
            sa.ESPECIALIDADE                                   AS especialidade,
            sa.IDADE                                           AS idade,
            sa.DT_INT                                          AS dt_internacao,
            sa.DT_SAIDA                                        AS dt_saida,
            sa.DIARIAS                                         AS diarias,
            sa.DIARIAS_UTI                                     AS diarias_uti,
            sa.VALOR_TOTAL_AIH                                 AS valor_total
        FROM {table_aih} sa
        WHERE sa.COMPETENCIA = %(comp)s
    """


def build_sih_query_procedimentos() -> str:
    """
    Extração de s_aih_pa com GROUP BY gerencial.

    Grão: COMPETENCIA × CNES × PROC_DETALHADO × CBO_PROFISSIONAL × FINANCIAMENTO_DETALHE

    Notas:
    - Sem CAST: QUANTIDADE, VALOR_ITEM são int/decimal nativo.
    - Sem JOIN com prestador — CNES já está em s_aih_pa.
    """
    table_pa = _sih_env("SIH_TABLE_AIH_PA", "s_aih_pa")

    return f"""
        SELECT
            sp.CNES                                            AS cnes,
            sp.PROC_DETALHADO                                  AS proc_detalhado,
            sp.CBO_PROFISSIONAL                                AS cbo_profissional,
            sp.FINANCIAMENTO_DETALHE                           AS financiamento_detalhe,
            COUNT(DISTINCT sp.AIH)                             AS qtd_aih_distintas,
            COUNT(*)                                           AS qtd_linhas,
            SUM(sp.QUANTIDADE)                                 AS total_quantidade,
            SUM(sp.VALOR_ITEM)                                 AS total_valor_item
        FROM {table_pa} sp
        WHERE sp.COMPETENCIA = %(comp)s
        GROUP BY
            sp.CNES, sp.PROC_DETALHADO,
            sp.CBO_PROFISSIONAL, sp.FINANCIAMENTO_DETALHE
    """


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------


def extrair_sih_internacoes(conn_mysql, competencia_date: date) -> pd.DataFrame:
    query = build_sih_query_internacoes()
    comp = competencia_date.strftime("%Y%m")
    return pd.read_sql(query, conn_mysql, params={"comp": comp})


def extrair_sih_procedimentos(conn_mysql, competencia_date: date) -> pd.DataFrame:
    query = build_sih_query_procedimentos()
    comp = competencia_date.strftime("%Y%m")
    return pd.read_sql(query, conn_mysql, params={"comp": comp})


def extrair_sih_aih(conn_mysql, competencia_date: date) -> pd.DataFrame:
    query = build_sih_query_aih_cabecalho()
    comp = competencia_date.strftime("%Y%m")
    return pd.read_sql(query, conn_mysql, params={"comp": comp})


# ---------------------------------------------------------------------------
# PG write
# ---------------------------------------------------------------------------


def _load_estab_map(conn_pg) -> dict[str, int]:
    with conn_pg.cursor() as cur:
        cur.execute(
            """
            SELECT codigo_externo, id
            FROM estabelecimentos
            WHERE codigo_externo IS NOT NULL
            """
        )
        rows = cur.fetchall()
    return {str(codigo).strip(): eid for codigo, eid in rows}


def gravar_sih_pg(
    conn_pg,
    df_int: pd.DataFrame,
    df_proc: pd.DataFrame,
    df_aih: pd.DataFrame,
    competencia_date: date,
    *,
    reimportar: bool = False,
    batch_size: int | None = None,
    exec_id: str | None = None,
) -> dict:
    """
    Grava cabeçalhos AIH (df_aih), internações agregadas (df_int) e
    procedimentos (df_proc) no PG.

    Cria/atualiza sih_sincronizacoes, deleta filhos se reimportar,
    insere em lotes com SAVEPOINT por chunk.
    """
    chunk_size = batch_size or _sih_batch_size()
    erros = 0
    first_error: str | None = None

    with conn_pg:
        with conn_pg.cursor() as cur:
            # 1. Upsert sync record → 'pendente'
            cur.execute(
                """
                INSERT INTO sih_sincronizacoes
                  (competencia, status, qtd_internacoes, qtd_procedimentos,
                   qtd_aih, orphan_cnes, erros)
                VALUES (%s, 'pendente', 0, 0, 0, 0, 0)
                ON CONFLICT (competencia) DO UPDATE SET
                    status            = 'pendente',
                    qtd_internacoes   = 0,
                    qtd_procedimentos = 0,
                    qtd_aih           = 0,
                    orphan_cnes       = 0,
                    erros             = 0,
                    sincronizado_em   = now()
                RETURNING id
                """,
                (competencia_date,),
            )
            sinc_id = cur.fetchone()[0]

            # 2. Limpar filhos se reimportação
            if reimportar:
                cur.execute(
                    "DELETE FROM sih_aih WHERE sincronizacao_id = %s",
                    (sinc_id,),
                )
                cur.execute(
                    "DELETE FROM sih_internacoes WHERE sincronizacao_id = %s",
                    (sinc_id,),
                )
                cur.execute(
                    "DELETE FROM sih_procedimentos WHERE sincronizacao_id = %s",
                    (sinc_id,),
                )

            # 3. Mapa CNES → estabelecimento_id (uma vez por run)
            estab_map = _load_estab_map(conn_pg)
            orphan_cnes = 0

            # ------------------------------------------------------------------
            # 4. Inserir sih_aih (grão AIH)
            # ------------------------------------------------------------------
            payload_aih: list[tuple] = []
            for _, row in df_aih.iterrows():
                cnes = _clean_str(row.get("cnes"))
                aih = _clean_str(row.get("aih"))
                if not aih or not cnes:
                    continue
                estab_id = estab_map.get(cnes) if cnes else None
                if cnes and estab_id is None:
                    orphan_cnes += 1

                idade_raw = row.get("idade")
                idade = int(idade_raw) if pd.notna(idade_raw) else None

                payload_aih.append((
                    sinc_id,
                    competencia_date,
                    aih,
                    cnes,
                    estab_id,
                    _clean_str(row.get("proc_principal")),
                    _clean_str(row.get("diag_principal")),
                    _clean_str(row.get("diag_secundario")),
                    _clean_str(row.get("cid_obito")),
                    _clean_str(row.get("carater_internacao")),
                    _clean_str(row.get("complexidade")),
                    _clean_str(row.get("financiamento")),
                    _clean_str(row.get("motivo_saida")),
                    _clean_str(row.get("sexo")),
                    _clean_str(row.get("especialidade")),
                    idade,
                    _parse_yyyymmdd(row.get("dt_internacao")),
                    _parse_yyyymmdd(row.get("dt_saida")),
                    int(row.get("diarias") or 0),
                    int(row.get("diarias_uti") or 0),
                    float(row.get("valor_total") or 0),
                ))

            insert_aih_sql = """
                INSERT INTO sih_aih (
                    sincronizacao_id, competencia, aih, cnes, estabelecimento_id,
                    proc_principal, diag_principal, diag_secundario, cid_obito,
                    carater_internacao, complexidade, financiamento,
                    motivo_saida, sexo, especialidade, idade,
                    dt_internacao, dt_saida,
                    diarias, diarias_uti, valor_total
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT DO NOTHING
            """

            if payload_aih:
                total_chunks_aih = max(1, (len(payload_aih) + chunk_size - 1) // chunk_size)
                for i in range(0, len(payload_aih), chunk_size):
                    chunk = payload_aih[i : i + chunk_size]
                    chunk_idx = (i // chunk_size) + 1
                    sp = f"sih_aih_{i // chunk_size}"
                    started = time.perf_counter()
                    cur.execute(f"SAVEPOINT {sp}")
                    try:
                        execute_batch(cur, insert_aih_sql, chunk)
                        cur.execute(f"RELEASE SAVEPOINT {sp}")
                        emit_sih_progress(
                            exec_id=exec_id,
                            stage="gravar_postgres",
                            event="insert_chunk",
                            message=f"sih_aih chunk {chunk_idx}/{total_chunks_aih}",
                            chunk_index=chunk_idx,
                            chunks_total=total_chunks_aih,
                            table="sih_aih",
                            rows_processed=len(chunk),
                            inserted_rows_total=min(i + len(chunk), len(payload_aih)),
                            duration_ms=int((time.perf_counter() - started) * 1000),
                        )
                    except Exception as exc:
                        erros += len(chunk)
                        if first_error is None:
                            first_error = str(exc)
                        cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
                        cur.execute(f"RELEASE SAVEPOINT {sp}")
                        emit_sih_progress(
                            exec_id=exec_id,
                            stage="gravar_postgres",
                            event="insert_chunk_error",
                            message=f"Falha sih_aih chunk {chunk_idx}/{total_chunks_aih}",
                            chunk_index=chunk_idx,
                            table="sih_aih",
                            error=str(exc),
                            duration_ms=int((time.perf_counter() - started) * 1000),
                        )

            # ------------------------------------------------------------------
            # 5. Inserir sih_internacoes
            # ------------------------------------------------------------------
            payload_int: list[tuple] = []
            for _, row in df_int.iterrows():
                cnes = _clean_str(row.get("cnes"))
                estab_id = estab_map.get(cnes) if cnes else None
                if cnes and estab_id is None:
                    orphan_cnes += 1

                payload_int.append((
                    sinc_id,
                    competencia_date,
                    cnes,
                    estab_id,
                    _clean_str(row.get("proc_principal")),
                    _clean_str(row.get("diag_principal")),
                    _clean_str(row.get("complexidade")),
                    _clean_str(row.get("financiamento")),
                    _clean_str(row.get("motivo_saida")),
                    _clean_str(row.get("sexo")),
                    int(row.get("qtd_aih") or 0),
                    int(row.get("total_diarias") or 0),
                    int(row.get("total_diarias_uti") or 0),
                    float(row.get("total_valor") or 0),
                    float(row["media_idade"]) if pd.notna(row.get("media_idade")) else None,
                    float(row["media_diarias"]) if pd.notna(row.get("media_diarias")) else None,
                ))

            insert_int_sql = """
                INSERT INTO sih_internacoes (
                    sincronizacao_id, competencia, cnes, estabelecimento_id,
                    proc_principal, diag_principal, complexidade, financiamento,
                    motivo_saida, sexo, qtd_aih, total_diarias, total_diarias_uti,
                    total_valor, media_idade, media_diarias
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT DO NOTHING
            """

            if payload_int:
                total_chunks_int = max(1, (len(payload_int) + chunk_size - 1) // chunk_size)
                for i in range(0, len(payload_int), chunk_size):
                    chunk = payload_int[i : i + chunk_size]
                    chunk_idx = (i // chunk_size) + 1
                    sp = f"sih_int_{i // chunk_size}"
                    started = time.perf_counter()
                    cur.execute(f"SAVEPOINT {sp}")
                    try:
                        execute_batch(cur, insert_int_sql, chunk)
                        cur.execute(f"RELEASE SAVEPOINT {sp}")
                        emit_sih_progress(
                            exec_id=exec_id,
                            stage="gravar_postgres",
                            event="insert_chunk",
                            message=f"internacoes chunk {chunk_idx}/{total_chunks_int}",
                            chunk_index=chunk_idx,
                            chunks_total=total_chunks_int,
                            table="sih_internacoes",
                            rows_processed=len(chunk),
                            inserted_rows_total=min(i + len(chunk), len(payload_int)),
                            duration_ms=int((time.perf_counter() - started) * 1000),
                        )
                    except Exception as exc:
                        erros += len(chunk)
                        if first_error is None:
                            first_error = str(exc)
                        cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
                        cur.execute(f"RELEASE SAVEPOINT {sp}")
                        emit_sih_progress(
                            exec_id=exec_id,
                            stage="gravar_postgres",
                            event="insert_chunk_error",
                            message=f"Falha internacoes chunk {chunk_idx}/{total_chunks_int}",
                            chunk_index=chunk_idx,
                            table="sih_internacoes",
                            error=str(exc),
                            duration_ms=int((time.perf_counter() - started) * 1000),
                        )

            # ------------------------------------------------------------------
            # 6. Inserir sih_procedimentos
            # ------------------------------------------------------------------
            payload_proc: list[tuple] = []
            for _, row in df_proc.iterrows():
                cnes = _clean_str(row.get("cnes"))
                estab_id = estab_map.get(cnes) if cnes else None

                payload_proc.append((
                    sinc_id,
                    competencia_date,
                    cnes,
                    estab_id,
                    _clean_str(row.get("proc_detalhado")),
                    _clean_str(row.get("cbo_profissional")),
                    _clean_str(row.get("financiamento_detalhe")),
                    int(row.get("qtd_aih_distintas") or 0),
                    int(row.get("total_quantidade") or 0),
                    float(row.get("total_valor_item") or 0),
                    int(row.get("qtd_linhas") or 0),
                ))

            insert_proc_sql = """
                INSERT INTO sih_procedimentos (
                    sincronizacao_id, competencia, cnes, estabelecimento_id,
                    proc_detalhado, cbo_profissional, financiamento_detalhe,
                    qtd_aih_distintas, total_quantidade, total_valor_item, qtd_linhas
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT DO NOTHING
            """

            if payload_proc:
                total_chunks_proc = max(1, (len(payload_proc) + chunk_size - 1) // chunk_size)
                for i in range(0, len(payload_proc), chunk_size):
                    chunk = payload_proc[i : i + chunk_size]
                    chunk_idx = (i // chunk_size) + 1
                    sp = f"sih_proc_{i // chunk_size}"
                    started = time.perf_counter()
                    cur.execute(f"SAVEPOINT {sp}")
                    try:
                        execute_batch(cur, insert_proc_sql, chunk)
                        cur.execute(f"RELEASE SAVEPOINT {sp}")
                        emit_sih_progress(
                            exec_id=exec_id,
                            stage="gravar_postgres",
                            event="insert_chunk",
                            message=f"procedimentos chunk {chunk_idx}/{total_chunks_proc}",
                            chunk_index=chunk_idx,
                            chunks_total=total_chunks_proc,
                            table="sih_procedimentos",
                            rows_processed=len(chunk),
                            inserted_rows_total=min(i + len(chunk), len(payload_proc)),
                            duration_ms=int((time.perf_counter() - started) * 1000),
                        )
                    except Exception as exc:
                        erros += len(chunk)
                        if first_error is None:
                            first_error = str(exc)
                        cur.execute(f"ROLLBACK TO SAVEPOINT {sp}")
                        cur.execute(f"RELEASE SAVEPOINT {sp}")
                        emit_sih_progress(
                            exec_id=exec_id,
                            stage="gravar_postgres",
                            event="insert_chunk_error",
                            message=f"Falha procedimentos chunk {chunk_idx}/{total_chunks_proc}",
                            chunk_index=chunk_idx,
                            table="sih_procedimentos",
                            error=str(exc),
                            duration_ms=int((time.perf_counter() - started) * 1000),
                        )

            # ------------------------------------------------------------------
            # 7. Atualizar sync record
            # ------------------------------------------------------------------
            total_rows = len(payload_aih) + len(payload_int) + len(payload_proc)
            if total_rows == 0:
                status = "parcial"
            elif erros == 0:
                status = "ok"
            elif erros < total_rows:
                status = "parcial"
            else:
                status = "erro"

            cur.execute(
                """
                UPDATE sih_sincronizacoes SET
                    status            = %s,
                    qtd_internacoes   = %s,
                    qtd_procedimentos = %s,
                    qtd_aih           = %s,
                    orphan_cnes       = %s,
                    erros             = %s,
                    sincronizado_em   = now()
                WHERE id = %s
                """,
                (status, len(df_int), _total_proc_linhas(df_proc), len(df_aih), orphan_cnes, erros, sinc_id),
            )

    result: dict = {
        "sincronizacao_id": sinc_id,
        "competencia": str(competencia_date),
        "status": status,
        "qtd_aih": len(df_aih),
        "qtd_internacoes": len(df_int),
        "qtd_procedimentos": _total_proc_linhas(df_proc),
        "orphan_cnes": orphan_cnes,
        "erros": erros,
    }
    if first_error:
        result["error"] = first_error
    return result


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------


def sincronizar(
    competencia: str,
    *,
    pg_write: bool,
    reimportar: bool = False,
    exec_id: str | None = None,
) -> dict:
    emit_sih_progress(
        exec_id=exec_id,
        stage="iniciando",
        event="sync_started",
        message="Iniciando sincronização SIHD",
        competencia=competencia,
    )

    if not mysql_configured():
        emit_sih_progress(
            exec_id=exec_id,
            stage="erro",
            event="mysql_unavailable",
            message="MySQL/XAMPP indisponível",
        )
        return {
            "competencia": competencia,
            "qtd_internacoes": 0,
            "qtd_procedimentos": 0,
            "qtd_aih": 0,
            "orphan_cnes": 0,
            "erros": 0,
            "status": "erro",
            "error": "SIH_MYSQL_UNAVAILABLE",
        }

    competencia_date = competencia_para_date(competencia)

    # --- Dry-run (--json-out) ---
    if not pg_write:
        conn_mysql = mysql_connect()
        try:
            emit_sih_progress(
                exec_id=exec_id,
                stage="extracao_mysql",
                event="preview_started",
                message="Extraindo prévia do MySQL (internações)",
            )
            df_int = extrair_sih_internacoes(conn_mysql, competencia_date)
            emit_sih_progress(
                exec_id=exec_id,
                stage="extracao_mysql",
                event="preview_started",
                message="Extraindo prévia do MySQL (cabeçalhos AIH)",
            )
            df_aih = extrair_sih_aih(conn_mysql, competencia_date)
            emit_sih_progress(
                exec_id=exec_id,
                stage="extracao_mysql",
                event="preview_started",
                message="Extraindo prévia do MySQL (procedimentos)",
            )
            df_proc = extrair_sih_procedimentos(conn_mysql, competencia_date)
        except Exception as exc:
            emit_sih_progress(
                exec_id=exec_id,
                stage="erro",
                event="extract_error",
                message=str(exc),
            )
            return {
                "competencia": competencia,
                "qtd_internacoes": 0,
                "qtd_procedimentos": 0,
                "orphan_cnes": 0,
                "erros": 1,
                "status": "erro",
                "error": str(exc),
            }
        finally:
            conn_mysql.close()

        return {
            "competencia": competencia,
            "status": "ok" if (len(df_int) or len(df_proc) or len(df_aih)) else "parcial",
            "qtd_aih": len(df_aih),
            "qtd_internacoes": len(df_int),
            "qtd_procedimentos": _total_proc_linhas(df_proc),
            "orphan_cnes": 0,
            "erros": 0,
            "linhas_mysql_raw": len(df_int) + len(df_proc) + len(df_aih),
            "preview_aih": df_aih.head(10).replace({pd.NA: None}).to_dict("records"),
            "preview_internacoes": df_int.head(10).replace({pd.NA: None}).to_dict("records"),
            "preview_procedimentos": df_proc.head(10).replace({pd.NA: None}).to_dict("records"),
        }

    # --- Full write ---
    conn_mysql = mysql_connect()
    try:
        emit_sih_progress(
            exec_id=exec_id,
            stage="extracao_mysql",
            event="extract_started",
            message="Extraindo internações (s_aih)",
        )
        df_int = extrair_sih_internacoes(conn_mysql, competencia_date)
        emit_sih_progress(
            exec_id=exec_id,
            stage="extracao_mysql",
            event="extract_block",
            message="s_aih agregado extraído",
            block_rows=len(df_int),
        )

        emit_sih_progress(
            exec_id=exec_id,
            stage="extracao_mysql",
            event="extract_started",
            message="Extraindo cabeçalhos AIH (s_aih grão AIH)",
        )
        df_aih = extrair_sih_aih(conn_mysql, competencia_date)
        emit_sih_progress(
            exec_id=exec_id,
            stage="extracao_mysql",
            event="extract_block",
            message="s_aih cabeçalho extraído",
            block_rows=len(df_aih),
        )

        emit_sih_progress(
            exec_id=exec_id,
            stage="extracao_mysql",
            event="extract_started",
            message="Extraindo procedimentos (s_aih_pa)",
        )
        df_proc = extrair_sih_procedimentos(conn_mysql, competencia_date)
        emit_sih_progress(
            exec_id=exec_id,
            stage="extracao_mysql",
            event="extract_finished",
            message="s_aih_pa extraído",
            block_rows=len(df_proc),
        )
    except Exception as exc:
        emit_sih_progress(
            exec_id=exec_id,
            stage="erro",
            event="extract_error",
            message=str(exc),
        )
        return {
            "competencia": competencia,
            "qtd_internacoes": 0,
            "qtd_procedimentos": 0,
            "qtd_aih": 0,
            "orphan_cnes": 0,
            "erros": 1,
            "status": "erro",
            "error": str(exc),
        }
    finally:
        conn_mysql.close()

    linhas_mysql_raw = len(df_int) + len(df_proc) + len(df_aih)

    conn_pg = pg_connect()
    try:
        emit_sih_progress(
            exec_id=exec_id,
            stage="gravar_postgres",
            event="insert_started",
            message="Iniciando gravação no PostgreSQL",
            qtd_aih=len(df_aih),
            qtd_internacoes=len(df_int),
            qtd_procedimentos=_total_proc_linhas(df_proc),
        )
        result = gravar_sih_pg(
            conn_pg,
            df_int,
            df_proc,
            df_aih,
            competencia_date,
            reimportar=reimportar,
            exec_id=exec_id,
        )
    finally:
        conn_pg.close()

    result["linhas_mysql_raw"] = linhas_mysql_raw
    return result


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="SIMPA — Sync SIHD MySQL -> PostgreSQL")
    parser.add_argument("--competencia", help="Competência YYYY-MM (obrigatório)")
    parser.add_argument(
        "--json-out",
        action="store_true",
        help="Imprime resultado JSON no stdout (dry-run)",
    )
    parser.add_argument(
        "--pg-write",
        action="store_true",
        help="Grava em sih_sincronizacoes + sih_aih + sih_internacoes + sih_procedimentos",
    )
    parser.add_argument(
        "--reimportar",
        action="store_true",
        help="Força reimportação — DELETE filhos e reinsere",
    )
    parser.add_argument("--exec-id", help="Identificador de execução para telemetria")
    args = parser.parse_args()

    if not args.json_out and not args.pg_write:
        print("Erro: use --json-out ou --pg-write", file=sys.stderr)
        sys.exit(1)

    if not args.competencia:
        parser.error("Informe --competencia YYYY-MM")

    load_dotenv()

    print(f"Sincronizando SIHD {args.competencia}...", file=sys.stderr)
    result = sincronizar(
        args.competencia,
        pg_write=args.pg_write,
        reimportar=args.reimportar,
        exec_id=args.exec_id,
    )
    print(
        f"  {result['status']} — "
        f"{result.get('qtd_aih', 0)} AIH, "
        f"{result.get('qtd_internacoes', 0)} internações, "
        f"{result.get('qtd_procedimentos', 0)} procedimentos, "
        f"{result.get('erros', 0)} erros",
        file=sys.stderr,
    )
    print(json.dumps([result], ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
