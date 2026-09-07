#!/usr/bin/env python3
"""
SIMPA - Parser de exportacoes NIES de vacinas aplicadas
=======================================================

Le um arquivo .xlsx exportado do portal NIES (doses aplicadas por sala,
imunobiologico, faixa etaria e sistema de origem) e grava no stdout um
JSON com o contrato:

    {
      "competencia": "YYYY-MM-01",   # null se nao detectada
      "doses_total": <int>,
      "linhas": [
        {
          "cnes_sala":       "<str>",
          "sala_nome":       "<str>",
          "imuno_codigo":    "<str>",
          "imuno_nome":      "<str>",
          "faixa_nies":      "<str|null>",
          "sistema_origem":  "<str|null>",
          "doses":           <int>
        },
        ...
      ]
    }

Uso:
    python parse_vacina_xlsx.py <arquivo.xlsx>

O arquivo deve ter uma aba chamada "Export" com 9 colunas:
DRS, GVE, RS, Municipio, Sala de Vacina, Imunobiologico,
Total doses aplicadas, Idade, Sistema Origem.

As ultimas 2 linhas sao rodape (linha vazia + linha de filtros aplicados)
e sao descartadas pelo dropna em "Total doses aplicadas".

Somente linhas cujo Municipio seja AMERICANA (case-insensitive) sao retidas.
"""

import json
import math
import re
import sys
import warnings
from pathlib import Path

warnings.simplefilter("ignore")

import pandas as pd

# Mapeamento de nomes completos e abreviacoes de mes -> numero
_MESES = {
    'janeiro': 1, 'jan': 1,
    'fevereiro': 2, 'fev': 2,
    'marco': 3, 'mar': 3, 'março': 3,
    'abril': 4, 'abr': 4,
    'maio': 5, 'mai': 5,
    'junho': 6, 'jun': 6,
    'julho': 7, 'jul': 7,
    'agosto': 8, 'ago': 8,
    'setembro': 9, 'set': 9,
    'outubro': 10, 'out': 10,
    'novembro': 11, 'nov': 11,
    'dezembro': 12, 'dez': 12,
}

_RE_SPLIT = re.compile(r'^\s*([^\-]+?)\s*-\s*(.+)$')


def _parse_competencia_from_footer(text):
    """Extrai YYYY-MM-01 do texto de filtros do rodape NIES."""
    ano = mes = None
    for line in text.splitlines():
        m = re.search(r'\bAno\b.+?(\d{4})', line)
        if m:
            ano = int(m.group(1))
        # "Mês" pode chegar com encoding corrompido; busca pela letra M maiuscula
        m = re.search(r'\bM.{0,2}s\b.+?([a-zA-Záéíóúàèìòùâêîôûãõç]+)', line, re.IGNORECASE)
        if m:
            nome = m.group(1).lower()
            # normaliza acentos simples (marco/março)
            nome_ascii = nome.encode('ascii', 'ignore').decode()
            num = _MESES.get(nome) or _MESES.get(nome_ascii)
            if num:
                mes = num
    if ano and mes:
        return f'{ano}-{mes:02d}-01'
    return None


def _parse_competencia_from_filename(path):
    """Fallback: extrai competencia de nome como vacina_jan_2026.xlsx."""
    stem = Path(path).stem.lower()
    # procura padrao _<mmm>_<yyyy> ou _<yyyy>_<mmm>
    m = re.search(r'_([a-z]{3,9})_(\d{4})', stem)
    if m:
        nome, ano = m.group(1), int(m.group(2))
        num = _MESES.get(nome)
        if num:
            return f'{ano}-{num:02d}-01'
    m = re.search(r'_(\d{4})_([a-z]{3,9})', stem)
    if m:
        ano, nome = int(m.group(1)), m.group(2)
        num = _MESES.get(nome)
        if num:
            return f'{ano}-{num:02d}-01'
    return None


def _split_codigo_nome(val):
    """Divide '4032128 - UBS DONA ROSA' em ('4032128', 'UBS DONA ROSA')."""
    if not isinstance(val, str):
        return (None, None)
    m = _RE_SPLIT.match(val)
    if m:
        return (m.group(1).strip(), m.group(2).strip())
    return (val.strip(), '')


def _nullify_nan(val):
    if val is None:
        return None
    try:
        if math.isnan(val):
            return None
    except TypeError:
        pass
    return val


def parse(path):
    df = pd.read_excel(path, sheet_name='Export')

    # Detecta competencia a partir da linha de rodape antes de descartar
    competencia = None
    for cell in df.iloc[:, 0]:
        if isinstance(cell, str) and 'Filtros aplicados' in cell:
            competencia = _parse_competencia_from_footer(cell)
            break

    if not competencia:
        competencia = _parse_competencia_from_filename(path)

    # ponytail: acesso posicional — nomes de coluna do NIES vêm com corrupção de encoding; acesso por nome é menos confiável
    # Descarta rodape (linha vazia + linha de filtros) via coluna doses
    df = df.dropna(subset=[df.columns[6]])  # 'Total doses aplicadas' por posicao

    # Filtra apenas AMERICANA
    municipio_col = df.columns[3]  # 'Municipio' (pode ter encoding corrompido)
    df = df[df[municipio_col].astype(str).str.upper().str.strip() == 'AMERICANA']

    linhas = []
    for _, row in df.iterrows():
        cnes_sala, sala_nome = _split_codigo_nome(row.iloc[4])
        imuno_cod, imuno_nome = _split_codigo_nome(row.iloc[5])
        doses_raw = row.iloc[6]
        doses = int(round(float(doses_raw)))
        faixa   = _nullify_nan(row.iloc[7])
        sistema = _nullify_nan(row.iloc[8])
        linhas.append({
            'cnes_sala': cnes_sala,
            'sala_nome': sala_nome,
            'imuno_codigo': imuno_cod,
            'imuno_nome': imuno_nome,
            'faixa_nies': faixa,
            'sistema_origem': sistema,
            'doses': doses,
        })

    doses_total = sum(l['doses'] for l in linhas)
    return {'competencia': competencia, 'doses_total': doses_total, 'linhas': linhas}


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Uso: python parse_vacina_xlsx.py <arquivo.xlsx>', file=sys.stderr)
        sys.exit(1)
    try:
        result = parse(sys.argv[1])
    except FileNotFoundError:
        print(f'ERRO: arquivo nao encontrado: {sys.argv[1]}', file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        print(f'ERRO: {e}', file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f'ERRO: falha ao ler xlsx: {e}', file=sys.stderr)
        sys.exit(1)
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
