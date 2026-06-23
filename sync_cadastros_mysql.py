#!/usr/bin/env python3
"""
SIMPA — Conector cadastros: MySQL/XAMPP -> PostgreSQL
=====================================================

Espelha prestador, procedimento, forma e cbo (somente leitura MySQL) em
estabelecimentos, procedimentos, formas_sia e cbos_sia PostgreSQL.
Preserva enriquecimento JSONB no re-sync.

Uso:
    python sync_cadastros_mysql.py --dry-run
    python sync_cadastros_mysql.py --pg-write
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import warnings
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

import pandas as pd
from dotenv import load_dotenv

from etl_db import mysql_configured, mysql_connect, pg_connect

DEFAULT_PERFIL_MAP: dict[str, Any] = {
    "tipouni": {"1": "APS", "2": "MAC", "3": "Hospitalar"},
    "default": "Outro",
}

DEFAULT_SNAPSHOT_MIN_RATIO = 0.25

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

UPSERT_FORMA_SQL = """
    INSERT INTO formas_sia (
        codigo_grupo, codigo_subgrupo, codigo_forma, descricao, status, sincronizado_em
    ) VALUES (
        %(codigo_grupo)s, %(codigo_subgrupo)s, %(codigo_forma)s, %(descricao)s,
        %(status)s, %(sincronizado_em)s
    )
    ON CONFLICT (codigo_forma) DO UPDATE SET
        codigo_grupo = EXCLUDED.codigo_grupo,
        codigo_subgrupo = EXCLUDED.codigo_subgrupo,
        descricao = EXCLUDED.descricao,
        status = EXCLUDED.status,
        sincronizado_em = EXCLUDED.sincronizado_em
"""

UPSERT_CBO_SQL = """
    INSERT INTO cbos_sia (
        codigo_cbo, descricao, status, sincronizado_em
    ) VALUES (
        %(codigo_cbo)s, %(descricao)s, %(status)s, %(sincronizado_em)s
    )
    ON CONFLICT (codigo_cbo) DO UPDATE SET
        descricao = EXCLUDED.descricao,
        status = EXCLUDED.status,
        sincronizado_em = EXCLUDED.sincronizado_em
"""

UPSERT_RUBRICA_SQL = """
    INSERT INTO rubricas_sia (
        codigo_rubrica, descricao, status, sincronizado_em
    ) VALUES (
        %(codigo_rubrica)s, %(descricao)s, %(status)s, %(sincronizado_em)s
    )
    ON CONFLICT (codigo_rubrica) DO UPDATE SET
        descricao = EXCLUDED.descricao,
        status = EXCLUDED.status,
        sincronizado_em = EXCLUDED.sincronizado_em
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
        "table_forma": _cadastro_env("SIA_TABLE_FORMA", "forma"),
        "table_cbo": _cadastro_env("SIA_TABLE_CBO", "cbo"),
        "table_rubrica": _cadastro_env("SIA_TABLE_RUBRICA", "s_rub"),
        "col_forma_grupo": _cadastro_env("SIA_COL_FORMA_GRUPO", "grupo"),
        "col_forma_subgrupo": _cadastro_env("SIA_COL_FORMA_SUBGRUPO", "subgrupo"),
        "col_forma_codigo": _cadastro_env("SIA_COL_FORMA_CODIGO", "forma"),
        "col_forma_desc": _cadastro_env("SIA_COL_FORMA_DESC", "descricao"),
        "col_cbo_codigo": _cadastro_env("SIA_COL_CBO_CODIGO", "CBO"),
        "col_cbo_desc": _cadastro_env("SIA_COL_CBO_DESC", "DS_CBO"),
        "col_rubrica_codigo": _cadastro_env("SIA_COL_RUBRICA_CODIGO", "RUB_ID"),
        "col_rubrica_desc": _cadastro_env("SIA_COL_RUBRICA_DESC", "RUB_DC"),
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


def build_forma_query(cfg: dict[str, str] | None = None) -> str:
    cfg = cfg or build_cadastro_config()
    return f"""
        SELECT
            f.{cfg['col_forma_grupo']} AS codigo_grupo,
            f.{cfg['col_forma_subgrupo']} AS codigo_subgrupo,
            f.{cfg['col_forma_codigo']} AS codigo_forma,
            f.{cfg['col_forma_desc']} AS descricao
        FROM {cfg['table_forma']} f
    """


def build_cbo_query(cfg: dict[str, str] | None = None) -> str:
    cfg = cfg or build_cadastro_config()
    return f"""
        SELECT
            c.{cfg['col_cbo_codigo']} AS codigo_cbo,
            c.{cfg['col_cbo_desc']} AS descricao
        FROM {cfg['table_cbo']} c
    """


def build_rubrica_query(cfg: dict[str, str] | None = None) -> str:
    cfg = cfg or build_cadastro_config()
    return f"""
        SELECT
            r.{cfg['col_rubrica_codigo']} AS codigo_rubrica,
            r.{cfg['col_rubrica_desc']} AS descricao
        FROM {cfg['table_rubrica']} r
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


def load_snapshot_min_ratio() -> float:
    """Minimum snapshot/active ratio required before mass inactivation (default 25%)."""
    raw = os.environ.get("CADASTRO_SNAPSHOT_MIN_RATIO")
    if raw is None:
        return DEFAULT_SNAPSHOT_MIN_RATIO
    try:
        ratio = float(raw)
    except ValueError as exc:
        raise ValueError(
            f"Invalid CADASTRO_SNAPSHOT_MIN_RATIO: {raw!r} (expected float between 0 and 1)"
        ) from exc
    if ratio <= 0 or ratio > 1:
        raise ValueError(
            f"Invalid CADASTRO_SNAPSHOT_MIN_RATIO: {ratio} (expected float between 0 and 1)"
        )
    return ratio


def snapshot_allows_inactivation(
    snapshot_size: int,
    existing_active: int,
    *,
    min_ratio: float | None = None,
) -> bool:
    """Guard against inconsistent MySQL snapshots that would inactivate most of the mirror."""
    if snapshot_size <= 0:
        return False
    if existing_active <= 0:
        return True
    ratio = min_ratio if min_ratio is not None else load_snapshot_min_ratio()
    return snapshot_size >= existing_active * ratio


def _canonical_code(value: str, length: int) -> str:
    """Left-pad short codes; truncate longer values (e.g. prd_cbo 8 chars -> 6)."""
    text = value.strip()
    if len(text) >= length:
        return text[:length]
    return text.zfill(length)


def normalize_forma_row(
    row: dict[str, Any],
    sync_ts: datetime | None = None,
) -> dict[str, Any]:
    """Canonicalize forma codes to 6 digits; derive grupo/subgrupo when absent."""
    sync_ts = sync_ts or datetime.now(timezone.utc)
    codigo_forma_raw = _clean_str(row.get("codigo_forma"), max_len=6)
    descricao = _clean_str(row.get("descricao"), max_len=120)
    if not codigo_forma_raw or not descricao:
        raise ValueError("forma row missing codigo_forma or descricao")

    codigo_forma = _canonical_code(codigo_forma_raw, 6)
    grupo_raw = _clean_str(row.get("codigo_grupo"), max_len=2)
    subgrupo_raw = _clean_str(row.get("codigo_subgrupo"), max_len=4)
    codigo_grupo = _canonical_code(grupo_raw or codigo_forma[:2], 2)
    codigo_subgrupo = _canonical_code(subgrupo_raw or codigo_forma[:4], 4)

    return {
        "codigo_grupo": codigo_grupo,
        "codigo_subgrupo": codigo_subgrupo,
        "codigo_forma": codigo_forma,
        "descricao": descricao,
        "status": "ativo",
        "sincronizado_em": sync_ts,
    }


def normalize_cbo_row(
    row: dict[str, Any],
    sync_ts: datetime | None = None,
) -> dict[str, Any]:
    """Canonicalize CBO to 6 chars (left pad or truncate prd_cbo-style 8-char values)."""
    sync_ts = sync_ts or datetime.now(timezone.utc)
    codigo_raw = _clean_str(row.get("codigo_cbo"), max_len=8)
    descricao = _clean_str(row.get("descricao"), max_len=160)
    if not codigo_raw or not descricao:
        raise ValueError("cbo row missing codigo_cbo or descricao")

    return {
        "codigo_cbo": _canonical_code(codigo_raw, 6),
        "descricao": descricao,
        "status": "ativo",
        "sincronizado_em": sync_ts,
    }


def normalize_rubrica_row(
    row: dict[str, Any],
    sync_ts: datetime | None = None,
) -> dict[str, Any]:
    sync_ts = sync_ts or datetime.now(timezone.utc)
    codigo_raw = _clean_str(row.get("codigo_rubrica"), max_len=8)
    descricao = _clean_str(row.get("descricao"), max_len=160)
    if not codigo_raw or not descricao:
        raise ValueError("rubrica row missing codigo_rubrica or descricao")

    return {
        "codigo_rubrica": _canonical_code(codigo_raw, 4),
        "descricao": descricao,
        "status": "ativo",
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


def _read_sql_records(query: str, conn_mysql) -> list[dict[str, Any]]:
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="pandas only supports SQLAlchemy connectable.*",
            category=UserWarning,
        )
        df = pd.read_sql(query, conn_mysql)
    return df.replace({pd.NA: None}).to_dict(orient="records")


def extrair_prestadores(conn_mysql, cfg: dict[str, str] | None = None) -> list[dict[str, Any]]:
    query = build_prestador_query(cfg)
    return _read_sql_records(query, conn_mysql)


def extrair_procedimentos(conn_mysql, cfg: dict[str, str] | None = None) -> list[dict[str, Any]]:
    query = build_procedimento_query(cfg)
    return _read_sql_records(query, conn_mysql)


def extrair_formas(conn_mysql, cfg: dict[str, str] | None = None) -> list[dict[str, Any]]:
    query = build_forma_query(cfg)
    return _read_sql_records(query, conn_mysql)


def extrair_cbos(conn_mysql, cfg: dict[str, str] | None = None) -> list[dict[str, Any]]:
    query = build_cbo_query(cfg)
    return _read_sql_records(query, conn_mysql)


def extrair_rubricas(conn_mysql, cfg: dict[str, str] | None = None) -> list[dict[str, Any]]:
    query = build_rubrica_query(cfg)
    return _read_sql_records(query, conn_mysql)


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
        return 0

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


def _count_active_rows(cur, table: str, *, where: str = "status = 'ativo'") -> int:
    cur.execute(f"SELECT COUNT(*) FROM {table} WHERE {where}")
    return int(cur.fetchone()[0])


def _inactivate_formas(cur, snapshot_keys: set[str], pg_write: bool) -> int:
    if not snapshot_keys:
        return 0

    existing_active = _count_active_rows(cur, "formas_sia")
    if not snapshot_allows_inactivation(len(snapshot_keys), existing_active):
        logger.warning(
            "Skipping forma inactivation: snapshot=%s active=%s min_ratio=%s",
            len(snapshot_keys),
            existing_active,
            load_snapshot_min_ratio(),
        )
        return 0

    cur.execute(
        """
        SELECT codigo_forma FROM formas_sia
        WHERE status = 'ativo' AND codigo_forma NOT IN %s
        """,
        (tuple(snapshot_keys),),
    )
    to_inactivate = [row[0] for row in cur.fetchall()]
    if pg_write and to_inactivate:
        cur.execute(
            """
            UPDATE formas_sia
            SET status = 'inativo'
            WHERE codigo_forma = ANY(%s)
            """,
            (to_inactivate,),
        )
    return len(to_inactivate)


def _inactivate_cbos(cur, snapshot_keys: set[str], pg_write: bool) -> int:
    if not snapshot_keys:
        return 0

    existing_active = _count_active_rows(cur, "cbos_sia")
    if not snapshot_allows_inactivation(len(snapshot_keys), existing_active):
        logger.warning(
            "Skipping cbo inactivation: snapshot=%s active=%s min_ratio=%s",
            len(snapshot_keys),
            existing_active,
            load_snapshot_min_ratio(),
        )
        return 0

    cur.execute(
        """
        SELECT codigo_cbo FROM cbos_sia
        WHERE status = 'ativo' AND codigo_cbo NOT IN %s
        """,
        (tuple(snapshot_keys),),
    )
    to_inactivate = [row[0] for row in cur.fetchall()]
    if pg_write and to_inactivate:
        cur.execute(
            """
            UPDATE cbos_sia
            SET status = 'inativo'
            WHERE codigo_cbo = ANY(%s)
            """,
            (to_inactivate,),
        )
    return len(to_inactivate)


def _inactivate_rubricas(cur, snapshot_keys: set[str], pg_write: bool) -> int:
    if not snapshot_keys:
        return 0

    existing_active = _count_active_rows(cur, "rubricas_sia")
    if not snapshot_allows_inactivation(len(snapshot_keys), existing_active):
        logger.warning(
            "Skipping rubrica inactivation: snapshot=%s active=%s min_ratio=%s",
            len(snapshot_keys),
            existing_active,
            load_snapshot_min_ratio(),
        )
        return 0

    cur.execute(
        """
        SELECT codigo_rubrica FROM rubricas_sia
        WHERE status = 'ativo' AND codigo_rubrica NOT IN %s
        """,
        (tuple(snapshot_keys),),
    )
    to_inactivate = [row[0] for row in cur.fetchall()]
    if pg_write and to_inactivate:
        cur.execute(
            """
            UPDATE rubricas_sia
            SET status = 'inativo'
            WHERE codigo_rubrica = ANY(%s)
            """,
            (to_inactivate,),
        )
    return len(to_inactivate)


def _inactivate_procedimentos(cur, snapshot_keys: set[str], pg_write: bool) -> int:
    if not snapshot_keys:
        return 0

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


def sync_formas(
    conn_pg,
    rows: list[dict[str, Any]],
    *,
    pg_write: bool,
    skipped_rows: int = 0,
) -> dict[str, int]:
    counts = dict(COUNT_TEMPLATE)
    snapshot_keys = {row["codigo_forma"] for row in rows}

    with conn_pg.cursor() as cur:
        existing = _fetch_key_set(cur, "formas_sia", "codigo_forma")
        inserted, updated = _count_upserts(rows, existing, "codigo_forma")
        counts["inserted"] = inserted
        counts["updated"] = updated

        if pg_write:
            for row in rows:
                cur.execute(UPSERT_FORMA_SQL, row)

        if skipped_rows > 0:
            logger.warning(
                "Skipping forma inactivation because %s row(s) were ignored during normalization",
                skipped_rows,
            )
            counts["inactivated"] = 0
        else:
            counts["inactivated"] = _inactivate_formas(cur, snapshot_keys, pg_write)

    return counts


def sync_cbos(
    conn_pg,
    rows: list[dict[str, Any]],
    *,
    pg_write: bool,
    skipped_rows: int = 0,
) -> dict[str, int]:
    counts = dict(COUNT_TEMPLATE)
    snapshot_keys = {row["codigo_cbo"] for row in rows}

    with conn_pg.cursor() as cur:
        existing = _fetch_key_set(cur, "cbos_sia", "codigo_cbo")
        inserted, updated = _count_upserts(rows, existing, "codigo_cbo")
        counts["inserted"] = inserted
        counts["updated"] = updated

        if pg_write:
            for row in rows:
                cur.execute(UPSERT_CBO_SQL, row)

        if skipped_rows > 0:
            logger.warning(
                "Skipping cbo inactivation because %s row(s) were ignored during normalization",
                skipped_rows,
            )
            counts["inactivated"] = 0
        else:
            counts["inactivated"] = _inactivate_cbos(cur, snapshot_keys, pg_write)

    return counts


def sync_rubricas(
    conn_pg,
    rows: list[dict[str, Any]],
    *,
    pg_write: bool,
    skipped_rows: int = 0,
) -> dict[str, int]:
    counts = dict(COUNT_TEMPLATE)
    snapshot_keys = {row["codigo_rubrica"] for row in rows}

    with conn_pg.cursor() as cur:
        existing = _fetch_key_set(cur, "rubricas_sia", "codigo_rubrica")
        inserted, updated = _count_upserts(rows, existing, "codigo_rubrica")
        counts["inserted"] = inserted
        counts["updated"] = updated

        if pg_write:
            for row in rows:
                cur.execute(UPSERT_RUBRICA_SQL, row)

        if skipped_rows > 0:
            logger.warning(
                "Skipping rubrica inactivation because %s row(s) were ignored during normalization",
                skipped_rows,
            )
            counts["inactivated"] = 0
        else:
            counts["inactivated"] = _inactivate_rubricas(cur, snapshot_keys, pg_write)

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
    formas = result.get("formas", COUNT_TEMPLATE)
    cbos = result.get("cbos", COUNT_TEMPLATE)
    rubricas = result.get("rubricas", COUNT_TEMPLATE)
    with conn_pg.cursor() as cur:
        cur.execute(
            """
            INSERT INTO cadastros_sincronizacoes (
                status, estab_inseridos, estab_atualizados, estab_inativados,
                proc_inseridos, proc_atualizados, proc_inativados,
                forma_inseridos, forma_atualizados, forma_inativados,
                cbo_inseridos, cbo_atualizados, cbo_inativados,
                rubrica_inseridos, rubrica_atualizados, rubrica_inativados, erro
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                result.get("status", "ok"),
                estab.get("inserted", 0),
                estab.get("updated", 0),
                estab.get("inactivated", 0),
                proc.get("inserted", 0),
                proc.get("updated", 0),
                proc.get("inactivated", 0),
                formas.get("inserted", 0),
                formas.get("updated", 0),
                formas.get("inactivated", 0),
                cbos.get("inserted", 0),
                cbos.get("updated", 0),
                cbos.get("inactivated", 0),
                rubricas.get("inserted", 0),
                rubricas.get("updated", 0),
                rubricas.get("inactivated", 0),
                result.get("error"),
            ),
        )


def _error_result(error: str) -> dict[str, Any]:
    return {
        "status": "erro",
        "error": error,
        "estabelecimentos": dict(COUNT_TEMPLATE),
        "procedimentos": dict(COUNT_TEMPLATE),
        "formas": dict(COUNT_TEMPLATE),
        "cbos": dict(COUNT_TEMPLATE),
        "rubricas": dict(COUNT_TEMPLATE),
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


def _build_dry_run_snapshot_counts(
    prestadores: list[dict[str, Any]],
    procedimentos: list[dict[str, Any]],
    formas: list[dict[str, Any]],
    cbos: list[dict[str, Any]],
    rubricas: list[dict[str, Any]],
) -> dict[str, dict[str, int]]:
    return {
        "estabelecimentos": {
            "inserted": len({row["codigo_externo"] for row in prestadores}),
            "updated": 0,
            "inactivated": 0,
        },
        "procedimentos": {
            "inserted": len({row["codigo_sigtap"] for row in procedimentos}),
            "updated": 0,
            "inactivated": 0,
        },
        "formas": {
            "inserted": len({row["codigo_forma"] for row in formas}),
            "updated": 0,
            "inactivated": 0,
        },
        "cbos": {
            "inserted": len({row["codigo_cbo"] for row in cbos}),
            "updated": 0,
            "inactivated": 0,
        },
        "rubricas": {
            "inserted": len({row["codigo_rubrica"] for row in rubricas}),
            "updated": 0,
            "inactivated": 0,
        },
    }


def _attach_skipped_metadata(
    result: dict[str, Any],
    *,
    skipped_estab: int,
    skipped_proc: int,
    skipped_formas: int,
    skipped_cbos: int,
    skipped_rubricas: int,
) -> None:
    skipped_total = (
        skipped_estab + skipped_proc + skipped_formas + skipped_cbos + skipped_rubricas
    )
    if skipped_total <= 0:
        return

    result["status"] = "parcial"
    result["skipped"] = {
        "estabelecimentos": skipped_estab,
        "procedimentos": skipped_proc,
        "formas": skipped_formas,
        "cbos": skipped_cbos,
        "rubricas": skipped_rubricas,
    }
    result["error"] = f"{skipped_total} registro(s) ignorado(s) por dados inválidos no MySQL"


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
        raw_formas = extrair_formas(conn_mysql, cfg)
        raw_cbos = extrair_cbos(conn_mysql, cfg)
        raw_rubricas = extrair_rubricas(conn_mysql, cfg)
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
        except ValueError as exc:
            skipped_estab += 1
            logger.warning("Skipping invalid prestador row: %s", exc)
            continue

    procedimentos: list[dict[str, Any]] = []
    skipped_proc = 0
    for row in raw_proc:
        try:
            procedimentos.append(normalize_procedimento_row(row, sync_ts))
        except ValueError as exc:
            skipped_proc += 1
            logger.warning("Skipping invalid procedimento row: %s", exc)
            continue

    formas: list[dict[str, Any]] = []
    skipped_formas = 0
    for row in raw_formas:
        try:
            formas.append(normalize_forma_row(row, sync_ts))
        except ValueError as exc:
            skipped_formas += 1
            logger.warning("Skipping invalid forma row: %s", exc)
            continue

    cbos: list[dict[str, Any]] = []
    skipped_cbos = 0
    for row in raw_cbos:
        try:
            cbos.append(normalize_cbo_row(row, sync_ts))
        except ValueError as exc:
            skipped_cbos += 1
            logger.warning("Skipping invalid cbo row: %s", exc)
            continue

    rubricas: list[dict[str, Any]] = []
    skipped_rubricas = 0
    for row in raw_rubricas:
        try:
            rubricas.append(normalize_rubrica_row(row, sync_ts))
        except ValueError as exc:
            skipped_rubricas += 1
            logger.warning("Skipping invalid rubrica row: %s", exc)
            continue

    try:
        conn_pg = pg_connect()
    except Exception as exc:
        if not pg_write and dry_run:
            snapshot_counts = _build_dry_run_snapshot_counts(
                prestadores, procedimentos, formas, cbos, rubricas
            )
            fallback_result: dict[str, Any] = {
                "status": "ok",
                **snapshot_counts,
                "sincronizado_em": sync_ts.isoformat(),
                "warning": f"PG_UNAVAILABLE_DRY_RUN: {exc}",
            }
            _attach_skipped_metadata(
                fallback_result,
                skipped_estab=skipped_estab,
                skipped_proc=skipped_proc,
                skipped_formas=skipped_formas,
                skipped_cbos=skipped_cbos,
                skipped_rubricas=skipped_rubricas,
            )
            return fallback_result
        raise

    try:
        estab_counts = sync_estabelecimentos(conn_pg, prestadores, pg_write=pg_write)
        proc_counts = sync_procedimentos(conn_pg, procedimentos, pg_write=pg_write)
        forma_counts = sync_formas(
            conn_pg, formas, pg_write=pg_write, skipped_rows=skipped_formas
        )
        cbo_counts = sync_cbos(conn_pg, cbos, pg_write=pg_write, skipped_rows=skipped_cbos)
        rubrica_counts = sync_rubricas(
            conn_pg,
            rubricas,
            pg_write=pg_write,
            skipped_rows=skipped_rubricas,
        )

        result: dict[str, Any] = {
            "status": "ok",
            "estabelecimentos": estab_counts,
            "procedimentos": proc_counts,
            "formas": forma_counts,
            "cbos": cbo_counts,
            "rubricas": rubrica_counts,
            "sincronizado_em": sync_ts.isoformat(),
        }
        _attach_skipped_metadata(
            result,
            skipped_estab=skipped_estab,
            skipped_proc=skipped_proc,
            skipped_formas=skipped_formas,
            skipped_cbos=skipped_cbos,
            skipped_rubricas=skipped_rubricas,
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
        help="Grava cadastros (estab/proc/forma/cbo/rubrica) + cadastros_sincronizacoes",
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
