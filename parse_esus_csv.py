#!/usr/bin/env python3
"""
SIMPA - Parser de relatorios analiticos do e-SUS APS
=====================================================

Le os arquivos .csv exportados do e-SUS APS (relatorios "Analitico":
atendimento individual, atendimento domiciliar, atendimento odontologico,
atividade coletiva, marcadores de consumo alimentar, procedimentos individualizados) e gera
um script SQL de seed para as tabelas:

    - esus_cargas
    - esus_indicadores_raw

(ver schema_esus.sql).

Uso:
    python3 parse_esus_csv.py <pasta_com_csvs> <arquivo_saida.sql>

Os arquivos de entrada devem estar em UTF-8 (os exports do e-SUS vem em
ISO-8859-1 / Latin-1 -- converta antes com `iconv -f ISO-8859-1 -t UTF-8`).
"""

import argparse
import json
import os
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

# Mapeia o titulo do relatorio (linha 7 do arquivo) para o tipo_relatorio
# usado na coluna CHECK de esus_cargas.
TIPO_RELATORIO_MAP = {
    "Relatório de atendimento individual - Analítico": "atendimento_individual",
    "Relatório de atendimento domiciliar - Analítico": "atendimento_domiciliar",
    "Relatório de atendimento odontológico - Analítico": "atendimento_odontologico",
    "Relatório de atividade coletiva - Analítico": "atividade_coletiva",
    "Relatório de marcadores de consumo alimentar - Analítico": "marcadores_consumo_alimentar",
    "Relatório de procedimentos individualizados - Analítico": "procedimentos_individualizados",
    "Relatório de cadastro individual - Analítico": "cadastro_individual",
}

# Mapa: normalize_key(nome da seção) → categoria de campo em populacao_cadastrada
CADASTRO_SECTION_MAP = {
    "dados_gerais": "dados_gerais",
    "identificacao_do_usuario_cidadao_faixa_etaria": "faixa_etaria",
    "identificacao_do_usuario_cidadao_sexo": "sexo",
    "identificacao_do_usuario_cidadao_raca_cor": "raca_cor",
    "condicoes_situacoes_de_saude_gerais": "condicoes_saude",
    "informacoes_sociodemograficas_deficiencia": "deficiencia",
    "informacoes_sociodemograficas_situacao_no_mercado_de_trabalho": "mercado_trabalho",
    "informacoes_sociodemograficas_qual_e_o_curso_mais_elevado_que_frequenta_ou_frequentou": "escolaridade",
    "outras_informacoes_sociodemograficas": "outras_sociodemograficas",
    "informacoes_sociodemograficas_relacao_de_parentesco_com_o_responsavel_familiar": "parentesco",
    "informacoes_sociodemograficas_criancas_de_0_a_9_anos_com_quem_fica": "criancas_com_quem_fica",
}

# Mapa: normalize_key(descrição da condição) → chave limpa em condicoes_saude JSONB
CONDICOES_SAUDE_MAP = {
    "esta_gestante": "gestante",
    "tem_hipertensao_arterial": "hipertensao",
    "tem_diabetes": "diabetes",
    "esta_fumante": "fumante",
    "esta_acamado": "acamado",
    "teve_avc_derrame": "avc_derrame",
    "tem_ou_teve_cancer": "cancer",
    "teve_diagnostico_de_algum_problema_de_saude_mental_por_profissional_de_saude": "saude_mental",
    "faz_uso_de_alcool": "alcool",
    "esta_com_tuberculose": "tuberculose",
    "esta_com_hanseniase": "hanseniase",
    "teve_infarto": "infarto",
    "esta_domiciliado": "domiciliado",
    "faz_uso_de_outras_drogas": "drogas",
    "teve_internacao_nos_ultimos_12_meses": "internacao_12m",
    "usa_plantas_medicinais": "plantas_medicinais",
}

# Linhas de cabecalho institucional que nunca sao secoes de dados
HEADER_PREFIXES = (
    "e-SUS",
    "MINISTÉRIO",
    "ESTADO DE",
    "MUNICÍPIO DE",
    "UNIDADE DE SAÚDE",
    "Dados processados em",
    "Gerado em",
)


def normalize_key(s: str) -> str:
    """'Quantidade Solicitada' -> 'quantidade_solicitada'; 'Não informado' -> 'nao_informado'"""
    s = s.strip()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def parse_value(v: str):
    v = v.strip()
    if v == "":
        return None
    try:
        return int(v)
    except ValueError:
        pass
    try:
        return float(v.replace(".", "").replace(",", "."))
    except ValueError:
        return v


def parse_br_date(s: str):
    return datetime.strptime(s.strip(), "%d/%m/%Y").date()


def read_lines(path: Path):
    """Lê CSV e-SUS (UTF-8 ou ISO-8859-1 / Latin-1)."""
    for encoding in ("utf-8", "latin-1"):
        try:
            with open(path, encoding=encoding) as f:
                return [line.rstrip("\n") for line in f]
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Encoding não suportado em {path.name}")


def parse_report(path: Path):
    lines = read_lines(path)

    meta = {
        "arquivo_origem": path.name,
        "municipio": "AMERICANA",
    }

    # Titulo do relatorio -> tipo_relatorio
    titulo = lines[6].strip()
    meta["tipo_relatorio"] = TIPO_RELATORIO_MAP.get(titulo)
    if meta["tipo_relatorio"] is None:
        raise ValueError(f"Título de relatório não reconhecido: {titulo!r} em {path.name}")

    # Unidade (linha 5: 'UNIDADE DE SAÚDE <nome>')
    unidade_line = lines[4].strip()
    meta["unidade"] = unidade_line.replace("UNIDADE DE SAÚDE ", "", 1).strip()

    # Bloco FILTROS
    for i, line in enumerate(lines):
        if line.strip() == "FILTROS":
            j = i + 1
            while lines[j].strip() != "":
                parts = [p for p in lines[j].split(";") if p != ""]
                if len(parts) >= 2:
                    key = normalize_key(parts[0])
                    meta[f"filtro_{key}"] = parts[1].strip()
                j += 1
            break

    # Periodo -> periodo_inicio / periodo_fim / competencia
    periodo = meta.get("filtro_periodo", "")
    m = re.match(r"(\d{2}/\d{2}/\d{4})\s+a\s+(\d{2}/\d{2}/\d{4})", periodo)
    if m:
        meta["periodo_inicio"] = parse_br_date(m.group(1))
        meta["periodo_fim"] = parse_br_date(m.group(2))
        meta["competencia"] = meta["periodo_inicio"].replace(day=1)
    elif meta.get("filtro_data"):
        # Cadastro individual usa "Data;DD/MM/YYYY" ao invés de "Período;... a ..."
        data = parse_br_date(meta["filtro_data"])
        meta["periodo_fim"] = data
        meta["periodo_inicio"] = data.replace(day=1)
        meta["competencia"] = data.replace(day=1)

    # Equipe -> equipe_codigo / equipe_nome
    equipe = meta.get("filtro_equipe", "Todas")
    m = re.match(r"(\d+)\s*-\s*(.+)", equipe)
    if m:
        meta["equipe_codigo"] = m.group(1)
        meta["equipe_nome"] = m.group(2).strip()
    else:
        meta["equipe_codigo"] = None
        meta["equipe_nome"] = equipe.strip()

    meta["profissional"] = meta.get("filtro_profissional", "Todos")
    meta["cbo"] = meta.get("filtro_cbo", "Todos")
    meta["filtros_personalizados"] = meta.get("filtro_filtros_personalizados", "Nenhum")

    # Dados processados em / Gerado em
    for line in lines:
        if line.startswith("Dados processados em"):
            parts = [p.strip() for p in line.split(";") if p.strip()]
            try:
                meta["dados_processados_em"] = datetime.strptime(
                    f"{parts[1]} {parts[3]}", "%d/%m/%Y %H:%M"
                )
            except (IndexError, ValueError):
                pass
        elif line.startswith("Gerado em"):
            parts = [p.strip() for p in line.split(";") if p.strip()]
            try:
                meta["relatorio_gerado_em"] = datetime.strptime(
                    f"{parts[1]} {parts[3]}", "%d/%m/%Y %H:%M"
                )
                meta["relatorio_gerado_por"] = parts[-1]
            except (IndexError, ValueError):
                pass

    # ------------------------------------------------------------
    # Secoes de indicadores: "Nome da secao" seguido (eventualmente
    # apos linhas de nota) por "Descrição;Col1;Col2;...;"
    # ------------------------------------------------------------
    sections = []
    n = len(lines)
    i = 0
    while i < n:
        line = lines[i].strip()
        is_candidate = (
            line
            and ";" not in line
            and "Relatório de" not in line
            and line != "FILTROS"
            and not line.startswith(HEADER_PREFIXES)
        )
        if is_candidate:
            section_name = line
            j = i + 1
            # pula linhas de nota (sem ';') ate achar o cabecalho ou secao terminar
            while j < n and lines[j].strip() != "" and ";" not in lines[j]:
                j += 1
            if j < n and lines[j].startswith("Descrição;"):
                header_cols = [normalize_key(c) for c in lines[j].split(";") if c.strip() != ""][1:]
                k = j + 1
                rows = []
                ordem = 0
                while k < n and lines[k].strip() != "":
                    parts = lines[k].split(";")
                    while parts and parts[-1] == "":
                        parts.pop()
                    if parts:
                        descricao = parts[0].strip()
                        valores = {}
                        for col, val in zip(header_cols, parts[1:]):
                            valores[col] = parse_value(val)
                        rows.append((descricao, ordem, valores))
                        ordem += 1
                    k += 1
                sections.append((section_name, rows))
                i = k
                continue
        i += 1

    _finalize_registros_meta(meta, sections)

    # Para cadastro_individual: extrair cidadaos_ativos/saidas no meta (usado em --json-out e preview)
    if meta.get("tipo_relatorio") == "cadastro_individual":
        for sec_name, rows in sections:
            if normalize_key(sec_name) == "dados_gerais":
                for descricao, _, valores in rows:
                    k = normalize_key(descricao)
                    if k == "cidadaos_ativos":
                        meta["cidadaos_ativos"] = int(valores.get("quantidade") or 0)
                    elif k == "saida_de_cidadaos_do_cadastro":
                        meta["saidas_cadastro"] = int(valores.get("quantidade") or 0)
                break

    return meta, sections


def _apply_registros_resumo(meta: dict, sections: list) -> None:
    for sec_name, rows in sections:
        if sec_name != "Resumo de produção":
            continue
        for descricao, _, valores in rows:
            qtd = valores.get("quantidade")
            if descricao == "Registros identificados":
                meta["registros_identificados"] = qtd
            elif descricao == "Registros não identificados":
                meta["registros_nao_identificados"] = qtd
            elif descricao == "Total de registros":
                meta["registros_identificados"] = qtd
                meta.setdefault("registros_nao_identificados", 0)


def _infer_registros_from_turno(sections: list) -> tuple[int | None, int | None]:
    """Fallback quando o export e-SUS omite a seção Resumo de produção."""
    for sec_name, rows in sections:
        if sec_name != "Turno":
            continue
        total = 0
        found = False
        for _, _, valores in rows:
            qtd = valores.get("quantidade")
            if qtd is not None:
                total += int(qtd)
                found = True
        if found and total > 0:
            return total, 0
    return None, None


def _finalize_registros_meta(meta: dict, sections: list) -> None:
    _apply_registros_resumo(meta, sections)
    if "registros_identificados" not in meta:
        total, nao_id = _infer_registros_from_turno(sections)
        if total is not None:
            meta["registros_identificados"] = total
            meta["registros_nao_identificados"] = nao_id
    meta.setdefault("registros_identificados", None)
    meta.setdefault("registros_nao_identificados", None)


def sql_str(v):
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def sql_ts(v):
    if v is None:
        return "NULL"
    return "'" + v.strftime("%Y-%m-%d %H:%M:%S") + "'"


def sql_date(v):
    if v is None:
        return "NULL"
    return "'" + v.isoformat() + "'"


def sql_int(v):
    if v is None:
        return "NULL"
    return str(int(v))


def build_sql(reports):
    out = []
    out.append("-- ============================================================================")
    out.append("-- SIMPA - Seed inicial e-SUS APS (gerado automaticamente por parse_esus_csv.py)")
    out.append(f"-- Gerado em: {datetime.now().isoformat(timespec='seconds')}")
    out.append("-- ============================================================================")
    out.append("")
    out.append("BEGIN;")
    out.append("")

    for meta, sections in reports:
        out.append("-- ----------------------------------------------------------------------------")
        out.append(f"-- Carga: {meta['tipo_relatorio']} | {meta['unidade']} | "
                    f"equipe: {meta['equipe_nome']} | competência: {meta['competencia']}")
        out.append(f"-- Arquivo de origem: {meta['arquivo_origem']}")
        out.append("-- ----------------------------------------------------------------------------")
        out.append("INSERT INTO esus_cargas (")
        out.append("    tipo_relatorio, competencia, periodo_inicio, periodo_fim,")
        out.append("    municipio, unidade, equipe_codigo, equipe_nome, profissional, cbo,")
        out.append("    filtros_personalizados, dados_processados_em, relatorio_gerado_em,")
        out.append("    relatorio_gerado_por, registros_identificados, registros_nao_identificados,")
        out.append("    arquivo_origem")
        out.append(") VALUES (")
        out.append(f"    {sql_str(meta['tipo_relatorio'])}, {sql_date(meta['competencia'])}, "
                    f"{sql_date(meta['periodo_inicio'])}, {sql_date(meta['periodo_fim'])},")
        out.append(f"    {sql_str(meta['municipio'])}, {sql_str(meta['unidade'])}, "
                    f"{sql_str(meta.get('equipe_codigo'))}, {sql_str(meta['equipe_nome'])}, "
                    f"{sql_str(meta['profissional'])}, {sql_str(meta['cbo'])},")
        out.append(f"    {sql_str(meta['filtros_personalizados'])}, "
                    f"{sql_ts(meta.get('dados_processados_em'))}, "
                    f"{sql_ts(meta.get('relatorio_gerado_em'))},")
        out.append(f"    {sql_str(meta.get('relatorio_gerado_por'))}, "
                    f"{sql_int(meta.get('registros_identificados'))}, "
                    f"{sql_int(meta.get('registros_nao_identificados'))},")
        out.append(f"    {sql_str(meta['arquivo_origem'])}")
        out.append(")")
        out.append("ON CONFLICT (tipo_relatorio, competencia, unidade, equipe_nome) DO UPDATE SET")
        out.append("    arquivo_origem = EXCLUDED.arquivo_origem,")
        out.append("    importado_em = now();")
        out.append("")

        # Indicadores: resolve o carga_id por subquery (funciona tanto para INSERT novo quanto para UPDATE de conflito acima)
        value_rows = []
        for sec_name, rows in sections:
            for descricao, ordem, valores in rows:
                value_rows.append(
                    f"((SELECT id FROM c), {sql_str(sec_name)}, {sql_str(descricao)}, "
                    f"{ordem}, '{json.dumps(valores, ensure_ascii=False)}'::jsonb)"
                )

        if value_rows:
            out.append("-- Indicadores da carga acima (resolve o id via subquery, ja que pode ter sido INSERT ou UPDATE)")
            out.append("WITH c AS (")
            out.append("    SELECT id FROM esus_cargas")
            out.append(f"    WHERE tipo_relatorio = {sql_str(meta['tipo_relatorio'])}")
            out.append(f"      AND competencia = {sql_date(meta['competencia'])}")
            out.append(f"      AND unidade = {sql_str(meta['unidade'])}")
            out.append(f"      AND equipe_nome = {sql_str(meta['equipe_nome'])}")
            out.append(")")
            out.append("INSERT INTO esus_indicadores_raw (carga_id, secao, descricao, ordem, valores) VALUES")
            out.append(",\n".join(value_rows))
            out.append("ON CONFLICT (carga_id, secao, descricao) DO UPDATE SET valores = EXCLUDED.valores;")
        out.append("")

    out.append("COMMIT;")
    return "\n".join(out)


def build_carga_params(meta, estabelecimento_id=None, equipe_id=None):
    params = {
        "tipo_relatorio": meta["tipo_relatorio"],
        "competencia": meta["competencia"],
        "periodo_inicio": meta["periodo_inicio"],
        "periodo_fim": meta["periodo_fim"],
        "municipio": meta["municipio"],
        "unidade": meta["unidade"],
        "equipe_codigo": meta.get("equipe_codigo"),
        "equipe_nome": meta["equipe_nome"],
        "profissional": meta["profissional"],
        "cbo": meta["cbo"],
        "filtros_personalizados": meta["filtros_personalizados"],
        "dados_processados_em": meta.get("dados_processados_em"),
        "relatorio_gerado_em": meta.get("relatorio_gerado_em"),
        "relatorio_gerado_por": meta.get("relatorio_gerado_por"),
        "registros_identificados": meta.get("registros_identificados"),
        "registros_nao_identificados": meta.get("registros_nao_identificados"),
        "arquivo_origem": meta["arquivo_origem"],
    }
    if estabelecimento_id is not None:
        params["estabelecimento_id"] = estabelecimento_id
    if equipe_id is not None:
        params["equipe_id"] = equipe_id
    return params


def carga_insert_sql(use_id_conflict):
    fk_columns = ""
    fk_values = ""
    if use_id_conflict:
        fk_columns = ", estabelecimento_id, equipe_id"
        fk_values = ", %(estabelecimento_id)s, %(equipe_id)s"

    conflict = (
        """
        ON CONFLICT (tipo_relatorio, competencia, estabelecimento_id, equipe_id)
        WHERE estabelecimento_id IS NOT NULL AND equipe_id IS NOT NULL
        DO UPDATE SET
            unidade = EXCLUDED.unidade,
            equipe_codigo = EXCLUDED.equipe_codigo,
            equipe_nome = EXCLUDED.equipe_nome,
            arquivo_origem = EXCLUDED.arquivo_origem,
            importado_em = now()
        """
        if use_id_conflict
        else """
        ON CONFLICT (tipo_relatorio, competencia, unidade, equipe_nome)
        DO UPDATE SET
            arquivo_origem = EXCLUDED.arquivo_origem,
            importado_em = now()
        """
    )

    return f"""
        INSERT INTO esus_cargas (
            tipo_relatorio, competencia, periodo_inicio, periodo_fim,
            municipio, unidade, equipe_codigo, equipe_nome,
            profissional, cbo, filtros_personalizados,
            dados_processados_em, relatorio_gerado_em,
            relatorio_gerado_por, registros_identificados,
            registros_nao_identificados, arquivo_origem{fk_columns}
        ) VALUES (
            %(tipo_relatorio)s, %(competencia)s, %(periodo_inicio)s,
            %(periodo_fim)s, %(municipio)s, %(unidade)s,
            %(equipe_codigo)s, %(equipe_nome)s, %(profissional)s,
            %(cbo)s, %(filtros_personalizados)s,
            %(dados_processados_em)s, %(relatorio_gerado_em)s,
            %(relatorio_gerado_por)s, %(registros_identificados)s,
            %(registros_nao_identificados)s, %(arquivo_origem)s{fk_values}
        )
        {conflict}
        RETURNING id
        """


def _build_populacao_from_sections(sections: list) -> dict:
    """Converte seções do cadastro individual em dict estruturado para populacao_cadastrada."""
    result: dict = {
        "cidadaos_ativos": 0,
        "saidas": 0,
        "sexo_masculino": None,
        "sexo_feminino": None,
        "faixa_etaria": [],
        "condicoes_saude": {},
        "raca_cor": {},
        "sociodemografico": {},
        "extras": {},
    }

    for sec_name, rows in sections:
        field = CADASTRO_SECTION_MAP.get(normalize_key(sec_name))

        if field == "dados_gerais":
            for descricao, _, valores in rows:
                k = normalize_key(descricao)
                if k == "cidadaos_ativos":
                    result["cidadaos_ativos"] = int(valores.get("quantidade") or 0)
                elif k == "saida_de_cidadaos_do_cadastro":
                    result["saidas"] = int(valores.get("quantidade") or 0)

        elif field == "faixa_etaria":
            for descricao, _, valores in rows:
                if descricao:
                    result["faixa_etaria"].append({
                        "faixa": descricao,
                        "masculino": int(valores.get("masculino") or 0),
                        "feminino": int(valores.get("feminino") or 0),
                        "indeterminado": int(valores.get("indeterminado") or 0),
                        "nao_informado": int(valores.get("nao_informado") or 0),
                    })

        elif field == "sexo":
            for descricao, _, valores in rows:
                k = normalize_key(descricao)
                if k == "masculino":
                    result["sexo_masculino"] = int(valores.get("quantidade") or 0)
                elif k == "feminino":
                    result["sexo_feminino"] = int(valores.get("quantidade") or 0)

        elif field == "raca_cor":
            for descricao, _, valores in rows:
                if descricao:
                    k = normalize_key(descricao)
                    result["raca_cor"][k] = int(valores.get("quantidade") or 0)

        elif field == "condicoes_saude":
            for descricao, _, valores in rows:
                raw_key = normalize_key(descricao)
                clean_key = CONDICOES_SAUDE_MAP.get(raw_key, raw_key)
                result["condicoes_saude"][clean_key] = {
                    "sim": int(valores.get("sim") or 0),
                    "nao": int(valores.get("nao") or 0),
                    "nao_informado": int(valores.get("nao_informado") or 0),
                }

        elif field == "deficiencia":
            defic: dict = {}
            for descricao, _, valores in rows:
                raw_key = normalize_key(descricao)
                if "tem_alguma_deficiencia" in raw_key:
                    sub = str(valores.get("sub_descricao") or "").lower()
                    if "sim" in sub:
                        defic["sim"] = int(valores.get("quantidade") or 0)
                    elif sub and "sim" not in sub and "n" in sub[:2]:
                        defic["nao"] = int(valores.get("quantidade") or 0)
                elif descricao:
                    defic[raw_key] = int(valores.get("quantidade") or 0)
            if defic:
                result["condicoes_saude"]["deficiencia"] = defic

        elif field in ("mercado_trabalho", "escolaridade", "outras_sociodemograficas",
                       "parentesco", "criancas_com_quem_fica"):
            sec_data: dict = {}
            for descricao, _, valores in rows:
                if descricao:
                    k = normalize_key(descricao)
                    qtd = valores.get("quantidade")
                    sec_data[k] = int(qtd) if qtd is not None else valores
            result["sociodemografico"][field] = sec_data

        else:
            # Seção não mapeada → extras (compatibilidade com versões futuras do e-SUS PEC)
            sec_data = {}
            for descricao, _, valores in rows:
                if descricao:
                    k = normalize_key(descricao)
                    sec_data[k] = valores
            if sec_data:
                result["extras"][normalize_key(sec_name)] = sec_data

    return result


def _write_cadastro_to_pg(meta, sections, cur, estabelecimento_id, equipe_id, use_id_conflict):
    """Escreve cadastro individual em esus_cargas + populacao_cadastrada (nunca em esus_indicadores_raw)."""
    if estabelecimento_id is None:
        raise ValueError("cadastro_individual requer --estabelecimento-id")

    insert_sql = carga_insert_sql(use_id_conflict)
    carga_params = build_carga_params(meta, estabelecimento_id, equipe_id)
    cur.execute(insert_sql, carga_params)
    carga_id = cur.fetchone()[0]

    pop = _build_populacao_from_sections(sections)

    cur.execute(
        """
        INSERT INTO populacao_cadastrada (
            carga_id, estabelecimento_id, competencia,
            cidadaos_ativos, saidas, sexo_masculino, sexo_feminino,
            faixa_etaria, condicoes_saude, raca_cor, sociodemografico, extras
        ) VALUES (%s, %s, %s, %s, %s, %s, %s,
                  %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb)
        ON CONFLICT (competencia, estabelecimento_id) DO UPDATE SET
            carga_id         = EXCLUDED.carga_id,
            cidadaos_ativos  = EXCLUDED.cidadaos_ativos,
            saidas           = EXCLUDED.saidas,
            sexo_masculino   = EXCLUDED.sexo_masculino,
            sexo_feminino    = EXCLUDED.sexo_feminino,
            faixa_etaria     = EXCLUDED.faixa_etaria,
            condicoes_saude  = EXCLUDED.condicoes_saude,
            raca_cor         = EXCLUDED.raca_cor,
            sociodemografico = EXCLUDED.sociodemografico,
            extras           = EXCLUDED.extras,
            importado_em     = now()
        """,
        (
            carga_id,
            estabelecimento_id,
            meta["competencia"],
            pop["cidadaos_ativos"],
            pop["saidas"],
            pop["sexo_masculino"],
            pop["sexo_feminino"],
            json.dumps(pop["faixa_etaria"], ensure_ascii=False),
            json.dumps(pop["condicoes_saude"], ensure_ascii=False),
            json.dumps(pop["raca_cor"], ensure_ascii=False),
            json.dumps(pop["sociodemografico"], ensure_ascii=False),
            json.dumps(pop["extras"], ensure_ascii=False),
        ),
    )

    return {
        "carga_id": carga_id,
        "tipo_relatorio": meta["tipo_relatorio"],
        "competencia": str(meta["competencia"]),
        "unidade": meta["unidade"],
        "equipe_nome": meta["equipe_nome"],
        "cidadaos_ativos": pop["cidadaos_ativos"],
        "indicadores": 0,
        "status": "ok",
    }


def write_to_pg(reports, estabelecimento_id=None, equipe_id=None):
    """Grava lista de (meta, sections) no PostgreSQL via psycopg2."""
    import psycopg2

    load_dotenv()
    conn = psycopg2.connect(
        host=os.environ["PG_HOST"],
        port=os.environ["PG_PORT"],
        dbname=os.environ["PG_DB"],
        user=os.environ["PG_USER"],
        password=os.environ["PG_PASS"],
    )
    results = []
    use_id_conflict = estabelecimento_id is not None and equipe_id is not None
    insert_sql = carga_insert_sql(use_id_conflict)
    try:
        with conn:
            with conn.cursor() as cur:
                for meta, sections in reports:
                    # Cadastro individual: rota dedicada para populacao_cadastrada
                    if meta["tipo_relatorio"] == "cadastro_individual":
                        result = _write_cadastro_to_pg(
                            meta, sections, cur, estabelecimento_id, equipe_id, use_id_conflict
                        )
                        results.append(result)
                        continue

                    carga_params = build_carga_params(
                        meta, estabelecimento_id, equipe_id
                    )
                    cur.execute(insert_sql, carga_params)
                    carga_id = cur.fetchone()[0]

                    for sec_name, rows in sections:
                        for descricao, ordem, valores in rows:
                            cur.execute(
                                """
                                INSERT INTO esus_indicadores_raw
                                    (carga_id, secao, descricao, ordem, valores)
                                VALUES (%s, %s, %s, %s, %s)
                                ON CONFLICT (carga_id, secao, descricao)
                                DO UPDATE SET valores = EXCLUDED.valores
                                """,
                                (
                                    carga_id,
                                    sec_name,
                                    descricao,
                                    ordem,
                                    json.dumps(valores, ensure_ascii=False),
                                ),
                            )

                    n_ind = sum(len(r) for _, r in sections)
                    result = {
                        "carga_id": carga_id,
                        "tipo_relatorio": meta["tipo_relatorio"],
                        "competencia": str(meta["competencia"]),
                        "unidade": meta["unidade"],
                        "equipe_nome": meta["equipe_nome"],
                        "registros_identificados": meta.get("registros_identificados"),
                        "registros_nao_identificados": meta.get(
                            "registros_nao_identificados"
                        ),
                        "indicadores": n_ind,
                        "status": "ok",
                    }
                    if use_id_conflict:
                        result["estabelecimento_id"] = estabelecimento_id
                        result["equipe_id"] = equipe_id
                    results.append(result)
    finally:
        conn.close()
    return results


def collect_reports(src: Path):
    reports = []
    if src.is_dir():
        paths = sorted(src.glob("*.csv"))
    elif src.is_file():
        paths = [src]
    else:
        print(f"Erro: {src} não encontrado", file=sys.stderr)
        sys.exit(1)

    for path in paths:
        meta, sections = parse_report(path)
        reports.append((meta, sections))
    return reports


def main():
    parser = argparse.ArgumentParser(description="SIMPA — Parser e-SUS APS")
    parser.add_argument("input", help="Arquivo .csv ou pasta com .csvs")
    parser.add_argument("output", nargs="?", help="Arquivo .sql de saída (modo legado)")
    parser.add_argument(
        "--json-out",
        action="store_true",
        help="Imprime JSON no stdout (sem gravar no banco)",
    )
    parser.add_argument(
        "--pg-write",
        action="store_true",
        help="Grava direto no PostgreSQL via psycopg2",
    )
    parser.add_argument(
        "--estabelecimento-id",
        type=int,
        help="FK estabelecimentos.id (obrigatório com --pg-write)",
    )
    parser.add_argument(
        "--equipe-id",
        type=int,
        help="FK equipes.id (obrigatório com --pg-write)",
    )
    args = parser.parse_args()

    reports = collect_reports(Path(args.input))

    if args.json_out:
        output = []
        for meta, sections in reports:
            entry = {
                k: str(v) if hasattr(v, "isoformat") else v for k, v in meta.items()
            }
            entry["sections_count"] = len(sections)
            entry["indicadores_count"] = sum(len(r) for _, r in sections)
            output.append(entry)
        print(json.dumps(output, ensure_ascii=False, default=str))
        return

    if args.pg_write:
        if args.estabelecimento_id is None:
            print(
                "Erro: --pg-write exige --estabelecimento-id",
                file=sys.stderr,
            )
            sys.exit(1)
        if args.equipe_id is None:
            print(
                "Erro: --pg-write exige --equipe-id",
                file=sys.stderr,
            )
            sys.exit(1)
        load_dotenv()
        results = write_to_pg(
            reports,
            estabelecimento_id=args.estabelecimento_id,
            equipe_id=args.equipe_id,
        )
        print(json.dumps(results, ensure_ascii=False, default=str))
        return

    if not args.output:
        print(
            "Erro: informe o arquivo de saída .sql ou use --json-out/--pg-write",
            file=sys.stderr,
        )
        sys.exit(1)

    for meta, sections in reports:
        n_indicadores = sum(len(rows) for _, rows in sections)
        print(
            f"OK  {meta['arquivo_origem']} -> {meta['tipo_relatorio']} "
            f"({meta['competencia']}, {meta['unidade']}, {meta['equipe_nome']}) "
            f"- {len(sections)} seções, {n_indicadores} indicadores"
        )

    sql = build_sql(reports)
    Path(args.output).write_text(sql, encoding="utf-8")
    print(f"\nSeed SQL gerado em: {args.output}")


if __name__ == "__main__":
    main()
