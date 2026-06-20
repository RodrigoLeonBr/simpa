#!/usr/bin/env python3
"""
SIMPA - Consolidador dashboard e-SUS + SIA -> dados_consolidados
================================================================

Transforma esus_indicadores_raw (e produção SIA quando disponível) no payload
ContratoDashboard v3.1.0 gravado em dados_consolidados.dados_conteudo.

Uso:
    python consolidate_dashboard.py --competencia 2026-05 --unidade "..." --equipe "..." --json-out
    python consolidate_dashboard.py --competencia 2026-05 --unidade "..." --equipe "..." --pg-write
    python consolidate_dashboard.py --all --pg-write
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date

from dotenv import load_dotenv

from etl_contract import build_payload, competencia_label
from etl_db import pg_connect


def competencia_para_date(competencia: str) -> date:
    ano, mes = competencia.split("-")
    return date(int(ano), int(mes), 1)


def fetch_groups(
    conn,
    competencia: str | None = None,
    unidade: str | None = None,
    equipe: str | None = None,
) -> list[tuple[date, str, str, str]]:
    clauses = ["equipe_nome <> 'Todas'"]
    params: list[object] = []

    if competencia:
        clauses.append("competencia = %s")
        params.append(competencia_para_date(competencia))
    if unidade:
        clauses.append("unidade = %s")
        params.append(unidade)
    if equipe:
        clauses.append("equipe_nome = %s")
        params.append(equipe)

    sql = f"""
        SELECT DISTINCT competencia, municipio, unidade, equipe_nome
        FROM esus_cargas
        WHERE {' AND '.join(clauses)}
        ORDER BY competencia, unidade, equipe_nome
    """
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def fetch_raw_rows(conn, competencia: date, unidade: str, equipe: str) -> list[dict]:
    sql = """
        SELECT
            c.tipo_relatorio,
            c.municipio,
            c.unidade,
            c.equipe_nome,
            r.secao,
            r.descricao,
            r.valores
        FROM esus_cargas c
        JOIN esus_indicadores_raw r ON r.carga_id = c.id
        WHERE c.competencia = %s
          AND c.unidade = %s
          AND (c.equipe_nome = %s OR c.equipe_nome = 'Todas')
        ORDER BY c.tipo_relatorio, r.secao, r.ordem
    """
    with conn.cursor() as cur:
        cur.execute(sql, (competencia, unidade, equipe))
        columns = [desc[0] for desc in cur.description]
        return [dict(zip(columns, row)) for row in cur.fetchall()]


def fetch_sia_rows(conn, competencia: date, unidade: str) -> list[dict]:
    sql = """
        SELECT
            codigo_sigtap,
            descricao,
            quantidade,
            valor_aprovado,
            faixa_etaria,
            sexo,
            cbo
        FROM sia_producao
        WHERE competencia = %s
          AND (unidade = %s OR unidade IS NULL OR unidade = '')
        ORDER BY quantidade DESC, codigo_sigtap
    """
    with conn.cursor() as cur:
        cur.execute(sql, (competencia, unidade))
        columns = [desc[0] for desc in cur.description]
        return [dict(zip(columns, row)) for row in cur.fetchall()]


def sia_sync_exists(conn, competencia: date) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM sia_sincronizacoes WHERE competencia = %s AND status = 'ok' LIMIT 1",
            (competencia,),
        )
        return cur.fetchone() is not None


def write_payload(
    conn,
    competencia: date,
    municipio: str,
    unidade: str,
    equipe: str,
    payload: dict,
) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO dados_consolidados (
                competencia, municipio, unidade, equipe,
                versao_schema, dados_conteudo
            ) VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (competencia, unidade, equipe) DO UPDATE SET
                municipio = EXCLUDED.municipio,
                versao_schema = EXCLUDED.versao_schema,
                dados_conteudo = EXCLUDED.dados_conteudo,
                atualizado_em = now()
            RETURNING id, atualizado_em
            """,
            (
                competencia,
                municipio,
                unidade,
                equipe,
                payload["versao_schema"],
                json.dumps(payload, ensure_ascii=False),
            ),
        )
        row_id, atualizado_em = cur.fetchone()
    conn.commit()
    return {
        "id": row_id,
        "competencia": competencia_label(competencia),
        "unidade": unidade,
        "equipe": equipe,
        "versao_schema": payload["versao_schema"],
        "atualizado_em": str(atualizado_em),
        "status": "ok",
    }


def consolidate_group(
    conn,
    competencia: date,
    municipio: str,
    unidade: str,
    equipe: str,
    *,
    pg_write: bool,
) -> dict:
    raw_rows = fetch_raw_rows(conn, competencia, unidade, equipe)
    sia_rows = fetch_sia_rows(conn, competencia, unidade)
    payload = build_payload(
        competencia=competencia,
        municipio=municipio,
        unidade=unidade,
        equipe=equipe,
        raw_rows=raw_rows,
        sia_rows=sia_rows,
        mysql_available=sia_sync_exists(conn, competencia),
    )

    if pg_write:
        meta = write_payload(conn, competencia, municipio, unidade, equipe, payload)
        meta["payload"] = payload
        return meta

    return payload


def main():
    parser = argparse.ArgumentParser(description="SIMPA — Consolidador dashboard")
    parser.add_argument("--competencia", help="Competência YYYY-MM")
    parser.add_argument("--unidade", help="Nome da unidade")
    parser.add_argument("--equipe", help="Nome da equipe")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Consolida todos os grupos com cargas e-SUS",
    )
    parser.add_argument(
        "--json-out",
        action="store_true",
        help="Imprime JSON no stdout",
    )
    parser.add_argument(
        "--pg-write",
        action="store_true",
        help="Grava em dados_consolidados via psycopg2",
    )
    args = parser.parse_args()

    if not args.json_out and not args.pg_write:
        print("Erro: use --json-out ou --pg-write", file=sys.stderr)
        sys.exit(1)

    if args.all:
        if args.competencia or args.unidade or args.equipe:
            print(
                "Erro: --all não combina com --competencia/--unidade/--equipe",
                file=sys.stderr,
            )
            sys.exit(1)
    elif not (args.competencia and args.unidade and args.equipe):
        print(
            "Erro: informe --competencia, --unidade e --equipe ou use --all",
            file=sys.stderr,
        )
        sys.exit(1)

    load_dotenv()
    conn = pg_connect()
    results = []
    try:
        if args.all:
            groups = fetch_groups(conn)
        else:
            groups = [
                (
                    competencia_para_date(args.competencia),
                    "AMERICANA",
                    args.unidade,
                    args.equipe,
                )
            ]

        if not groups:
            print("Nenhum grupo encontrado para consolidar", file=sys.stderr)
            sys.exit(1)

        for competencia, municipio, unidade, equipe in groups:
            if args.all and not municipio:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT municipio FROM esus_cargas
                        WHERE competencia = %s AND unidade = %s AND equipe_nome = %s
                        LIMIT 1
                        """,
                        (competencia, unidade, equipe),
                    )
                    row = cur.fetchone()
                    municipio = row[0] if row else "AMERICANA"

            result = consolidate_group(
                conn,
                competencia,
                municipio,
                unidade,
                equipe,
                pg_write=args.pg_write,
            )
            results.append(result)
    finally:
        conn.close()

    if args.pg_write:
        output = [
            {key: value for key, value in item.items() if key != "payload"}
            for item in results
        ]
    else:
        output = results[0] if len(results) == 1 else results

    print(json.dumps(output, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
