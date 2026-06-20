#!/usr/bin/env python3
"""
SIMPA — Conector cadastros: MySQL/XAMPP -> PostgreSQL
=====================================================

Espelha prestador e procedimento (somente leitura MySQL) em estabelecimentos
e procedimentos PostgreSQL. Preserva enriquecimento JSONB no re-sync.

Uso:
    python sync_cadastros_mysql.py --dry-run
    python sync_cadastros_mysql.py --pg-write
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any

import pandas as pd
from dotenv import load_dotenv

from etl_db import mysql_configured, mysql_connect, pg_connect

DEFAULT_PERFIL_MAP: dict[str, Any] = {
    "tipouni": {"1": "APS", "2": "MAC", "3": "Hospitalar"},
    "default": "Outro",
}

COUNT_TEMPLATE = {"inserted": 0, "updated": 0, "inactivated": 0}

UPSERT_ESTABELECIMENTO_SQL = """
    INSERT INTO estabelecimentos (
        codigo_externo, nome, cnpj, re_tipo, tipouni, perfil, perfil_editado,
        area, relatorio, status, sincronizado_em
    ) VALUES (
        %(codigo_externo)s, %(nome)s, %(cnpj)s, %(re_tipo)s, %(tipouni)s, %(perfil)s, false,
        %(area)s, %(relatorio)s, %(status)s, %(sincronizado_em)s
    )
    ON CONFLICT (codigo_externo) DO UPDATE SET
        nome = EXCLUDED.nome,
        cnpj = EXCLUDED.cnpj,
        re_tipo = EXCLUDED.re_tipo,
        tipouni = EXCLUDED.tipouni,
        perfil = CASE
            WHEN estabelecimentos.perfil_editado THEN estabelecimentos.perfil
            ELSE EXCLUDED.perfil
        END,
        area = EXCLUDED.area,
        relatorio = EXCLUDED.relatorio,
        status = EXCLUDED.status,
        sincronizado_em = EXCLUDED.sincronizado_em
"""

UPSERT_PROCEDIMENTO_SQL = """
    INSERT INTO procedimentos (
        codigo_sigtap, descricao, pa_total, rubrica, pa_id, financiamento,
        sincronizado_em, fonte, status
    ) VALUES (
        %(codigo_sigtap)s, %(descricao)s, %(pa_total)s, %(rubrica)s, %(pa_id)s,
        %(financiamento)s, %(sincronizado_em)s, 'mysql_sync', %(status)s
    )
    ON CONFLICT (codigo_sigtap) DO UPDATE SET
        descricao = EXCLUDED.descricao,
        pa_total = EXCLUDED.pa_total,
        rubrica = EXCLUDED.rubrica,
        pa_id = EXCLUDED.pa_id,
        financiamento = EXCLUDED.financiamento,
        sincronizado_em = EXCLUDED.sincronizado_em,
        fonte = 'mysql_sync',
        status = EXCLUDED.status
"""


def _cadastro_env(name: str, default: str) -> str:
    return os.environ.get(name, default)


def build_cadastro_config() -> dict[str, str]:
    """Column/table names — reuses SIA env overrides where applicable."""
    return {
        "table_prest": _cadastro_env("SIA_TABLE_PRESTADOR", "prestador"),
        "table_proc": _cadastro_env("SIA_TABLE_PROCEDIMENTO", "procedimento"),
        "col_prest_pk": _cadastro_env("SIA_COL_PRESTADOR_PK", "re_cunid"),
        "col_nome": _cadastro_env("SIA_COL_UNIDADE", "re_cnome"),
        "col_re_tipo": _cadastro_env("SIA_COL_PRESTADOR_TIPO", "re_tipo"),
        "col_cnpj": _cadastro_env("SIA_COL_PRESTADOR_CNPJ", "cnpj"),
        "col_area": _cadastro_env("SIA_COL_PRESTADOR_AREA", "area"),
        "col_tipouni": _cadastro_env("SIA_COL_PRESTADOR_TIPOUNI", "tipouni"),
        "col_relatorio": _cadastro_env("SIA_COL_PRESTADOR_RELATORIO", "relatorio"),
        "col_prest_ativo": _cadastro_env("SIA_COL_PRESTADOR_ATIVO", "ativo"),
        "col_proc_pk": _cadastro_env("SIA_COL_PROC_PK", "codigo"),
        "col_desc": _cadastro_env("SIA_COL_DESC_PROC", "procedimento"),
        "col_pa_total": _cadastro_env("SIA_COL_PROC_PA_TOTAL", "PA_TOTAL"),
        "col_rubrica": _cadastro_env("SIA_COL_PROC_RUBRICA", "RUB_TOTAL"),
        "col_pa_id": _cadastro_env("SIA_COL_PROC_PA_ID", "PA_ID"),
        "col_financiamento": _cadastro_env("SIA_COL_PROC_FINANCIAMENTO", "FINANCIAMENTO"),
    }


def build_prestador_query(cfg: dict[str, str] | None = None) -> str:
    cfg = cfg or build_cadastro_config()
    return f"""
        SELECT
            p.{cfg['col_prest_pk']} AS codigo_externo,
            p.{cfg['col_nome']} AS nome,
            p.{cfg['col_cnpj']} AS cnpj,
            p.{cfg['col_re_tipo']} AS re_tipo,
            p.{cfg['col_tipouni']} AS tipouni,
            p.{cfg['col_area']} AS area,
            p.{cfg['col_relatorio']} AS relatorio,
            p.{cfg['col_prest_ativo']} AS ativo
        FROM {cfg['table_prest']} p
    """


def build_procedimento_query(cfg: dict[str, str] | None = None) -> str:
    cfg = cfg or build_cadastro_config()
    return f"""
        SELECT
            proc.{cfg['col_proc_pk']} AS codigo_sigtap,
            proc.{cfg['col_desc']} AS descricao,
            proc.{cfg['col_pa_total']} AS pa_total,
            proc.{cfg['col_rubrica']} AS rubrica,
            proc.{cfg['col_pa_id']} AS pa_id,
            proc.{cfg['col_financiamento']} AS financiamento
        FROM {cfg['table_proc']} proc
    """


def load_perfil_map() -> dict[str, Any]:
    raw = os.environ.get("CADASTRO_PERFIL_MAP")
    if not raw:
        return dict(DEFAULT_PERFIL_MAP)
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise ValueError("CADASTRO_PERFIL_MAP must be a JSON object")
        return parsed
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid CADASTRO_PERFIL_MAP JSON: {exc}") from exc


def derive_perfil(tipouni: Any, perfil_map: dict[str, Any] | None = None) -> str:
    perfil_map = perfil_map or load_perfil_map()
    tipouni_map = perfil_map.get("tipouni") or {}
    default = perfil_map.get("default", "Outro")
    if tipouni is None or (isinstance(tipouni, float) and pd.isna(tipouni)):
        return default
    key = str(tipouni).strip()
    return tipouni_map.get(key, default)


def map_ativo_to_status(ativo: Any) -> str:
    if ativo is None or (isinstance(ativo, float) and pd.isna(ativo)):
        return "ativo"
    try:
        return "ativo" if int(ativo) == 1 else "inativo"
    except (TypeError, ValueError):
        return "ativo"


def _clean_str(value: Any, *, max_len: int | None = None) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none"}:
        return None
    if max_len is not None:
        return text[:max_len]
    return text


def normalize_prestador_row(
    row: dict[str, Any],
    perfil_map: dict[str, Any] | None = None,
    sync_ts: datetime | None = None,
) -> dict[str, Any]:
    sync_ts = sync_ts or datetime.now(timezone.utc)
    codigo = _clean_str(row.get("codigo_externo"), max_len=20)
    nome = _clean_str(row.get("nome"), max_len=200)
    if not codigo or not nome:
        raise ValueError("prestador row missing codigo_externo or nome")

    tipouni = _clean_str(row.get("tipouni"), max_len=1)
    re_tipo = _clean_str(row.get("re_tipo"), max_len=1)

    area_raw = row.get("area")
    area = None
    if area_raw is not None and not (isinstance(area_raw, float) and pd.isna(area_raw)):
        try:
            area = int(area_raw)
        except (TypeError, ValueError):
            area = None

    return {
        "codigo_externo": codigo,
        "nome": nome,
        "cnpj": _clean_str(row.get("cnpj"), max_len=14),
        "re_tipo": re_tipo,
        "tipouni": tipouni,
        "perfil": derive_perfil(tipouni, perfil_map),
        "area": area,
        "relatorio": _clean_str(row.get("relatorio"), max_len=40),
        "status": map_ativo_to_status(row.get("ativo")),
        "sincronizado_em": sync_ts,
    }


def normalize_procedimento_row(
    row: dict[str, Any],
    sync_ts: datetime | None = None,
) -> dict[str, Any]:
    sync_ts = sync_ts or datetime.now(timezone.utc)
    codigo = _clean_str(row.get("codigo_sigtap"), max_len=20)
    descricao = _clean_str(row.get("descricao"), max_len=300)
    if not codigo or not descricao:
        raise ValueError("procedimento row missing codigo_sigtap or descricao")

    pa_total = row.get("pa_total")
    if pa_total is not None and not (isinstance(pa_total, float) and pd.isna(pa_total)):
        pa_total = float(pa_total)
    else:
        pa_total = None

    return {
        "codigo_sigtap": codigo,
        "descricao": descricao,
        "pa_total": pa_total,
        "rubrica": _clean_str(row.get("rubrica"), max_len=4),
        "pa_id": _clean_str(row.get("pa_id"), max_len=9),
        "financiamento": _clean_str(row.get("financiamento"), max_len=60),
        "status": "ativo",
        "sincronizado_em": sync_ts,
    }


def extrair_prestadores(conn_mysql, cfg: dict[str, str] | None = None) -> list[dict[str, Any]]:
    query = build_prestador_query(cfg)
    df = pd.read_sql(query, conn_mysql)
    return df.replace({pd.NA: None}).to_dict(orient="records")


def extrair_procedimentos(conn_mysql, cfg: dict[str, str] | None = None) -> list[dict[str, Any]]:
    query = build_procedimento_query(cfg)
    df = pd.read_sql(query, conn_mysql)
    return df.replace({pd.NA: None}).to_dict(orient="records")


def _fetch_key_set(cur, table: str, key_col: str, where: str = "") -> set[str]:
    sql = f"SELECT {key_col} FROM {table}"
    if where:
        sql += f" WHERE {where}"
    cur.execute(sql)
    return {str(row[0]) for row in cur.fetchall() if row[0] is not None}


def _count_upserts(rows: list[dict[str, Any]], existing: set[str], key_col: str) -> tuple[int, int]:
    inserted = 0
    updated = 0
    seen: set[str] = set()
    for row in rows:
        key = str(row[key_col])
        if key in seen:
            continue
        seen.add(key)
        if key in existing:
            updated += 1
        else:
            inserted += 1
    return inserted, updated


def _inactivate_estabelecimentos(cur, snapshot_keys: set[str], pg_write: bool) -> int:
    if not snapshot_keys:
        cur.execute(
            """
            SELECT codigo_externo FROM estabelecimentos
            WHERE status = 'ativo'
            """
        )
    else:
        cur.execute(
            """
            SELECT codigo_externo FROM estabelecimentos
            WHERE status = 'ativo' AND codigo_externo NOT IN %s
            """,
            (tuple(snapshot_keys),),
        )
    to_inactivate = [row[0] for row in cur.fetchall()]
    if pg_write and to_inactivate:
        cur.execute(
            """
            UPDATE estabelecimentos
            SET status = 'inativo'
            WHERE codigo_externo = ANY(%s)
            """,
            (to_inactivate,),
        )
    return len(to_inactivate)


def _inactivate_procedimentos(cur, snapshot_keys: set[str], pg_write: bool) -> int:
    if not snapshot_keys:
        cur.execute(
            """
            SELECT codigo_sigtap FROM procedimentos
            WHERE fonte = 'mysql_sync' AND status = 'ativo'
            """
        )
    else:
        cur.execute(
            """
            SELECT codigo_sigtap FROM procedimentos
            WHERE fonte = 'mysql_sync' AND status = 'ativo'
              AND codigo_sigtap NOT IN %s
            """,
            (tuple(snapshot_keys),),
        )
    to_inactivate = [row[0] for row in cur.fetchall()]
    if pg_write and to_inactivate:
        cur.execute(
            """
            UPDATE procedimentos
            SET status = 'inativo'
            WHERE codigo_sigtap = ANY(%s)
            """,
            (to_inactivate,),
        )
    return len(to_inactivate)


def _fetch_preserved_perfil_candidates(cur, codigos: set[str]) -> dict[str, str]:
    if not codigos:
        return {}
    cur.execute(
        """
        SELECT codigo_externo, perfil
        FROM estabelecimentos
        WHERE codigo_externo = ANY(%s) AND perfil_editado = true
        """,
        (list(codigos),),
    )
    return {row[0]: row[1] for row in cur.fetchall()}


def sync_estabelecimentos(
    conn_pg,
    rows: list[dict[str, Any]],
    *,
    pg_write: bool,
) -> dict[str, int]:
    counts = dict(COUNT_TEMPLATE)
    snapshot_keys = {row["codigo_externo"] for row in rows}

    with conn_pg.cursor() as cur:
        existing = _fetch_key_set(cur, "estabelecimentos", "codigo_externo")
        inserted, updated = _count_upserts(rows, existing, "codigo_externo")
        counts["inserted"] = inserted
        counts["updated"] = updated

        preserved_candidates = _fetch_preserved_perfil_candidates(cur, snapshot_keys)
        perfil_preserved = sum(
            1
            for row in rows
            if row["codigo_externo"] in preserved_candidates
            and row["perfil"] != preserved_candidates[row["codigo_externo"]]
        )
        counts["perfil_preserved"] = perfil_preserved

        if pg_write:
            for row in rows:
                cur.execute(UPSERT_ESTABELECIMENTO_SQL, row)

        counts["inactivated"] = _inactivate_estabelecimentos(cur, snapshot_keys, pg_write)

    return counts


def sync_procedimentos(
    conn_pg,
    rows: list[dict[str, Any]],
    *,
    pg_write: bool,
) -> dict[str, int]:
    counts = dict(COUNT_TEMPLATE)
    snapshot_keys = {row["codigo_sigtap"] for row in rows}

    with conn_pg.cursor() as cur:
        existing = _fetch_key_set(cur, "procedimentos", "codigo_sigtap")
        inserted, updated = _count_upserts(rows, existing, "codigo_sigtap")
        counts["inserted"] = inserted
        counts["updated"] = updated

        if pg_write:
            for row in rows:
                cur.execute(UPSERT_PROCEDIMENTO_SQL, row)

        counts["inactivated"] = _inactivate_procedimentos(cur, snapshot_keys, pg_write)

    return counts


def insert_sync_audit(conn_pg, result: dict[str, Any]) -> None:
    estab = result.get("estabelecimentos", COUNT_TEMPLATE)
    proc = result.get("procedimentos", COUNT_TEMPLATE)
    with conn_pg.cursor() as cur:
        cur.execute(
            """
            INSERT INTO cadastros_sincronizacoes (
                status, estab_inseridos, estab_atualizados, estab_inativados,
                proc_inseridos, proc_atualizados, proc_inativados, erro
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                result.get("status", "ok"),
                estab.get("inserted", 0),
                estab.get("updated", 0),
                estab.get("inactivated", 0),
                proc.get("inserted", 0),
                proc.get("updated", 0),
                proc.get("inactivated", 0),
                result.get("error"),
            ),
        )


def _error_result(error: str) -> dict[str, Any]:
    return {
        "status": "erro",
        "error": error,
        "estabelecimentos": dict(COUNT_TEMPLATE),
        "procedimentos": dict(COUNT_TEMPLATE),
    }


def _persist_audit_if_writing(pg_write: bool, result: dict[str, Any]) -> None:
    if not pg_write:
        return
    conn_pg = pg_connect()
    try:
        insert_sync_audit(conn_pg, result)
        conn_pg.commit()
    finally:
        conn_pg.close()


def sincronizar(*, pg_write: bool = False, dry_run: bool = False) -> dict[str, Any]:
    if pg_write and dry_run:
        raise ValueError("Use apenas --pg-write ou --dry-run, não ambos")

    if not mysql_configured():
        result = _error_result("MySQL_XAMPP_UNAVAILABLE")
        _persist_audit_if_writing(pg_write, result)
        return result

    cfg = build_cadastro_config()
    perfil_map = load_perfil_map()
    sync_ts = datetime.now(timezone.utc)

    conn_mysql = mysql_connect()
    try:
        raw_prest = extrair_prestadores(conn_mysql, cfg)
        raw_proc = extrair_procedimentos(conn_mysql, cfg)
    except Exception as exc:
        result = _error_result(str(exc))
        _persist_audit_if_writing(pg_write, result)
        return result
    finally:
        conn_mysql.close()

    prestadores: list[dict[str, Any]] = []
    skipped_estab = 0
    for row in raw_prest:
        try:
            prestadores.append(normalize_prestador_row(row, perfil_map, sync_ts))
        except ValueError:
            skipped_estab += 1
            continue

    procedimentos: list[dict[str, Any]] = []
    skipped_proc = 0
    for row in raw_proc:
        try:
            procedimentos.append(normalize_procedimento_row(row, sync_ts))
        except ValueError:
            skipped_proc += 1
            continue

    conn_pg = pg_connect()
    try:
        estab_counts = sync_estabelecimentos(conn_pg, prestadores, pg_write=pg_write)
        proc_counts = sync_procedimentos(conn_pg, procedimentos, pg_write=pg_write)

        skipped_total = skipped_estab + skipped_proc
        status = "parcial" if skipped_total else "ok"
        result: dict[str, Any] = {
            "status": status,
            "estabelecimentos": estab_counts,
            "procedimentos": proc_counts,
            "sincronizado_em": sync_ts.isoformat(),
        }
        if skipped_total:
            result["skipped"] = {
                "estabelecimentos": skipped_estab,
                "procedimentos": skipped_proc,
            }
            result["error"] = (
                f"{skipped_total} registro(s) ignorado(s) por dados inválidos no MySQL"
            )

        if pg_write:
            insert_sync_audit(conn_pg, result)
            conn_pg.commit()
        else:
            conn_pg.rollback()

        return result
    except Exception:
        conn_pg.rollback()
        raise
    finally:
        conn_pg.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="SIMPA — Sync cadastros MySQL -> PostgreSQL")
    parser.add_argument(
        "--pg-write",
        action="store_true",
        help="Grava em estabelecimentos + procedimentos + cadastros_sincronizacoes",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Calcula contagens sem gravar no PostgreSQL",
    )
    args = parser.parse_args()

    if not args.pg_write and not args.dry_run:
        print("Erro: use --dry-run ou --pg-write", file=sys.stderr)
        sys.exit(1)

    load_dotenv()

    try:
        result = sincronizar(pg_write=args.pg_write, dry_run=args.dry_run)
    except Exception as exc:
        result = _error_result(str(exc))

    print(json.dumps(result, ensure_ascii=False, default=str))

    if result.get("status") == "erro":
        sys.exit(1)


if __name__ == "__main__":
    main()
