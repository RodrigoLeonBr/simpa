"""Guard: the CID-10 chapter ranges seeded in migration_043 resolve the risky
boundary codes to the correct chapter — the whole point of the fix (a single
letter is ambiguous for D and H; the 3-char category is not).

No DB: parses the migration seed and replays the same `LEFT(diag,3) BETWEEN
faixa_inicio AND faixa_fim` logic the SQL uses (string comparison, which is
exactly how Postgres compares char(3) here).
"""
from __future__ import annotations

import re
from pathlib import Path

MIGRATION = Path(__file__).resolve().parent.parent / "migration_043_cid10_capitulos.sql"

# (numero, 'rotulo', 'titulo', 'A00', 'B99')
_ROW_RE = re.compile(
    r"\(\s*\d+\s*,\s*'([^']+)'\s*,\s*'(?:[^']|'')+'\s*,\s*'([A-Z]\d{2})'\s*,\s*'([A-Z]\d{2})'\s*\)"
)


def _load_ranges() -> list[tuple[str, str, str]]:
    text = MIGRATION.read_text(encoding="utf-8")
    rows = _ROW_RE.findall(text)
    assert len(rows) == 22, f"esperados 22 capítulos, achei {len(rows)}"
    return rows  # list of (rotulo, inicio, fim)


def _chapter(code: str, ranges) -> str | None:
    cat = code.upper()[:3]
    for rotulo, inicio, fim in ranges:
        if inicio <= cat <= fim:
            return rotulo
    return None


def test_letter_D_splits_between_chapters_II_and_III():
    r = _load_ranges()
    assert _chapter("D30", r) == "II"    # neoplasia benigna
    assert _chapter("D50", r) == "III"   # anemia ferropriva


def test_letter_H_splits_between_eye_and_ear():
    r = _load_ranges()
    assert _chapter("H10", r) == "VII"   # olho
    assert _chapter("H66", r) == "VIII"  # ouvido (otite média)


def test_common_codes_map_to_expected_chapters():
    r = _load_ranges()
    assert _chapter("I21", r) == "IX"    # IAM -> circulatório
    assert _chapter("J18", r) == "X"     # pneumonia -> respiratório
    assert _chapter("O80", r) == "XV"    # parto -> gravidez/puerpério
    assert _chapter("U071", r) == "XXII" # COVID-19 (U07.1) -> propósitos especiais
