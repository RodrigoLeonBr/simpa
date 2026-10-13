"""Guard: migration_044 seed is intact — the drill-down description lookup is
only as good as this table. Parses the migration and checks row count + a few
high-volume categories resolve to the expected pt-BR description.

No DB: the seed is the source of truth; this guards generation/escaping bugs.
"""
from __future__ import annotations

import re
from pathlib import Path

MIGRATION = Path(__file__).resolve().parent.parent / "migration_044_cid10_categorias.sql"

# ('I21', 'Infarto agudo do miocárdio')  — apóstrofos no texto vêm como ''
_ROW_RE = re.compile(r"\('([A-Z]\d{2})', '((?:[^']|'')*)'\)")


def _load() -> dict[str, str]:
    text = MIGRATION.read_text(encoding="utf-8")
    # só o bloco de categorias (antes do primeiro INSERT em painel_metricas_catalogo)
    block = text.split("INSERT INTO painel_metricas_catalogo", 1)[0]
    rows = {cat: desc.replace("''", "'") for cat, desc in _ROW_RE.findall(block)}
    return rows


def test_has_full_category_set():
    rows = _load()
    # DATASUS CID-10-CATEGORIAS tem ~2000 categorias; guarda contra truncamento.
    assert len(rows) > 1900, f"só {len(rows)} categorias — seed truncado?"


def test_known_categories_resolve():
    rows = _load()
    assert rows["I21"] == "Infarto agudo do miocárdio"
    assert rows["O80"] == "Parto único espontâneo"
    assert rows["J18"].startswith("Pneumonia")


def test_all_codes_are_three_char():
    rows = _load()
    assert all(len(c) == 3 and c[0].isalpha() and c[1:].isdigit() for c in rows)
