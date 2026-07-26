"""Verify docs/esus-sigtap-depara.md against implemented contracts (task_09)."""

from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "docs" / "esus-sigtap-depara.md"
README = ROOT / "readme.md"

CSV_COLUMNS = [
    "competencia",
    "unidade",
    "equipe",
    "secao",
    "descricao_esus",
    "codigo_sigtap",
    "descricao_sigtap",
    "quantidade",
]

REQUIRED_SECTIONS = [
    "Procedimentos / Pequenas cirurgias",
    "Procedimentos - Teste rápido",
    "Procedimentos - Administração de medicamentos",
    "Procedimentos",
    "Outros procedimentos (SIGTAP)",
]

LINK_TARGETS = [
    ROOT / ".compozy" / "tasks" / "esus-sigtap-depara" / "_prd.md",
    ROOT / ".compozy" / "tasks" / "esus-sigtap-depara" / "_techspec.md",
    ROOT / ".compozy" / "tasks" / "esus-sigtap-depara" / "adrs" / "adr-001.md",
    ROOT / ".compozy" / "tasks" / "esus-sigtap-depara" / "adrs" / "adr-002.md",
    ROOT / ".compozy" / "tasks" / "esus-sigtap-depara" / "adrs" / "adr-003.md",
    ROOT / ".compozy" / "tasks" / "esus-sigtap-depara" / "adrs" / "adr-004.md",
    ROOT / "seed_esus_sigtap_depara.sql",
    ROOT / "schema_full.sql",
    ROOT / "scripts" / "generate_seed_esus_sigtap_depara.py",
    ROOT / "consolidate_dashboard.py",
]


class TestEsusSigtapDeparaDocs(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.assertTrue(DOC.is_file(), f"missing {DOC}")
        cls.text = DOC.read_text(encoding="utf-8")

    def test_export_path_documented(self):
        self.assertIn("/api/procedimentos/export", self.text)

    def test_csv_columns_match_techspec_order(self):
        expected = ",".join(CSV_COLUMNS)
        self.assertIn(expected, self.text)

    def test_silent_skip_documented(self):
        self.assertRegex(self.text, r"silent skip", re.I)

    def test_quantities_not_from_spreadsheet(self):
        self.assertRegex(
            self.text,
            r"n[aã]o.*grav(am|am)? quantidades|quantidades.*n[aã]o",
            re.I,
        )

    def test_real_esus_sections_documented(self):
        for secao in REQUIRED_SECTIONS:
            self.assertIn(secao, self.text, msg=f"missing section name: {secao}")

    def test_example_curl_matches_route(self):
        self.assertIn("curl", self.text.lower())
        self.assertIn("/api/procedimentos/export", self.text)
        app = (ROOT / "simpa-backend" / "src" / "app.js").read_text(encoding="utf-8")
        self.assertIn("/api/procedimentos", app)
        route = (ROOT / "simpa-backend" / "src" / "routes" / "procedimentos.js").read_text(
            encoding="utf-8"
        )
        self.assertIn("/export", route)

    def test_relative_links_and_artifacts_exist(self):
        for path in LINK_TARGETS:
            self.assertTrue(path.is_file(), msg=f"missing linked artifact: {path}")

        # Parse markdown links that point under ../.compozy or ../seed etc.
        for match in re.finditer(r"\]\(([^)]+)\)", self.text):
            href = match.group(1)
            if href.startswith("http") or href.startswith("#"):
                continue
            target = (DOC.parent / href).resolve()
            self.assertTrue(target.exists(), msg=f"broken link: {href} -> {target}")

    def test_readme_points_to_guide(self):
        readme = README.read_text(encoding="utf-8")
        self.assertIn("docs/esus-sigtap-depara.md", readme)


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(TestEsusSigtapDeparaDocs)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
