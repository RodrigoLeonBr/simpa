import json
import subprocess
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).parent


def _make_xlsx(tmp_path, rows, filtro="NM_MUNICIPIO … AMERICANA\nAno … 2026\nMês … janeiro"):
    cols = ['DRS', 'GVE', 'RS', 'Município', 'Sala de Vacina',
            'Imunibiológico', 'Total doses aplicadas', 'Idade', 'Sistema Origem']
    df = pd.DataFrame(rows, columns=cols)
    footer = pd.DataFrame(
        [[None] * 9, [f"Filtros aplicados:\n{filtro}"] + [None] * 8],
        columns=cols,
    )
    df = pd.concat([df, footer], ignore_index=True)
    path = tmp_path / "vacina_jan_2026.xlsx"
    with pd.ExcelWriter(path, engine="openpyxl") as w:
        df.to_excel(w, sheet_name="Export", index=False)
    return path


def _run(path):
    out = subprocess.run(
        [sys.executable, str(ROOT / "parse_vacina_xlsx.py"), str(path)],
        capture_output=True, text=True, encoding="utf-8",
    )
    assert out.returncode == 0, out.stderr
    return json.loads(out.stdout)


def test_descarta_rodape_e_normaliza(tmp_path):
    path = _make_xlsx(tmp_path, [
        ['CAMPINAS', 'CAMPINAS', 'REG METRO CAMPINAS', 'AMERICANA',
         '4032128 - UBS DONA ROSA', '93 - VACINA HPV NONAVALENTE',
         3.0, '05 a 11 anos', 'NOVO PNI'],
    ])
    res = _run(path)
    assert res['competencia'] == '2026-01-01'
    assert res['doses_total'] == 3
    assert len(res['linhas']) == 1
    linha = res['linhas'][0]
    assert linha['cnes_sala'] == '4032128'
    assert linha['sala_nome'] == 'UBS DONA ROSA'
    assert linha['imuno_codigo'] == '93'
    assert linha['imuno_nome'] == 'VACINA HPV NONAVALENTE'
    assert linha['faixa_nies'] == '05 a 11 anos'
    assert linha['doses'] == 3


def test_ignora_municipio_diferente(tmp_path):
    path = _make_xlsx(tmp_path, [
        ['CAMPINAS', 'CAMPINAS', 'REG', 'CAMPINAS',
         '1 - X', '9 - VACINA HEPATITE B', 5.0, '01 ano', 'NOVO PNI'],
        ['CAMPINAS', 'CAMPINAS', 'REG', 'AMERICANA',
         '2 - Y', '9 - VACINA HEPATITE B', 2.0, '01 ano', 'NOVO PNI'],
    ])
    res = _run(path)
    assert len(res['linhas']) == 1
    assert res['linhas'][0]['sala_nome'] == 'Y'
    assert res['doses_total'] == 2


def test_competencia_fallback_nome_arquivo(tmp_path):
    path = _make_xlsx(tmp_path, [
        ['C', 'C', 'R', 'AMERICANA', '1 - X', '9 - V', 1.0, '01 ano', 'NOVO PNI'],
    ], filtro="sem mes aqui")
    res = _run(path)
    assert res['competencia'] == '2026-01-01'


def test_imuno_com_hifen_no_nome(tmp_path):
    path = _make_xlsx(tmp_path, [
        ['C', 'C', 'R', 'AMERICANA',
         '4032128 - UBS DONA ROSA',
         '99 - VACINA COVID-19 PFIZER - COMIRNATY PEDIÁTRICA, RNAM',
         5.0, '05 a 11 anos', 'NOVO PNI'],
    ])
    res = _run(path)
    linha = res['linhas'][0]
    assert linha['imuno_codigo'] == '99'
    assert linha['imuno_nome'] == 'VACINA COVID-19 PFIZER - COMIRNATY PEDIÁTRICA, RNAM'
