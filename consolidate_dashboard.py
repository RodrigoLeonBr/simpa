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
from typing import NamedTuple

from dotenv import load_dotenv

from etl_contract import build_payload, competencia_label
from etl_db import pg_connect

_SIA_PRODUCAO_COLUMNS_CACHE: set[str] | None = None


class ConsolidationGroup(NamedTuple):
    competencia: date
    municipio: str
    unidade: str
    equipe: str
    estabelecimento_id: int | None = None
    equipe_id: int | None = None


def competencia_para_date(competencia: str) -> date:
    ano, mes = competencia.split("-")
    return date(int(ano), int(mes), 1)


def fetch_groups(
    conn,
    competencia: str | None = None,
    unidade: str | None = None,
    equipe: str | None = None,
) -> list[ConsolidationGroup]:
    id_clauses = [
        "c.estabelecimento_id IS NOT NULL",
        "c.equipe_id IS NOT NULL",
    ]
    legacy_clauses = [
        "c.estabelecimento_id IS NULL",
        "c.equipe_id IS NULL",
    ]
    params: list[object] = []
    id_params: list[object] = []
    legacy_params: list[object] = []

    if competencia:
        comp = competencia_para_date(competencia)
        id_clauses.append("c.competencia = %s")
        legacy_clauses.append("c.competencia = %s")
        id_params.append(comp)
        legacy_params.append(comp)
    if unidade:
        id_clauses.append("est.nome = %s")
        legacy_clauses.append("c.unidade = %s")
        id_params.append(unidade)
        legacy_params.append(unidade)
    if equipe:
        id_clauses.append("eq.nome = %s")
        legacy_clauses.append("c.equipe_nome = %s")
        id_params.append(equipe)
        legacy_params.append(equipe)

    params = id_params + legacy_params

    id_sql = f"""
        SELECT DISTINCT c.competencia, c.municipio, est.nome, eq.nome,
               c.estabelecimento_id, c.equipe_id
        FROM esus_cargas c
        JOIN estabelecimentos est ON est.id = c.estabelecimento_id
        JOIN equipes eq ON eq.id = c.equipe_id
        WHERE {' AND '.join(id_clauses)}
    """
    legacy_sql = f"""
        SELECT DISTINCT c.competencia, c.municipio, c.unidade, c.equipe_nome,
               NULL::bigint, NULL::bigint
        FROM esus_cargas c
        WHERE {' AND '.join(legacy_clauses)}
    """
    sql = f"""
        {id_sql}
        UNION
        {legacy_sql}
        ORDER BY 1, 3, 4
    """
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return [
            ConsolidationGroup(
                competencia=row[0],
                municipio=row[1] or "AMERICANA",
                unidade=row[2],
                equipe=row[3],
                estabelecimento_id=row[4],
                equipe_id=row[5],
            )
            for row in cur.fetchall()
        ]


def fetch_cadastro_labels(
    conn, estabelecimento_id: int, equipe_id: int
) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT est.nome, eq.nome
            FROM estabelecimentos est
            JOIN equipes eq ON eq.id = %s
            WHERE est.id = %s
            """,
            (equipe_id, estabelecimento_id),
        )
        row = cur.fetchone()
    if not row:
        raise ValueError(
            f"Cadastro não encontrado para estabelecimento_id={estabelecimento_id}, "
            f"equipe_id={equipe_id}"
        )
    return {"unidade": row[0], "equipe": row[1]}


def fetch_raw_rows(
    conn,
    competencia: date,
    *,
    unidade: str | None = None,
    equipe: str | None = None,
    estabelecimento_id: int | None = None,
    equipe_id: int | None = None,
) -> list[dict]:
    if estabelecimento_id is not None and equipe_id is not None:
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
              AND c.estabelecimento_id = %s
              AND c.equipe_id = %s
            ORDER BY c.tipo_relatorio, r.secao, r.ordem
        """
        params = (competencia, estabelecimento_id, equipe_id)
    else:
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
        params = (competencia, unidade, equipe)

    with conn.cursor() as cur:
        cur.execute(sql, params)
        columns = [desc[0] for desc in cur.description]
        return [dict(zip(columns, row)) for row in cur.fetchall()]


def fetch_sia_rows(
    conn,
    competencia: date,
    unidade: str,
    estabelecimento_id: int | None = None,
) -> list[dict]:
    columns = _get_sia_producao_columns(conn)
    has_estabelecimento_id = "estabelecimento_id" in columns
    quantidade_apresentada_select = (
        "quantidade_apresentada"
        if "quantidade_apresentada" in columns
        else "0::bigint AS quantidade_apresentada"
    )
    valor_apresentado_select = (
        "valor_apresentado"
        if "valor_apresentado" in columns
        else "0::numeric AS valor_apresentado"
    )

    sql = f"""
        SELECT
            codigo_sigtap,
            descricao,
            quantidade,
            {quantidade_apresentada_select},
            valor_aprovado,
            {valor_apresentado_select},
            faixa_etaria,
            sexo,
            cbo
        FROM sia_producao
        WHERE competencia = %s
    """
    params: tuple[object, ...]
    if has_estabelecimento_id:
        sql += """
          AND (
                (
                    %s IS NOT NULL
                    AND (
                        estabelecimento_id = %s
                        OR (estabelecimento_id IS NULL AND unidade = %s)
                    )
                )
                OR (
                    %s IS NULL
                    AND (unidade = %s OR unidade IS NULL OR unidade = '')
                )
          )
        """
        params = (
            competencia,
            estabelecimento_id,
            estabelecimento_id,
            unidade,
            estabelecimento_id,
            unidade,
        )
    else:
        sql += " AND (unidade = %s OR unidade IS NULL OR unidade = '')"
        params = (competencia, unidade)
    sql += """
        ORDER BY quantidade DESC, codigo_sigtap
    """
    with conn.cursor() as cur:
        cur.execute(sql, params)
        columns = [desc[0] for desc in cur.description]
        return [dict(zip(columns, row)) for row in cur.fetchall()]


def _get_sia_producao_columns(conn) -> set[str]:
    global _SIA_PRODUCAO_COLUMNS_CACHE
    if _SIA_PRODUCAO_COLUMNS_CACHE is not None:
        return _SIA_PRODUCAO_COLUMNS_CACHE

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'sia_producao'
              AND column_name IN ('estabelecimento_id', 'quantidade_apresentada', 'valor_apresentado')
            """
        )
        _SIA_PRODUCAO_COLUMNS_CACHE = {row[0] for row in cur.fetchall()}
    return _SIA_PRODUCAO_COLUMNS_CACHE


def sia_sync_exists(conn, competencia: date) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM sia_sincronizacoes WHERE competencia = %s AND status = 'ok' LIMIT 1",
            (competencia,),
        )
        return cur.fetchone() is not None


def write_payload_sql(use_id_conflict: bool) -> str:
    fk_columns = ""
    fk_values = ""
    if use_id_conflict:
        fk_columns = ", estabelecimento_id, equipe_id"
        fk_values = ", %s, %s"

    conflict = (
        """
        ON CONFLICT (competencia, estabelecimento_id, equipe_id)
        WHERE estabelecimento_id IS NOT NULL AND equipe_id IS NOT NULL
        DO UPDATE SET
            municipio = EXCLUDED.municipio,
            unidade = EXCLUDED.unidade,
            equipe = EXCLUDED.equipe,
            versao_schema = EXCLUDED.versao_schema,
            dados_conteudo = EXCLUDED.dados_conteudo,
            atualizado_em = now()
        """
        if use_id_conflict
        else """
        ON CONFLICT (competencia, unidade, equipe) DO UPDATE SET
            municipio = EXCLUDED.municipio,
            versao_schema = EXCLUDED.versao_schema,
            dados_conteudo = EXCLUDED.dados_conteudo,
            atualizado_em = now()
        """
    )

    return f"""
        INSERT INTO dados_consolidados (
            competencia, municipio, unidade, equipe,
            versao_schema, dados_conteudo{fk_columns}
        ) VALUES (%s, %s, %s, %s, %s, %s{fk_values})
        {conflict}
        RETURNING id, atualizado_em
        """


def write_payload(
    conn,
    competencia: date,
    municipio: str,
    unidade: str,
    equipe: str,
    payload: dict,
    *,
    estabelecimento_id: int | None = None,
    equipe_id: int | None = None,
) -> dict:
    use_id_conflict = estabelecimento_id is not None and equipe_id is not None
    params: list[object] = [
        competencia,
        municipio,
        unidade,
        equipe,
        payload["versao_schema"],
        json.dumps(payload, ensure_ascii=False),
    ]
    if use_id_conflict:
        params.extend([estabelecimento_id, equipe_id])

    with conn.cursor() as cur:
        cur.execute(write_payload_sql(use_id_conflict), params)
        row_id, atualizado_em = cur.fetchone()
    conn.commit()
    meta = {
        "id": row_id,
        "competencia": competencia_label(competencia),
        "unidade": unidade,
        "equipe": equipe,
        "versao_schema": payload["versao_schema"],
        "atualizado_em": str(atualizado_em),
        "status": "ok",
    }
    if use_id_conflict:
        meta["estabelecimento_id"] = estabelecimento_id
        meta["equipe_id"] = equipe_id
    return meta


def fetch_pop_row(
    conn,
    competencia: date,
    estabelecimento_id: int | None,
) -> dict | None:
    """Busca snapshot de população cadastrada para denominadores de indicadores.

    Retorna None quando estabelecimento_id é None (path legado sem FK) ou
    quando não há dados de cadastro individual para (competencia, estabelecimento_id).
    """
    if estabelecimento_id is None:
        return None
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT cidadaos_ativos, saidas, faixa_etaria, condicoes_saude, raca_cor
            FROM populacao_cadastrada
            WHERE competencia = %s AND estabelecimento_id = %s
            """,
            (competencia, estabelecimento_id),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return {
        "cidadaos_ativos": row[0],
        "saidas": row[1],
        "faixa_etaria": row[2] or [],
        "condicoes_saude": row[3] or {},
        "raca_cor": row[4] or {},
    }


def consolidate_group(
    conn,
    competencia: date,
    municipio: str,
    unidade: str,
    equipe: str,
    *,
    estabelecimento_id: int | None = None,
    equipe_id: int | None = None,
    pg_write: bool,
) -> dict:
    use_ids = estabelecimento_id is not None and equipe_id is not None
    if use_ids:
        labels = fetch_cadastro_labels(conn, estabelecimento_id, equipe_id)
        unidade = labels["unidade"]
        equipe = labels["equipe"]
        raw_rows = fetch_raw_rows(
            conn,
            competencia,
            estabelecimento_id=estabelecimento_id,
            equipe_id=equipe_id,
        )
    else:
        raw_rows = fetch_raw_rows(
            conn, competencia, unidade=unidade, equipe=equipe
        )

    sia_rows = fetch_sia_rows(
        conn,
        competencia,
        unidade,
        estabelecimento_id=estabelecimento_id,
    )
    pop_row = fetch_pop_row(conn, competencia, estabelecimento_id)
    payload = build_payload(
        competencia=competencia,
        municipio=municipio,
        unidade=unidade,
        equipe=equipe,
        raw_rows=raw_rows,
        sia_rows=sia_rows,
        mysql_available=sia_sync_exists(conn, competencia),
        pop_row=pop_row,
    )

    if pg_write:
        meta = write_payload(
            conn,
            competencia,
            municipio,
            unidade,
            equipe,
            payload,
            estabelecimento_id=estabelecimento_id,
            equipe_id=equipe_id,
        )
        meta["payload"] = payload
        return meta

    return payload


def main():
    parser = argparse.ArgumentParser(description="SIMPA — Consolidador dashboard")
    parser.add_argument("--competencia", help="Competência YYYY-MM")
    parser.add_argument("--unidade", help="Nome da unidade (legado)")
    parser.add_argument("--equipe", help="Nome da equipe (legado)")
    parser.add_argument(
        "--estabelecimento-id",
        type=int,
        help="FK estabelecimentos.id (consolidação por cadastro)",
    )
    parser.add_argument(
        "--equipe-id",
        type=int,
        help="FK equipes.id (consolidação por cadastro)",
    )
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
        if (
            args.competencia
            or args.unidade
            or args.equipe
            or args.estabelecimento_id
            or args.equipe_id
        ):
            print(
                "Erro: --all não combina com filtros de competência/unidade/equipe/IDs",
                file=sys.stderr,
            )
            sys.exit(1)
    elif args.estabelecimento_id is not None and args.equipe_id is not None:
        if not args.competencia:
            print(
                "Erro: --estabelecimento-id e --equipe-id exigem --competencia",
                file=sys.stderr,
            )
            sys.exit(1)
        if args.unidade or args.equipe:
            print(
                "Erro: use --estabelecimento-id/--equipe-id ou --unidade/--equipe, não ambos",
                file=sys.stderr,
            )
            sys.exit(1)
    elif not (args.competencia and args.unidade and args.equipe):
        print(
            "Erro: informe --competencia + IDs de cadastro, "
            "--competencia/--unidade/--equipe ou use --all",
            file=sys.stderr,
        )
        sys.exit(1)

    load_dotenv()
    conn = pg_connect()
    results = []
    try:
        if args.all:
            groups = fetch_groups(conn)
        elif args.estabelecimento_id is not None and args.equipe_id is not None:
            labels = fetch_cadastro_labels(
                conn, args.estabelecimento_id, args.equipe_id
            )
            groups = [
                ConsolidationGroup(
                    competencia_para_date(args.competencia),
                    "AMERICANA",
                    labels["unidade"],
                    labels["equipe"],
                    args.estabelecimento_id,
                    args.equipe_id,
                )
            ]
        else:
            groups = [
                ConsolidationGroup(
                    competencia_para_date(args.competencia),
                    "AMERICANA",
                    args.unidade,
                    args.equipe,
                )
            ]

        if not groups:
            print("Nenhum grupo encontrado para consolidar", file=sys.stderr)
            sys.exit(1)

        for group in groups:
            municipio = group.municipio
            if args.all and not municipio:
                with conn.cursor() as cur:
                    if group.estabelecimento_id and group.equipe_id:
                        cur.execute(
                            """
                            SELECT municipio FROM esus_cargas
                            WHERE competencia = %s
                              AND estabelecimento_id = %s
                              AND equipe_id = %s
                            LIMIT 1
                            """,
                            (
                                group.competencia,
                                group.estabelecimento_id,
                                group.equipe_id,
                            ),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT municipio FROM esus_cargas
                            WHERE competencia = %s AND unidade = %s AND equipe_nome = %s
                            LIMIT 1
                            """,
                            (group.competencia, group.unidade, group.equipe),
                        )
                    row = cur.fetchone()
                    municipio = row[0] if row else "AMERICANA"

            result = consolidate_group(
                conn,
                group.competencia,
                municipio,
                group.unidade,
                group.equipe,
                estabelecimento_id=group.estabelecimento_id,
                equipe_id=group.equipe_id,
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
