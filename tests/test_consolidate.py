import json
from datetime import date

import jsonschema

from etl_contract import build_payload


def _sample_raw_rows():
    return [
        {
            "tipo_relatorio": "atendimento_individual",
            "secao": "Resumo de produção",
            "descricao": "Registros identificados",
            "valores": {"quantidade": 540},
        },
        {
            "tipo_relatorio": "atendimento_individual",
            "secao": "Turno",
            "descricao": "Manhã",
            "valores": {"quantidade": 290},
        },
        {
            "tipo_relatorio": "atendimento_individual",
            "secao": "Turno",
            "descricao": "Tarde",
            "valores": {"quantidade": 249},
        },
        {
            "tipo_relatorio": "atendimento_odontologico",
            "secao": "Resumo de produção",
            "descricao": "Registros identificados",
            "valores": {"quantidade": 209},
        },
        {
            "tipo_relatorio": "atividade_coletiva",
            "secao": "Número de participantes",
            "descricao": "Total de participantes",
            "valores": {"quantidade": 810},
        },
        {
            "tipo_relatorio": "atividade_coletiva",
            "secao": "Temas para saúde",
            "descricao": "Alimentação saudável",
            "valores": {"quantidade": 37},
        },
        {
            "tipo_relatorio": "procedimentos_individualizados",
            "secao": "Resumo de produção",
            "descricao": "Registros identificados",
            "valores": {"quantidade": 1426},
        },
        {
            "tipo_relatorio": "procedimentos_individualizados",
            "secao": "Turno",
            "descricao": "Manhã",
            "valores": {"quantidade": 882},
        },
        {
            "tipo_relatorio": "procedimentos_individualizados",
            "secao": "Turno",
            "descricao": "Tarde",
            "valores": {"quantidade": 543},
        },
    ]


def test_build_payload_matches_schema(contrato_schema):
    payload = build_payload(
        competencia=date(2026, 5, 1),
        municipio="AMERICANA",
        unidade="CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO",
        equipe="EQUIPE 9 EAP",
        raw_rows=_sample_raw_rows(),
    )

    jsonschema.validate(payload, contrato_schema)
    assert payload["versao_schema"] == "3.1.0"
    assert payload["kpis_gerais"]["total_atendimentos_aps"] == 540
    assert payload["kpis_gerais"]["atendimentos_odonto"] == 209
    assert payload["kpis_gerais"]["total_participantes_coletivos"] == 810


def test_null_indicator_values_remain_null():
    payload = build_payload(
        competencia=date(2026, 5, 1),
        municipio="AMERICANA",
        unidade="U",
        equipe="E",
        raw_rows=[],
    )

    for item in payload["indicadores_qualidade"]:
        assert item["exec"] is None
        assert item["meta"] is None

    for item in payload["modulos"]["financiamento_metas"]["componente_qualidade_aps"][
        "indicadores"
    ]:
        assert item["valor"] is None
        assert item["meta"] is None


def test_sia_merge_updates_ambulatorial_module():
    payload = build_payload(
        competencia=date(2026, 5, 1),
        municipio="AMERICANA",
        unidade="U",
        equipe="E",
        raw_rows=[],
        sia_rows=[
            {
                "codigo_sigtap": "0205020046",
                "descricao": "ULTRASSONOGRAFIA DE ABDOMEN TOTAL",
                "quantidade": 11,
            }
        ],
        mysql_available=True,
    )

    amb = payload["modulos"]["ambulatorial_sia"]
    assert amb["status_conexao"] == "MySQL_XAMPP_CONNECTED"
    assert amb["procedimentos_especializados"][0]["quantidade"] == 11
    assert payload["kpis_gerais"]["total_procedimentos_ambulatoriais"] == 11
