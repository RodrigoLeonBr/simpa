"""Build ContratoDashboard v3.1.0 payload from staged e-SUS raw rows and SIA production."""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any

PLATAFORMA = (
    "SIMPA - Sistema Integrado de Monitoramento e Planejamento de Americana"
)
VERSAO_SCHEMA = "3.1.0"

TURNO_ORDER = ("Manhã", "Tarde", "Noite", "Não informado")

INDICADORES_QUALIDADE_CATALOG: list[dict[str, Any]] = [
    {
        "cod": "C1",
        "nomeCurto": "Acesso e Vínculo",
        "nome": "Acesso e Vínculo — 1ªs consultas programadas vs. demanda espontânea",
        "categoria": "Componente Qualidade APS",
        "fonte": "Relatório de Atendimento Individual",
        "periodicidade": "Quadrimestral",
    },
    {
        "cod": "B1",
        "nomeCurto": "1ª consulta odontológica",
        "nome": "1ª consulta odontológica programada na APS",
        "categoria": "Componente Qualidade APS",
        "fonte": "Relatório de Atendimento Odontológico",
        "periodicidade": "Quadrimestral",
    },
    {
        "cod": "B2",
        "nomeCurto": "Tratamento concluído",
        "nome": "Tratamentos odontológicos concluídos",
        "categoria": "Componente Qualidade APS",
        "fonte": "Relatório de Atendimento Odontológico",
        "periodicidade": "Quadrimestral",
    },
    {
        "cod": "B3",
        "nomeCurto": "Taxa de exodontias",
        "nome": "Taxa de exodontias na APS",
        "categoria": "Componente Qualidade APS",
        "fonte": "Relatório de Procedimentos Individualizados",
        "periodicidade": "Quadrimestral",
    },
    {
        "cod": "B4",
        "nomeCurto": "Escovação supervisionada",
        "nome": "Escovação supervisionada (6 a 12 anos)",
        "categoria": "Componente Qualidade APS",
        "fonte": "Relatório de Atividade Coletiva",
        "periodicidade": "Quadrimestral",
    },
    {
        "cod": "B5",
        "nomeCurto": "Preventivos odontológicos",
        "nome": "Procedimentos preventivos odontológicos",
        "categoria": "Componente Qualidade APS",
        "fonte": "Relatório de Procedimentos Individualizados",
        "periodicidade": "Quadrimestral",
    },
    {
        "cod": "B6",
        "nomeCurto": "ART",
        "nome": "Tratamento Restaurador Atraumático (ART)",
        "categoria": "Componente Qualidade APS",
        "fonte": "Relatório de Procedimentos Individualizados",
        "periodicidade": "Quadrimestral",
    },
    {
        "cod": "M1",
        "nomeCurto": "Média atendimentos eMulti",
        "nome": "Média de atendimentos por pessoa assistida pela eMulti",
        "categoria": "Componente Qualidade APS",
        "fonte": "Relatórios Individual + Coletiva",
        "periodicidade": "Quadrimestral",
    },
    {
        "cod": "M2",
        "nomeCurto": "Ações interprofissionais",
        "nome": "Proporção de ações interprofissionais compartilhadas pela eMulti",
        "categoria": "Componente Qualidade APS",
        "fonte": "Relatório de Atividade Coletiva",
        "periodicidade": "Quadrimestral",
    },
    {
        "cod": "IGM-APS",
        "nomeCurto": "Cobertura APS",
        "nome": "Cobertura de Atenção Primária (eSF/eAP)",
        "categoria": "IGM SUS Paulista",
        "fonte": "Cadastro territorial e-SUS",
        "periodicidade": "Mensal",
    },
    {
        "cod": "IGM-PN",
        "nomeCurto": "Pré-natal 7+",
        "nome": "Proporção de gestantes com 7 ou mais consultas de pré-natal",
        "categoria": "IGM SUS Paulista",
        "fonte": "Relatório de Atendimento Individual",
        "periodicidade": "Mensal",
    },
    {
        "cod": "IGM-VAC",
        "nomeCurto": "Cobertura vacinal",
        "nome": "Cobertura vacinal de menores de 1 ano",
        "categoria": "IGM SUS Paulista",
        "fonte": "Sistema de imunização (parcial Fase 1)",
        "periodicidade": "Mensal",
    },
    {
        "cod": "IGM-ICSAP",
        "nomeCurto": "ICSAP",
        "nome": "Internações por Condições Sensíveis à Atenção Primária",
        "categoria": "IGM SUS Paulista",
        "fonte": "e-SUS + SIHD (parcial Fase 1)",
        "periodicidade": "Mensal",
    },
]

COMPONENTE_QUALIDADE_APS = [
    {
        "codigo": "C1",
        "nome": "Acesso e Vínculo (1ªs consultas programadas vs. demanda espontânea)",
        "equipe": "eSF/eAP",
    },
    {
        "codigo": "B1",
        "nome": "1ª consulta odontológica programada na APS",
        "equipe": "eSB",
    },
    {
        "codigo": "B2",
        "nome": "Tratamento odontológico concluído",
        "equipe": "eSB",
    },
    {
        "codigo": "B3",
        "nome": "Taxa de exodontias na APS",
        "equipe": "eSB",
    },
    {
        "codigo": "B4",
        "nome": "Escovação supervisionada (6 a 12 anos)",
        "equipe": "eSB",
    },
    {
        "codigo": "B5",
        "nome": "Procedimentos preventivos odontológicos",
        "equipe": "eSB",
    },
    {
        "codigo": "B6",
        "nome": "Tratamento Restaurador Atraumático (ART)",
        "equipe": "eSB",
    },
    {
        "codigo": "M1",
        "nome": "Média de atendimentos por pessoa assistida pela eMulti",
        "equipe": "eMulti",
    },
    {
        "codigo": "M2",
        "nome": "Ações interprofissionais compartilhadas",
        "equipe": "eMulti",
    },
]

IGM_INDICADORES = [
    {"nome": "Cobertura de Atenção Primária (eSF/eAP)"},
    {"nome": "Pré-natal com 7+ consultas"},
    {"nome": "Cobertura vacinal (menores de 1 ano)"},
    {"nome": "ICSAP (Internações por Condições Sensíveis à APS)"},
]


def competencia_label(value: date | str) -> str:
    if isinstance(value, date):
        return value.strftime("%Y-%m")
    return str(value)[:7]


def _qty(valores: dict[str, Any] | None, *keys: str) -> int | None:
    if not valores:
        return None
    for key in keys:
        if key in valores and valores[key] is not None:
            return int(valores[key])
    return None


def _index_raw(rows: list[dict[str, Any]]) -> dict[tuple[str, str, str], dict[str, Any]]:
    indexed: dict[tuple[str, str, str], dict[str, Any]] = {}
    for row in rows:
        key = (row["tipo_relatorio"], row["secao"], row["descricao"])
        indexed[key] = row.get("valores") or {}
    return indexed


def _turno_map(indexed: dict, tipo_relatorio: str) -> dict[str, int]:
    result: dict[str, int] = {}
    for turno in TURNO_ORDER:
        valores = indexed.get((tipo_relatorio, "Turno", turno))
        qty = _qty(valores, "quantidade")
        if qty is not None:
            result[turno] = qty
    return result


def _turno_total(indexed: dict, tipo_relatorio: str) -> int | None:
    """Fallback quando o export e-SUS omite a seção Resumo de produção."""
    total = 0
    found = False
    for turno in TURNO_ORDER:
        qty = _qty(indexed.get((tipo_relatorio, "Turno", turno)), "quantidade")
        if qty is not None:
            total += qty
            found = True
    if found and total > 0:
        return total
    return None


def _resumo_total(indexed: dict, tipo_relatorio: str) -> int | None:
    for descricao in ("Registros identificados", "Total de registros"):
        qty = _qty(
            indexed.get((tipo_relatorio, "Resumo de produção", descricao)),
            "quantidade",
        )
        if qty is not None:
            return qty
    return _turno_total(indexed, tipo_relatorio)


def _participantes_coletivos(indexed: dict) -> int | None:
    for descricao in ("Total de participantes", "Participantes identificados"):
        qty = _qty(
            indexed.get(("atividade_coletiva", "Número de participantes", descricao)),
            "quantidade",
        )
        if qty is not None:
            return qty
    return None


def _temas_coletivos(indexed: dict) -> list[dict[str, Any]]:
    temas = []
    prefix = "Temas para saúde"
    for (tipo, secao, descricao), valores in indexed.items():
        if tipo != "atividade_coletiva" or secao != prefix:
            continue
        qty = _qty(valores, "quantidade")
        if qty and qty > 0:
            temas.append({"tema": descricao, "quantidade": qty})
    temas.sort(key=lambda item: (-item["quantidade"], item["tema"]))
    return temas


def _denominadores(pop_row: dict[str, Any] | None) -> dict[str, Any]:
    """Extrai denominadores de qualidade a partir do snapshot populacao_cadastrada.

    Retorna dict vazio quando pop_row é None ou cidadaos_ativos == 0.
    Indicadores odontológicos (B1-B3, B5-B6, M1, M2) não estão presentes —
    seus denominadores vêm de dados de produção, não do cadastro individual.
    """
    if pop_row is None:
        return {}
    ativos = int(pop_row.get("cidadaos_ativos") or 0)
    if not ativos:
        return {}

    result: dict[str, Any] = {
        "C1": ativos,
        "IGM-APS": ativos,
        "IGM-ICSAP": ativos,
    }

    # IGM-PN: gestantes registradas com "Está gestante = Sim"
    cond = pop_row.get("condicoes_saude") or {}
    gest_sim = (cond.get("gestante") or {}).get("sim")
    if gest_sim is not None and int(gest_sim) > 0:
        result["IGM-PN"] = int(gest_sim)

    # IGM-VAC: crianças menores de 1 ano
    faixas = pop_row.get("faixa_etaria") or []
    for f in faixas:
        if f.get("faixa") == "Menos de 01 ano":
            total = (f.get("masculino") or 0) + (f.get("feminino") or 0)
            if total > 0:
                result["IGM-VAC"] = total
            break

    # B4: escovação supervisionada (6-12 anos) — aproximado com faixas 05-09 + 10-14
    b4_total = 0
    for f in faixas:
        if f.get("faixa") in ("05 a 09 anos", "10 a 14 anos"):
            b4_total += (f.get("masculino") or 0) + (f.get("feminino") or 0)
    if b4_total > 0:
        result["B4"] = b4_total

    return result


def _build_indicadores_qualidade(
    pop_row: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    dens = _denominadores(pop_row)
    result = []
    for item in INDICADORES_QUALIDADE_CATALOG:
        entry: dict[str, Any] = {
            "cod": item["cod"],
            "nomeCurto": item["nomeCurto"],
            "nome": item["nome"],
            "categoria": item["categoria"],
            "meta": None,
            "exec": None,
            "num": "—",
            "den": dens.get(item["cod"], "—"),
            "fonte": item["fonte"],
            "periodicidade": item["periodicidade"],
        }
        if item["cod"] == "B4":
            entry["den_nota"] = "Aproximado: faixas 05-09 + 10-14 anos"
        result.append(entry)
    return result


def _build_financiamento_metas() -> dict[str, Any]:
    return {
        "nota_tecnica": (
            "Bloco introduzido na v3.1.0 (aditivo). Consolida indicadores de "
            "cofinanciamento federal/estadual calculados a partir dos módulos acima."
        ),
        "componente_qualidade_aps": {
            "classificacao_geral": None,
            "indicadores": [
                {
                    "codigo": item["codigo"],
                    "nome": item["nome"],
                    "equipe": item["equipe"],
                    "valor": None,
                    "meta": None,
                }
                for item in COMPONENTE_QUALIDADE_APS
            ],
        },
        "igm_sus_paulista": {
            "componente_fixo": None,
            "componente_variavel": None,
            "indicadores": [
                {"nome": item["nome"], "valor": None, "meta": None}
                for item in IGM_INDICADORES
            ],
        },
        "tabela_sus_paulista": {
            "nota_tecnica": (
                "Estimativa do cofinanciamento estadual com base na produção "
                "SIA/SIHD aprovada vs. valores complementares da Tabela SUS Paulista."
            ),
            "valor_complementar_estimado": None,
        },
    }


def _build_ambulatorial_sia(
    sia_rows: list[dict[str, Any]], mysql_available: bool
) -> dict[str, Any]:
    if sia_rows:
        status = "MySQL_XAMPP_CONNECTED"
    elif mysql_available:
        status = "MySQL_XAMPP_CONNECTED"
    else:
        status = "MySQL_XAMPP_UNAVAILABLE"

    grouped: dict[tuple[str, str], dict[str, Any]] = defaultdict(
        lambda: {
            "quantidade": 0,
            "quantidade_apresentada": 0,
            "valor_aprovado": 0.0,
            "valor_apresentado": 0.0,
        }
    )
    for row in sia_rows:
        codigo = row.get("codigo_sigtap") or ""
        descricao = row.get("descricao") or ""
        key = (codigo, descricao)
        grouped[key]["codigo_sigtap"] = codigo
        grouped[key]["descricao"] = descricao
        grouped[key]["quantidade"] += int(row.get("quantidade") or 0)
        grouped[key]["quantidade_apresentada"] += int(
            row.get("quantidade_apresentada") or 0
        )
        grouped[key]["valor_aprovado"] += float(row.get("valor_aprovado") or 0)
        grouped[key]["valor_apresentado"] += float(row.get("valor_apresentado") or 0)

    procedimentos = sorted(
        grouped.values(), key=lambda item: (-item["quantidade"], item["codigo_sigtap"])
    )

    return {
        "status_conexao": status,
        "procedimentos_especializados": procedimentos,
    }


def build_payload(
    *,
    competencia: date,
    municipio: str,
    unidade: str,
    equipe: str,
    raw_rows: list[dict[str, Any]],
    sia_rows: list[dict[str, Any]] | None = None,
    mysql_available: bool = False,
    pop_row: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Transform staged rows into ContratoDashboard v3.1.0 JSON."""
    sia_rows = sia_rows or []
    indexed = _index_raw(raw_rows)

    atendimentos = _resumo_total(indexed, "atendimento_individual")
    odonto = _resumo_total(indexed, "atendimento_odontologico")
    procedimentos_total = _resumo_total(indexed, "procedimentos_individualizados")
    participantes = _participantes_coletivos(indexed)

    sia_total = sum(int(row.get("quantidade") or 0) for row in sia_rows)
    total_ambulatorial = sia_total if sia_total else procedimentos_total

    turnos_atend = _turno_map(indexed, "atendimento_individual")
    turnos_proc = _turno_map(indexed, "procedimentos_individualizados")
    distribuicao_turnos = []
    for turno in TURNO_ORDER:
        atend = turnos_atend.get(turno)
        proc = turnos_proc.get(turno)
        if atend is None and proc is None:
            continue
        entry: dict[str, Any] = {"turno": turno}
        if atend is not None:
            entry["atendimentos"] = atend
        if proc is not None:
            entry["procedimentos"] = proc
        distribuicao_turnos.append(entry)

    kpis: dict[str, int | None] = {
        "total_atendimentos_aps": atendimentos,
        "total_procedimentos_ambulatoriais": total_ambulatorial,
        "total_participantes_coletivos": participantes,
        "atendimentos_odonto": odonto,
    }

    return {
        "plataforma": PLATAFORMA,
        "versao_schema": VERSAO_SCHEMA,
        "competencia": competencia_label(competencia),
        "municipio": municipio,
        "filtros_ativos": {"unidade": unidade, "equipe": equipe},
        "kpis_gerais": kpis,
        "modulos": {
            "atencao_primaria_esus": {
                "distribuicao_turnos": distribuicao_turnos,
                "temas_coletivos": _temas_coletivos(indexed),
            },
            "ambulatorial_sia": _build_ambulatorial_sia(sia_rows, mysql_available),
            "hospitalar_sihd": {
                "status_importacao": "PENDING_AIH_FILE",
                "internacoes_por_capitulo_cid": [],
            },
            "financiamento_metas": _build_financiamento_metas(),
            "elementos_futuros": {
                "nota_tecnica": (
                    "Estrutura extensível via PostgreSQL JSONB para futuros módulos "
                    "(Vacinação, Assistência Farmacêutica, Regulação)."
                )
            },
        },
        "emendas_parlamentares": [],
        "indicadores_qualidade": _build_indicadores_qualidade(pop_row),
    }
