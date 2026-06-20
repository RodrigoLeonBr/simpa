#!/usr/bin/env python3
"""
SIMPA — Legacy cadastro FK migration runner.

Backfills equipes/metas estabelecimento_id and renames deprecated tables.
Run AFTER sync_cadastros_mysql.py --pg-write.

Usage:
    python scripts/migrate_cadastros_legacy.py --dry-run
    python scripts/migrate_cadastros_legacy.py --pg-write
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
SQL_FILE = Path(__file__).resolve().parent / "migrate_cadastros_legacy.sql"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from etl_db import pg_connect  # noqa: E402


def fetch_migration_report(conn) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT categoria, COUNT(*)::int AS total
            FROM cadastros_migracao_relatorio
            GROUP BY categoria
            ORDER BY categoria
            """
        )
        by_category = {row[0]: row[1] for row in cur.fetchall()}

        cur.execute(
            """
            SELECT COUNT(*)::int
            FROM equipes
            WHERE status = 'ativo'
              AND unidade_id IS NOT NULL
              AND estabelecimento_id IS NULL
            """
        )
        equipes_orfas = cur.fetchone()[0]

        cur.execute(
            """
            SELECT id, codigo, nome, motivo
            FROM cadastros_migracao_relatorio
            WHERE categoria = 'equipe_sem_match'
            ORDER BY registro_id
            """
        )
        unmatched_equipes = [
            {"id": row[0], "codigo": row[1], "nome": row[2], "motivo": row[3]}
            for row in cur.fetchall()
        ]

    return {
        "status": "ok",
        "equipes_orfas_ativas": equipes_orfas,
        "relatorio_por_categoria": by_category,
        "equipes_sem_match": unmatched_equipes,
    }


def _unidades_table_name(conn) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('unidades_saude', '_deprecated_unidades_saude')
            ORDER BY CASE table_name WHEN 'unidades_saude' THEN 0 ELSE 1 END
            LIMIT 1
            """
        )
        row = cur.fetchone()
    return row[0] if row else "unidades_saude"


def preview_migration(conn) -> dict:
    unidades = _unidades_table_name(conn)
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT COUNT(*)::int
            FROM equipes e
            INNER JOIN {unidades} u ON u.id = e.unidade_id
            INNER JOIN estabelecimentos est ON (
                est.codigo_externo = u.codigo
                OR (
                    NULLIF(BTRIM(u.cnes), '') IS NOT NULL
                    AND est.codigo_externo = BTRIM(u.cnes)
                )
            )
            WHERE e.estabelecimento_id IS NULL
            """
        )
        equipes_a_migrar = cur.fetchone()[0]

        cur.execute(
            """
            SELECT COUNT(*)::int
            FROM equipes
            WHERE unidade_id IS NOT NULL
              AND estabelecimento_id IS NULL
            """
        )
        equipes_pendentes = cur.fetchone()[0]

    return {
        "status": "ok",
        "modo": "dry-run",
        "equipes_mapeaveis": equipes_a_migrar,
        "equipes_pendentes": equipes_pendentes,
    }


def run_migration(*, pg_write: bool) -> dict:
    conn = pg_connect()
    try:
        if not pg_write:
            return preview_migration(conn)

        sql = SQL_FILE.read_text(encoding="utf-8")
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        return fetch_migration_report(conn)
    except Exception as exc:
        conn.rollback()
        return {"status": "erro", "error": str(exc)}
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="SIMPA — Legacy cadastro FK migration")
    parser.add_argument(
        "--pg-write",
        action="store_true",
        help="Executa migrate_cadastros_legacy.sql",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview de equipes mapeáveis sem gravar",
    )
    args = parser.parse_args()

    if not args.pg_write and not args.dry_run:
        print("Erro: use --dry-run ou --pg-write", file=sys.stderr)
        sys.exit(1)

    load_dotenv()
    result = run_migration(pg_write=args.pg_write)
    print(json.dumps(result, ensure_ascii=False, default=str))

    if result.get("status") == "erro":
        sys.exit(1)


if __name__ == "__main__":
    main()
