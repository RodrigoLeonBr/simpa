#!/usr/bin/env python3
"""
SIMPA — Consolidação e-SUS + SIA → dados_consolidados
======================================================

Agrega esus_indicadores_raw (e opcionalmente sia_producao) no contrato JSON
v3.1.0 consumido por GET /api/v1/dashboard/planejamento.

Uso:
    python consolidate_dashboard.py --competencia 2026-05 \\
        --unidade "CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO" \\
        --equipe "EQUIPE 9 EAP" --pg-write

    python consolidate_dashboard.py --all --pg-write
    python consolidate_dashboard.py --competencia 2026-05 --unidade ... --equipe ... --json-out
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import unicodedata
from datetime import date
from typing import Any

from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv

VERSAO_SCHEMA = "3.1.0"
TURNOS_ORDEM = ("Manhã", "Tarde", "Noite")
FAIXAS_CONTRATO = (
    "0-4", "5-9", "10-14", "15-19", "20-29", "30-39",
    "40-49", "50-59", "60-69", "70-79", "80+",
)

# Mapeamento label e-SUS → faixa do contrato
FAIXA_ESUS_MAP: dict[str, str] = {
    "menos de 01 ano": "0-4",
    "01 ano": "0-4",
    "02 anos": "0-4",
    "03 anos": "0-4",
    "04 anos": "0-4",
    "05 a 09 anos": "5-9",
    "10 a 14 anos": "10-14",
    "15 a 19 anos": "15-19",
    "20 a 24 anos": "20-29",
    "25 a 29 anos": "20-29",
    "30 a 34 anos": "30-39",
    "35 a 39 anos": "30-39",
    "40 a 44 anos": "40-49",
    "45 a 49 anos": "40-49",
    "50 a 54 anos": "50-59",
    "55 a 59 anos": "50-59",
    "60 a 64 anos": "60-69",
    "65 a 69 anos": "60-69",
    "70 a 74 anos": "70-79",
    "75 a 79 anos": "70-79",
    "80 anos ou mais": "80+",
    "nao informado": "0-4",  # ignorado depois se zeros
}

FINANCIAMENTO_INDICADORES = [
    {"codigo": "C1", "nome": "Acesso e Vínculo", "valor": None, "meta": None},
    {"codigo": "B1", "nome": "1ª consulta odontológica", "valor": None, "meta": None},
    {"codigo": "B2", "nome": "Tratamento odontológico concluído", "valor": None, "meta": None},
]


def normalize_label(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return s.lower().strip()


def competencia_to_date(competencia: str) -> date:
    """'2026-05' ou '2026-05-01' → date(2026, 5, 1)."""
    parts = competencia.strip().split("-")
    ano, mes = int(parts[0]), int(parts[1])
    return date(ano, mes, 1)


def competencia_label(d: date) -> str:
    return f"{d.year}-{d.month:02d}"


def conectar_pg():
    import psycopg2

    load_dotenv()
    return psycopg2.connect(
        host=os.environ["PG_HOST"],
        port=os.environ["PG_PORT"],
        dbname=os.environ["PG_DB"],
        user=os.environ["PG_USER"],
        password=os.environ["PG_PASS"],
    )


def fetch_indicators_by_tipo(
    cur, competencia: date, unidade: str, equipe: str, tipo_relatorio: str
) -> dict[tuple[str, str], dict]:
    """Indicadores raw para um tipo_relatorio, com fallback equipe → Todas."""
    for equipe_busca in (equipe, "Todas"):
        cur.execute(
            """
            SELECT r.secao, r.descricao, r.valores
            FROM esus_indicadores_raw r
            JOIN esus_cargas c ON c.id = r.carga_id
            WHERE c.competencia = %s
              AND c.unidade = %s
              AND c.equipe_nome = %s
              AND c.tipo_relatorio = %s
            """,
            (competencia, unidade, equipe_busca, tipo_relatorio),
        )
        rows = cur.fetchall()
        if rows:
            return {(sec, desc): (val if isinstance(val, dict) else json.loads(val))
                    for sec, desc, val in rows}
    return {}


def qty(indicators: dict, secao: str, descricao: str) -> int:
    v = indicators.get((secao, descricao), {})
    q = v.get("quantidade")
    return int(q) if q is not None else 0


def build_kpis(cur, competencia: date, unidade: str, equipe: str) -> dict[str, int]:
    ind = fetch_indicators_by_tipo
    atend = ind(cur, competencia, unidade, equipe, "atendimento_individual")
    proc = ind(cur, competencia, unidade, equipe, "procedimentos_individualizados")
    col = ind(cur, competencia, unidade, equipe, "atividade_coletiva")
    odonto = ind(cur, competencia, unidade, equipe, "atendimento_odontologico")

    participantes = qty(col, "Número de participantes", "Total de participantes")
    if participantes == 0:
        participantes = qty(col, "Número de participantes", "Participantes identificados")

    return {
        "total_atendimentos_aps": qty(atend, "Resumo de produção", "Registros identificados"),
        "total_procedimentos_ambulatoriais": qty(proc, "Resumo de produção", "Registros identificados"),
        "total_participantes_coletivos": participantes,
        "atendimentos_odonto": qty(odonto, "Resumo de produção", "Registros identificados"),
    }


def build_turnos(cur, competencia: date, unidade: str, equipe: str) -> list[dict]:
    atend = fetch_indicators_by_tipo(cur, competencia, unidade, equipe, "atendimento_individual")
    proc = fetch_indicators_by_tipo(cur, competencia, unidade, equipe, "procedimentos_individualizados")

    turnos: dict[str, dict[str, int]] = {}
    for turno in TURNOS_ORDEM:
        turnos[turno] = {"atendimentos": 0, "procedimentos": 0}

    for (secao, descricao), valores in atend.items():
        if secao == "Turno" and descricao in turnos:
            turnos[descricao]["atendimentos"] = int(valores.get("quantidade") or 0)

    for (secao, descricao), valores in proc.items():
        if secao == "Turno" and descricao in turnos:
            turnos[descricao]["procedimentos"] = int(valores.get("quantidade") or 0)

    return [
        {"turno": t, **turnos[t]}
        for t in TURNOS_ORDEM
        if turnos[t]["atendimentos"] > 0 or turnos[t]["procedimentos"] > 0
    ]


def build_temas(cur, competencia: date, unidade: str, equipe: str) -> list[dict]:
    col = fetch_indicators_by_tipo(cur, competencia, unidade, equipe, "atividade_coletiva")
    temas = []
    for (secao, descricao), valores in col.items():
        if secao != "Temas para saúde":
            continue
        if descricao in ("Não informado", "Outros"):
            continue
        q = int(valores.get("quantidade") or 0)
        if q > 0:
            temas.append({"tema": descricao, "quantidade": q})
    temas.sort(key=lambda x: -x["quantidade"])
    return temas


def build_piramide(cur, competencia: date, unidade: str, equipe: str) -> list[dict]:
    atend = fetch_indicators_by_tipo(cur, competencia, unidade, equipe, "atendimento_individual")
    agg: dict[str, dict[str, int]] = {f: {"masculino": 0, "feminino": 0} for f in FAIXAS_CONTRATO}

    for (secao, descricao), valores in atend.items():
        if secao != "Faixa etária":
            continue
        faixa = FAIXA_ESUS_MAP.get(normalize_label(descricao))
        if not faixa or faixa not in agg:
            continue
        agg[faixa]["masculino"] += int(valores.get("masculino") or 0)
        agg[faixa]["feminino"] += int(valores.get("feminino") or 0)

    return [
        {"faixa": f, **agg[f]}
        for f in FAIXAS_CONTRATO
        if agg[f]["masculino"] > 0 or agg[f]["feminino"] > 0
    ]


def kpis_from_consolidado_row(dados: dict) -> tuple[int, int]:
    kpis = dados.get("kpis_gerais") or {}
    return (
        int(kpis.get("total_atendimentos_aps") or 0),
        int(kpis.get("total_procedimentos_ambulatoriais") or 0),
    )


def build_historico(cur, competencia: date, unidade: str, equipe: str) -> list[dict]:
    historico = []
    for offset in range(5, -1, -1):
        mes = competencia - relativedelta(months=offset)
        label = competencia_label(mes)

        cur.execute(
            """
            SELECT dados_conteudo FROM dados_consolidados
            WHERE competencia = %s AND unidade = %s AND equipe = %s
            """,
            (mes, unidade, equipe),
        )
        row = cur.fetchone()
        if row and row[0]:
            dados = row[0] if isinstance(row[0], dict) else json.loads(row[0])
            atend, proc = kpis_from_consolidado_row(dados)
        else:
            kpis = build_kpis(cur, mes, unidade, equipe)
            atend = kpis["total_atendimentos_aps"]
            proc = kpis["total_procedimentos_ambulatoriais"]

        historico.append({
            "competencia": label,
            "atendimentos": atend,
            "procedimentos": proc,
            "meta": None,
        })
    return historico


def build_sia_modulo(cur, competencia: date, unidade: str) -> dict:
    cur.execute(
        """
        SELECT status FROM sia_sincronizacoes
        WHERE competencia = %s
        LIMIT 1
        """,
        (competencia,),
    )
    sync = cur.fetchone()
    conectado = sync and sync[0] in ("ok", "parcial")
    status = "MySQL_XAMPP_CONNECTED" if conectado else "PENDING"

    cur.execute(
        """
        SELECT codigo_sigtap, descricao, SUM(quantidade)::int AS quantidade
        FROM sia_producao
        WHERE competencia = %s AND unidade ILIKE %s
        GROUP BY codigo_sigtap, descricao
        ORDER BY quantidade DESC
        LIMIT 20
        """,
        (competencia, f"%{unidade[:20]}%"),
    )
    procedimentos = [
        {"codigo_sigtap": row[0], "descricao": row[1], "quantidade": row[2]}
        for row in cur.fetchall()
    ]

    return {
        "status_conexao": status,
        "procedimentos_especializados": procedimentos,
    }


def build_payload(cur, competencia: date, unidade: str, equipe: str) -> dict[str, Any]:
    kpis = build_kpis(cur, competencia, unidade, equipe)
    return {
        "kpis_gerais": kpis,
        "modulos": {
            "atencao_primaria_esus": {
                "distribuicao_turnos": build_turnos(cur, competencia, unidade, equipe),
                "temas_coletivos": build_temas(cur, competencia, unidade, equipe),
                "distribuicao_faixa_etaria": build_piramide(cur, competencia, unidade, equipe),
                "historico_mensal": build_historico(cur, competencia, unidade, equipe),
            },
            "ambulatorial_sia": build_sia_modulo(cur, competencia, unidade),
            "hospitalar_sihd": {
                "status_importacao": "PENDING_AIH_FILE",
                "internacoes_por_capitulo_cid": [],
            },
            "financiamento_metas": {
                "classificacao_geral": "BOM",
                "indicadores": [dict(i) for i in FINANCIAMENTO_INDICADORES],
            },
            "elementos_futuros": {},
        },
        "emendas_parlamentares": [],
    }


def kpis_vazios(kpis: dict) -> bool:
    return all(v == 0 for v in kpis.values())


def upsert_consolidado(cur, competencia: date, unidade: str, equipe: str, payload: dict) -> str:
    if kpis_vazios(payload["kpis_gerais"]):
        cur.execute(
            """
            DELETE FROM dados_consolidados
            WHERE competencia = %s AND unidade = %s AND equipe = %s
            """,
            (competencia, unidade, equipe),
        )
        return "deleted"

    cur.execute(
        """
        INSERT INTO dados_consolidados (competencia, unidade, equipe, versao_schema, dados_conteudo)
        VALUES (%s, %s, %s, %s, %s::jsonb)
        ON CONFLICT (competencia, unidade, equipe)
        DO UPDATE SET
            versao_schema = EXCLUDED.versao_schema,
            dados_conteudo = EXCLUDED.dados_conteudo,
            atualizado_em = now()
        RETURNING id
        """,
        (competencia, unidade, equipe, VERSAO_SCHEMA, json.dumps(payload, ensure_ascii=False)),
    )
    row = cur.fetchone()
    return f"upserted:{row[0]}"


def discover_groups(cur) -> list[tuple[date, str, str]]:
    cur.execute(
        """
        SELECT DISTINCT competencia, unidade, equipe_nome
        FROM esus_cargas
        WHERE equipe_nome IS NOT NULL AND equipe_nome <> 'Todas'
        ORDER BY competencia, unidade, equipe_nome
        """
    )
    return [(row[0], row[1], row[2]) for row in cur.fetchall()]


def consolidate_one(competencia: date, unidade: str, equipe: str, pg_write: bool) -> dict:
    conn = conectar_pg()
    try:
        with conn:
            with conn.cursor() as cur:
                payload = build_payload(cur, competencia, unidade, equipe)
                result = {
                    "competencia": competencia_label(competencia),
                    "unidade": unidade,
                    "equipe": equipe,
                    "kpis_gerais": payload["kpis_gerais"],
                    "status": "preview",
                }
                if pg_write:
                    result["status"] = upsert_consolidado(cur, competencia, unidade, equipe, payload)
                else:
                    result["dados_conteudo"] = payload
                return result
    finally:
        conn.close()


def consolidate_all(pg_write: bool) -> list[dict]:
    conn = conectar_pg()
    results = []
    try:
        with conn:
            with conn.cursor() as cur:
                groups = discover_groups(cur)
                for competencia, unidade, equipe in groups:
                    payload = build_payload(cur, competencia, unidade, equipe)
                    entry = {
                        "competencia": competencia_label(competencia),
                        "unidade": unidade,
                        "equipe": equipe,
                        "kpis_gerais": payload["kpis_gerais"],
                    }
                    if pg_write:
                        entry["status"] = upsert_consolidado(
                            cur, competencia, unidade, equipe, payload
                        )
                    results.append(entry)
    finally:
        conn.close()
    return results


def consolidate_competencia(competencia: date, pg_write: bool) -> list[dict]:
    """Re-consolida todos os grupos de uma competência (útil após sync SIA)."""
    conn = conectar_pg()
    results = []
    try:
        with conn:
            with conn.cursor() as cur:
                groups = [
                    g for g in discover_groups(cur)
                    if g[0] == competencia
                ]
                for comp, unidade, equipe in groups:
                    payload = build_payload(cur, comp, unidade, equipe)
                    entry = {
                        "competencia": competencia_label(comp),
                        "unidade": unidade,
                        "equipe": equipe,
                        "kpis_gerais": payload["kpis_gerais"],
                    }
                    if pg_write:
                        entry["status"] = upsert_consolidado(cur, comp, unidade, equipe, payload)
                    results.append(entry)
    finally:
        conn.close()
    return results


def main():
    parser = argparse.ArgumentParser(description="SIMPA — Consolidação dashboard")
    parser.add_argument("--competencia", help="YYYY-MM")
    parser.add_argument("--unidade", help="Nome completo da unidade")
    parser.add_argument("--equipe", help="Nome da equipe")
    parser.add_argument("--all", action="store_true", help="Consolidar todos os grupos")
    parser.add_argument(
        "--competencia-only",
        action="store_true",
        help="Com --competencia, consolida todos os grupos dessa competência",
    )
    parser.add_argument("--pg-write", action="store_true", help="Gravar em dados_consolidados")
    parser.add_argument("--json-out", action="store_true", help="Imprimir JSON no stdout")
    args = parser.parse_args()

    if args.all:
        results = consolidate_all(pg_write=args.pg_write)
        print(json.dumps(results, ensure_ascii=False, default=str))
        return

    if args.competencia and args.competencia_only:
        comp_date = competencia_to_date(args.competencia)
        results = consolidate_competencia(comp_date, pg_write=args.pg_write)
        print(json.dumps(results, ensure_ascii=False, default=str))
        return

    if not args.competencia or not args.unidade or not args.equipe:
        print("Erro: informe --competencia, --unidade e --equipe (ou use --all)", file=sys.stderr)
        sys.exit(1)

    comp_date = competencia_to_date(args.competencia)
    result = consolidate_one(comp_date, args.unidade, args.equipe, pg_write=args.pg_write)

    if args.json_out and "dados_conteudo" not in result and args.pg_write:
        conn = conectar_pg()
        try:
            with conn.cursor() as cur:
                result["dados_conteudo"] = build_payload(cur, comp_date, args.unidade, args.equipe)
        finally:
            conn.close()

    print(json.dumps(result, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
