#!/usr/bin/env python3
"""Generate seed_esus_sigtap_depara.sql from curated e-SUS APS ↔ SIGTAP mappings.

Sources:
  - Municipal spreadsheet screenshots (2026-07-26) — truncated codes completed via LEDI
  - LEDI e-SUS APS v7.3.2 Ficha de Procedimentos + FAO (competência SIGTAP 08/2025)
  - Exact e-SUS labels from seed_esus_2026-05.sql / parse_esus_csv.py
  - Local PG procedimentos catalog for description text when available

Excluded (LEDI "Não possui" SIGTAP): Teste do olhinho (TRV).
Third municipal spreadsheet (clinical truncated list) omitted — no matching
e-SUS secao in CAFI exports; add via CRUD when section is confirmed.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "seed_esus_sigtap_depara.sql"

# (codigo_sigtap, descricao_oficial, tipo)
PROCS: list[tuple[str, str, str]] = []

# (secao, descricao_esus, codigo_sigtap, origem)
MAPS: list[tuple[str, str, str, str]] = []


def add_proc(code: str, desc: str, tipo: str = "ambulatorial") -> None:
    code = code.replace(".", "").replace("-", "")
    assert len(code) == 10 and code.isdigit(), code
    PROCS.append((code, desc, tipo))


def add_map(secao: str, label: str, code: str, origem: str = "seed") -> None:
    code = code.replace(".", "").replace("-", "")
    assert len(code) == 10 and code.isdigit(), code
    MAPS.append((secao, label, code, origem))


# --- Procedimentos / Pequenas cirurgias (LEDI FP) ---
PC = "Procedimentos / Pequenas cirurgias"
pequenas = [
    ("0309050022", "SESSÃO DE ACUPUNTURA COM INSERÇÃO DE AGULHAS", "Acupuntura com inserção de agulhas"),
    ("0101040059", "ADMINISTRAÇÃO DE VITAMINA A", "Administração de vitamina A"),
    ("0301100047", "CATETERISMO VESICAL DE ALÍVIO", "Cateterismo vesical de alívio"),
    ("0303080019", "CAUTERIZAÇÃO QUÍMICA DE PEQUENAS LESÕES", "Cauterização química de pequenas lesões"),
    ("0401020177", "CIRURGIA DE UNHA (CANTOPLASTIA)", "Cirurgia de unha (cantoplastia)"),
    ("0201020033", "COLETA DE MATERIAL DO COLO DE ÚTERO PARA EXAME CITOPATOLÓGICO", "Coleta de citopatológico de colo uterino"),
    ("0301100063", "CUIDADOS COM ESTOMAS", "Cuidado de estomas"),
    ("0301100276", "CURATIVO ESPECIAL", "Curativo especial"),
    ("0401010031", "DRENAGEM DE ABSCESSO", "Drenagem de abscesso"),
    ("0211020036", "ELETROCARDIOGRAMA", "Eletrocardiograma"),
    ("0211060100", "FUNDOSCOPIA", "Exame de fundo de olho (Fundoscopia)"),
    ("0301040095", "EXAME DO PÉ DIABÉTICO", "Exame do pé diabético"),
    ("0401010074", "EXÉRESE DE TUMOR DE PELE E ANEXOS / CISTO SEBÁCEO / LIPOMA", "Exérese / Biópsia / Punção de tumores superficiais de pele"),
    ("0303090030", "INFILTRAÇÃO DE SUBSTÂNCIAS EM CAVIDADE SINOVIAL", "Infiltração em cavidade sinovial"),
    ("0404010300", "RETIRADA DE CORPO ESTRANHO DA CAVIDADE AUDITIVA E NASAL", "Remoção de corpo estranho da cavidade auditiva e nasal"),
    ("0401010112", "RETIRADA DE CORPO ESTRANHO SUBCUTÂNEO", "Remoção de corpo estranho subcutâneo"),
    ("0404010270", "REMOÇÃO DE CERUMEN DE CONDUTO AUDITIVO EXTERNO UNI / BILATERAL", "Retirada de cerume"),
    ("0301100152", "RETIRADA DE PONTOS DE CIRURGIAS (POR PACIENTE)", "Retirada de pontos de cirurgias básicas (por paciente)"),
    ("0401010066", "EXCISÃO E/OU SUTURA SIMPLES DE PEQUENAS LESÕES / FERIMENTOS DE PELE / ANEXOS E MUCOSA", "Sutura simples"),
    ("0404010342", "TAMPONAMENTO NASAL ANTERIOR E/OU POSTERIOR", "Tamponamento de epistaxe"),
    ("0211060275", "TRIAGEM OFTALMOLÓGICA", "Triagem oftalmológica"),
]
for code, desc, label in pequenas:
    add_proc(code, desc)
    add_map(PC, label, code)

# --- Teste rápido ---
TR = "Procedimentos - Teste rápido"
testes = [
    ("0214010066", "TESTE RÁPIDO DE GRAVIDEZ", "De gravidez"),
    ("0214010155", "TESTE RÁPIDO DE PROTEINÚRIA", "Dosagem de proteinúria"),
    ("0214010058", "TESTE RÁPIDO PARA DETECÇÃO DE ANTICORPOS ANTI-HIV PARA POPULAÇÃO GERAL", "Para HIV"),
    ("0214010090", "TESTE RÁPIDO PARA HEPATITE C", "Para hepatite C"),  # LEDI FP; may be absent in local sync
    ("0214010074", "TESTE RÁPIDO TREPONÊMICO (SÍFILIS) PARA POPULAÇÃO GERAL", "Para sífilis"),
]
for code, desc, label in testes:
    add_proc(code, desc)
    add_map(TR, label, code)

# --- Administração de medicamentos ---
AM = "Procedimentos - Administração de medicamentos"
meds = [
    ("0301100195", "ADMINISTRAÇÃO DE MEDICAMENTOS POR VIA ENDOVENOSA", "Endovenosa"),
    ("0301100101", "INALAÇÃO / NEBULIZAÇÃO", "Inalação / Nebulização"),
    ("0301100209", "ADMINISTRAÇÃO DE MEDICAMENTOS POR VIA INTRAMUSCULAR", "Intramuscular"),
    ("0301100217", "ADMINISTRAÇÃO DE MEDICAMENTOS POR VIA ORAL", "Oral"),
    ("0301100241", "ADMINISTRAÇÃO DE PENICILINA PARA TRATAMENTO DE SÍFILIS", "Penicilina para tratamento de sífilis"),
    ("0301100225", "ADMINISTRAÇÃO DE MEDICAMENTOS POR VIA SUBCUTÂNEA (SC)", "Subcutânea (SC)"),
    ("0301100233", "ADMINISTRAÇÃO TÓPICA DE MEDICAMENTO(S)", "Tópica"),
]
for code, desc, label in meds:
    add_proc(code, desc)
    add_map(AM, label, code)

# --- Odontológico: seção "Procedimentos" (LEDI FAO + municipal) ---
OD = "Procedimentos"
odonto = [
    ("0307020010", "ACESSO A POLPA DENTÁRIA E MEDICAÇÃO (POR DENTE)", "Acesso à polpa dentária e medicação (por dente)"),
    ("0307040143", "ADAPTAÇÃO DE PRÓTESE DENTÁRIA", "Adaptação de prótese dentária"),
    ("0101020058", "APLICAÇÃO DE CARIOSTÁTICO (POR DENTE)", "Aplicação de cariostático (por dente)"),
    ("0101020066", "APLICAÇÃO DE SELANTE (POR DENTE)", "Aplicação de selante (por dente)"),
    ("0101020074", "APLICAÇÃO TÓPICA DE FLÚOR (INDIVIDUAL POR SESSÃO)", "Aplicação tópica de flúor (individual por sessão)"),
    ("0307010015", "CAPEAMENTO PULPAR", "Capeamento pulpar"),
    ("0307040135", "CIMENTAÇÃO DE PRÓTESE DENTÁRIA", "Cimentação de prótese dentária"),
    ("0307020029", "CURATIVO DE DEMORA C/ OU S/ PREPARO BIOMECÂNICO", "Curativo de demora com ou sem preparo biomecânico"),
    ("0401010031", "DRENAGEM DE ABSCESSO", "Drenagem de abscesso"),
    ("0101020082", "EVIDENCIAÇÃO DE PLACA BACTERIANA", "Evidenciação de placa bacteriana"),
    ("0414020120", "EXODONTIA DE DENTE DECÍDUO", "Exodontia de dente decíduo"),
    ("0414020138", "EXODONTIA DE DENTE PERMANENTE", "Exodontia de dente permanente"),
    ("0307040160", "INSTALAÇÃO DE PRÓTESE DENTÁRIA", "Instalação de prótese dentária"),
    ("0307040070", "MOLDAGEM DENTO-GENGIVAL P/ CONSTRUÇÃO DE PRÓTESE DENTÁRIA", "Moldagem dentogengival para construção de prótese dentária"),
    ("0101020104", "ORIENTAÇÃO DE HIGIENE BUCAL", "Orientação de higiene bucal"),
    ("0307030040", "PROFILAXIA / REMOÇÃO DA PLACA BACTERIANA", "Profilaxia / Remoção da placa bacteriana"),
    ("0307020070", "PULPOTOMIA DENTÁRIA", "Pulpotomia dentária"),
    ("0204010217", "RADIOGRAFIA INTERPROXIMAL (BITE WING)", "Radiografia interproximal (bite wing)"),
    ("0204010225", "RADIOGRAFIA PERIAPICAL", "Radiografia periapical"),
    ("0307030059", "RASPAGEM ALISAMENTO E POLIMENTO SUPRAGENGIVAIS (POR SEXTANTE)", "Raspagem alisamento e polimento supragengivais (por sextante)"),
    ("0307030024", "RASPAGEM ALISAMENTO SUBGENGIVAIS (POR SEXTANTE)", "Raspagem alisamento subgengivais (por sextante)"),
    ("0307010031", "RESTAURAÇÃO DE DENTE PERMANENTE ANTERIOR COM RESINA COMPOSTA", "Restauração de dente permanente anterior com resina composta"),
    ("0307010120", "RESTAURAÇÃO DE DENTE PERMANENTE POSTERIOR COM RESINA COMPOSTA", "Restauração de dente permanente posterior com resina composta"),
    ("0301100152", "RETIRADA DE PONTOS DE CIRURGIAS (POR PACIENTE)", "Retirada de pontos de cirurgias básicas (por paciente)"),
    ("0101020090", "SELAMENTO PROVISÓRIO DE CAVIDADE DENTÁRIA", "Selamento provisório de cavidade dentária"),
    ("0414020383", "TRATAMENTO DE ALVEOLITE", "Tratamento de alveolite"),
    ("0414020405", "ULOTOMIA/ULECTOMIA", "Ulotomia / Ulectomia"),
]
for code, desc, label in odonto:
    add_proc(code, desc, "odontologico")
    add_map(OD, label, code)

# --- Native SIGTAP samples (unified consultation) ---
nativos = [
    ("Outros procedimentos (SIGTAP)", "0101040024 - AVALIAÇÃO ANTROPOMÉTRICA", "0101040024", "AVALIAÇÃO ANTROPOMÉTRICA"),
    ("Outros procedimentos (SIGTAP)", "0214010015 - GLICEMIA CAPILAR", "0214010015", "GLICEMIA CAPILAR"),
    ("Outros procedimentos (SIGTAP)", "0301010030 - CONSULTA DE PROFISSIONAIS DE NÍVEL SUPERIOR NA ATENÇÃO PRIMÁRIA (EXCETO MÉDICO)", "0301010030", "CONSULTA DE PROFISSIONAIS DE NÍVEL SUPERIOR NA ATENÇÃO PRIMÁRIA (EXCETO MÉDICO)"),
    ("Outros procedimentos (SIGTAP)", "0301010064 - CONSULTA MEDICA EM ATENÇÃO PRIMÁRIA", "0301010064", "CONSULTA MÉDICA EM ATENÇÃO PRIMÁRIA"),
    ("Outros procedimentos (SIGTAP)", "0301100039 - AFERIÇÃO DE PRESSÃO ARTERIAL", "0301100039", "AFERIÇÃO DE PRESSÃO ARTERIAL"),
    ("Outros procedimentos (SIGTAP)", "0301010153 - PRIMEIRA CONSULTA ODONTOLOGICA PROGRAMÁTICA", "0301010153", "PRIMEIRA CONSULTA ODONTOLÓGICA PROGRAMÁTICA"),
]
for secao, label, code, desc in nativos:
    add_proc(code, desc)
    add_map(secao, label, code, "nativo_sigtap")


def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def main() -> None:
    # dedupe procs by code (last wins)
    by_code: dict[str, tuple[str, str]] = {}
    for code, desc, tipo in PROCS:
        by_code[code] = (desc, tipo)

    lines: list[str] = []
    lines.append("-- ============================================================================")
    lines.append("-- SIMPA — Seed de-para e-SUS ↔ SIGTAP")
    lines.append("-- Arquivo: seed_esus_sigtap_depara.sql")
    lines.append("-- ============================================================================")
    lines.append("-- Fontes:")
    lines.append("--   * Planilhas municipais (screenshots 2026-07-26): Pequenas cirurgias +")
    lines.append("--     Teste rápido + Administração de medicamentos; Procedimentos odonto")
    lines.append("--   * LEDI e-SUS APS v7.3.2 dicionario-fp.html / dicionario-fao.html (SIGTAP 08/2025)")
    lines.append("--   * Labels exatos: seed_esus_2026-05.sql / CSVs e-SUS CAFI 2026-05")
    lines.append("-- Exclusões:")
    lines.append("--   * Teste do olhinho (TRV) — LEDI sem código SIGTAP (ABEX022)")
    lines.append("--   * 3ª planilha clínica truncada — sem seção e-SUS correspondente no export CAFI")
    lines.append("-- Idempotente: ON CONFLICT upsert")
    lines.append("-- ============================================================================")
    lines.append("")
    lines.append("BEGIN;")
    lines.append("")
    lines.append("-- Master procedimentos")
    for code, (desc, tipo) in sorted(by_code.items()):
        lines.append(
            "INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)\n"
            f"VALUES ({sql_str(code)}, {sql_str(desc)}, {sql_str(tipo)}, 'SIGTAP', 'ativo', 'seed')\n"
            "ON CONFLICT (codigo_sigtap) DO UPDATE SET\n"
            "  descricao = EXCLUDED.descricao,\n"
            "  tipo = COALESCE(EXCLUDED.tipo, procedimentos.tipo),\n"
            "  tabela_referencia = COALESCE(procedimentos.tabela_referencia, 'SIGTAP'),\n"
            "  status = 'ativo',\n"
            "  atualizado_em = now();"
        )
        lines.append("")

    lines.append("-- Maps e-SUS → procedimentos")
    seen: set[tuple[str, str]] = set()
    for secao, label, code, origem in MAPS:
        key = (secao, label)
        if key in seen:
            raise SystemExit(f"duplicate map {key}")
        seen.add(key)
        lines.append(
            "INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)\n"
            "SELECT "
            f"{sql_str(secao)}, {sql_str(label)}, p.id, {sql_str(origem)}, 'ativo'\n"
            f"FROM procedimentos p WHERE p.codigo_sigtap = {sql_str(code)}\n"
            "ON CONFLICT (secao, descricao_esus) DO UPDATE SET\n"
            "  procedimento_id = EXCLUDED.procedimento_id,\n"
            "  origem = EXCLUDED.origem,\n"
            "  status = 'ativo',\n"
            "  atualizado_em = now();"
        )
        lines.append("")

    lines.append("COMMIT;")
    lines.append("")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} procs={len(by_code)} maps={len(MAPS)}")


if __name__ == "__main__":
    main()
