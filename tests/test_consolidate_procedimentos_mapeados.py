"""Tests for procedimentos_mapeados enrichment in consolidate_dashboard (task_06)."""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import MagicMock

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

COMP = date(2099, 3, 1)
UNIDADE = "SMOKE CONSOL UNIDADE"
EQUIPE = "SMOKE CONSOL EQUIPE"
SECAO = "SMOKE / Consol Secao"
LABEL_MAPPED = "SMOKE consol mapped"
LABEL_UNMAPPED = "SMOKE consol unmapped"
CODE = "9999999501"


def load_consolidate():
    path = ROOT / "consolidate_dashboard.py"
    spec = importlib.util.spec_from_file_location("consolidate_dashboard", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod


class TestProcedimentosMapeadosUnit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_consolidate()

    def test_versao_schema_is_3_2_0(self):
        self.assertEqual(self.mod.VERSAO_SCHEMA, "3.2.0")

    def test_build_payload_includes_procedimentos_mapeados_key_even_when_empty(self):
        cur = MagicMock()

        def execute(sql, params=None):
            cur._last_sql = sql
            if "resolve_mapped_procedures" in sql:
                cur.fetchall.return_value = []
            elif "sia_sincronizacoes" in sql:
                cur.fetchone.return_value = None
            elif "sia_producao" in sql:
                cur.fetchall.return_value = []
            elif "dados_consolidados" in sql and "SELECT dados_conteudo" in sql:
                cur.fetchone.return_value = None
            else:
                # fetch_indicators_by_tipo / others
                cur.fetchall.return_value = []
                cur.fetchone.return_value = None

        cur.execute.side_effect = execute
        payload = self.mod.build_payload(cur, COMP, UNIDADE, EQUIPE)
        aps = payload["modulos"]["atencao_primaria_esus"]
        self.assertIn("procedimentos_mapeados", aps)
        self.assertEqual(aps["procedimentos_mapeados"], [])


@unittest.skipUnless(
    os.environ.get("PG_HOST") and os.environ.get("PG_DB"),
    "PG env required for integration tests",
)
class TestProcedimentosMapeadosIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_consolidate()
        cls.conn = cls.mod.conectar_pg()
        cls._seed()

    @classmethod
    def tearDownClass(cls):
        try:
            cls._cleanup()
        finally:
            cls.conn.close()

    @classmethod
    def _cleanup(cls):
        with cls.conn:
            with cls.conn.cursor() as cur:
                cur.execute("DELETE FROM dados_consolidados WHERE unidade = %s", (UNIDADE,))
                cur.execute("DELETE FROM esus_cargas WHERE unidade = %s", (UNIDADE,))
                cur.execute("DELETE FROM esus_procedimento_map WHERE secao = %s", (SECAO,))
                cur.execute("DELETE FROM procedimentos WHERE codigo_sigtap = %s", (CODE,))

    @classmethod
    def _seed(cls):
        cls._cleanup()
        with cls.conn:
            with cls.conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO procedimentos
                      (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
                    VALUES (%s, 'SMOKE CONSOL PROC', 'ambulatorial', 'SIGTAP', 'ativo', 'manual')
                    RETURNING id
                    """,
                    (CODE,),
                )
                proc_id = cur.fetchone()[0]

                cur.execute(
                    """
                    INSERT INTO esus_procedimento_map
                      (secao, descricao_esus, procedimento_id, origem, status)
                    VALUES (%s, %s, %s, 'manual', 'ativo')
                    """,
                    (SECAO, LABEL_MAPPED, proc_id),
                )

                # KPI source (atendimento) so upsert keeps the row
                cur.execute(
                    """
                    INSERT INTO esus_cargas (
                      tipo_relatorio, competencia, periodo_inicio, periodo_fim,
                      municipio, unidade, equipe_nome, arquivo_origem
                    ) VALUES (
                      'atendimento_individual', %s, %s, %s,
                      'AMERICANA', %s, %s, 'smoke-consol-atend.csv'
                    ) RETURNING id
                    """,
                    (COMP, COMP, COMP, UNIDADE, EQUIPE),
                )
                carga_atend = cur.fetchone()[0]
                cur.execute(
                    """
                    INSERT INTO esus_indicadores_raw
                      (carga_id, secao, descricao, ordem, valores)
                    VALUES (%s, 'Resumo de produção', 'Registros identificados', 0,
                            '{"quantidade": 42}'::jsonb)
                    """,
                    (carga_atend,),
                )

                cur.execute(
                    """
                    INSERT INTO esus_cargas (
                      tipo_relatorio, competencia, periodo_inicio, periodo_fim,
                      municipio, unidade, equipe_nome, arquivo_origem
                    ) VALUES (
                      'procedimentos_individualizados', %s, %s, %s,
                      'AMERICANA', %s, %s, 'smoke-consol-proc.csv'
                    ) RETURNING id
                    """,
                    (COMP, COMP, COMP, UNIDADE, EQUIPE),
                )
                carga_proc = cur.fetchone()[0]
                cur.execute(
                    """
                    INSERT INTO esus_indicadores_raw
                      (carga_id, secao, descricao, ordem, valores)
                    VALUES
                      (%s, %s, %s, 0, '{"quantidade": 7}'::jsonb),
                      (%s, %s, %s, 1, '{"quantidade": 99}'::jsonb)
                    """,
                    (
                        carga_proc, SECAO, LABEL_MAPPED,
                        carga_proc, SECAO, LABEL_UNMAPPED,
                    ),
                )

    def test_mapped_fixture_rows_appear_with_codigo_and_quantidade(self):
        with self.conn.cursor() as cur:
            payload = self.mod.build_payload(cur, COMP, UNIDADE, EQUIPE)
        rows = payload["modulos"]["atencao_primaria_esus"]["procedimentos_mapeados"]
        hit = next((r for r in rows if r["descricao_esus"] == LABEL_MAPPED), None)
        self.assertIsNotNone(hit)
        self.assertEqual(hit["codigo_sigtap"], CODE)
        self.assertEqual(hit["quantidade"], 7)
        self.assertEqual(hit["secao"], SECAO)

    def test_unmapped_fixture_labels_absent(self):
        with self.conn.cursor() as cur:
            payload = self.mod.build_payload(cur, COMP, UNIDADE, EQUIPE)
        rows = payload["modulos"]["atencao_primaria_esus"]["procedimentos_mapeados"]
        self.assertFalse(any(r["descricao_esus"] == LABEL_UNMAPPED for r in rows))

    def test_pg_write_persists_array_and_versao(self):
        result = self.mod.consolidate_one(COMP, UNIDADE, EQUIPE, pg_write=True)
        self.assertTrue(str(result["status"]).startswith("upserted"))

        with self.conn.cursor() as cur:
            cur.execute(
                """
                SELECT versao_schema, dados_conteudo
                FROM dados_consolidados
                WHERE competencia = %s AND unidade = %s AND equipe = %s
                """,
                (COMP, UNIDADE, EQUIPE),
            )
            row = cur.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], "3.2.0")
        dados = row[1] if isinstance(row[1], dict) else json.loads(row[1])
        mapped = dados["modulos"]["atencao_primaria_esus"]["procedimentos_mapeados"]
        self.assertTrue(any(r["descricao_esus"] == LABEL_MAPPED for r in mapped))
        self.assertFalse(any(r["descricao_esus"] == LABEL_UNMAPPED for r in mapped))


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromModule(sys.modules[__name__])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
