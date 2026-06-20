import json
from pathlib import Path

import pytest

import parse_esus_csv as parser


def test_detects_report_type_and_competencia(sample_csv):
    meta, sections = parser.parse_report(sample_csv)

    assert meta["tipo_relatorio"] == "atendimento_individual"
    assert str(meta["competencia"]) == "2026-05-01"
    assert meta["unidade"] == "CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO"
    assert meta["equipe_nome"] == "EQUIPE 9 EAP"
    assert sections


def test_iso8859_encoding(tmp_path):
    content = (
        "e-SUS APS\n"
        "MINISTÉRIO DA SAÚDE\n"
        "ESTADO DE SÃO PAULO\n"
        "MUNICÍPIO DE AMERICANA\n"
        "UNIDADE DE SAÚDE CAFI\n"
        "\n"
        "Relatório de atendimento individual - Analítico\n"
        "\n"
        "FILTROS\n"
        "Período;01/05/2026 a 31/05/2026;\n"
        "Equipe;0001 - EQUIPE TESTE;\n"
        "\n"
        "Resumo de produção\n"
        "Descrição;Quantidade;\n"
        "Registros identificados;10;\n"
    ).encode("latin-1")

    path = tmp_path / "latin1.csv"
    path.write_bytes(content)

    meta, _ = parser.parse_report(path)
    assert meta["tipo_relatorio"] == "atendimento_individual"
    assert meta["equipe_nome"] == "EQUIPE TESTE"


def test_json_out_interface(sample_csv):
    reports = parser.collect_reports(sample_csv)
    output = []
    for meta, sections in reports:
        entry = {
            key: str(value) if hasattr(value, "isoformat") else value
            for key, value in meta.items()
        }
        entry["sections_count"] = len(sections)
        entry["indicadores_count"] = sum(len(rows) for _, rows in sections)
        output.append(entry)

    assert isinstance(output, list)
    assert output[0]["tipo_relatorio"] == "atendimento_individual"
    assert str(output[0]["competencia"]).startswith("2026-05")
    assert json.dumps(output, ensure_ascii=False)


def test_collect_reports_from_directory(repo_root):
    reports = parser.collect_reports(repo_root)
    tipos = {meta["tipo_relatorio"] for meta, _ in reports}
    assert "atendimento_individual" in tipos
    assert "atividade_coletiva" in tipos
