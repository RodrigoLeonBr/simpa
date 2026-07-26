"""Unit checks for generate_seed_esus_sigtap_depara.py data integrity."""

from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEN = ROOT / "scripts" / "generate_seed_esus_sigtap_depara.py"


def load_gen():
    spec = importlib.util.spec_from_file_location("gen_seed", GEN)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod


class TestSeedGenerator(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_gen()
        # rebuild lists by re-running module top-level already done; use MAPS/PROCS
        cls.maps = cls.mod.MAPS
        cls.procs = cls.mod.PROCS

    def test_all_codes_are_10_digits(self):
        for secao, label, code, origem in self.maps:
            self.assertRegex(code, r"^\d{10}$", msg=f"{secao}/{label}")

    def test_no_duplicate_secao_label(self):
        keys = [(s, l) for s, l, _, _ in self.maps]
        self.assertEqual(len(keys), len(set(keys)))

    def test_origem_enum(self):
        allowed = {"seed", "nativo_sigtap", "manual"}
        for *_, origem in self.maps:
            self.assertIn(origem, allowed)

    def test_spot_checks(self):
        by = {(s, l): c for s, l, c, _ in self.maps}
        self.assertEqual(
            by[("Procedimentos / Pequenas cirurgias", "Coleta de citopatológico de colo uterino")],
            "0201020033",
        )
        self.assertEqual(by[("Procedimentos - Teste rápido", "Para HIV")], "0214010058")
        self.assertEqual(by[("Procedimentos", "Exodontia de dente permanente")], "0414020138")

    def test_seed_file_exists_and_mentions_sources(self):
        seed = ROOT / "seed_esus_sigtap_depara.sql"
        self.assertTrue(seed.is_file())
        text = seed.read_text(encoding="utf-8")
        self.assertIn("LEDI", text)
        self.assertIn("ON CONFLICT", text)


if __name__ == "__main__":
    # Populate MAPS by importing after generator main data definitions
    # Module import already fills MAPS at import time
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(TestSeedGenerator)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
