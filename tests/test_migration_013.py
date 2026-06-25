"""
Tests for migration_013_sih_tabelas.sql.

Run with a live PG connection:
    pytest tests/test_migration_013.py -v

These tests are skipped automatically when PG is unavailable.
Each test applies the migration SQL and verifies idempotency by running twice.
"""
from __future__ import annotations

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_013 = ROOT / "migration_013_sih_tabelas.sql"


def apply_migration(conn) -> None:
    sql = MIGRATION_013.read_text(encoding="utf-8")
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


def get_columns(conn, table: str) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            """,
            (table,),
        )
        return {row[0] for row in cur.fetchall()}


def get_indexes(conn, table: str) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = %s
            """,
            (table,),
        )
        return {row[0] for row in cur.fetchall()}


def table_exists(conn, table: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
            """,
            (table,),
        )
        return cur.fetchone() is not None


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _apply_migration(pg_conn):
    """Apply migration before each test; idempotency tested by double-apply."""
    apply_migration(pg_conn)
    yield


# ---------------------------------------------------------------------------
# 1. Table existence
# ---------------------------------------------------------------------------


def test_sih_sincronizacoes_exists(pg_conn):
    assert table_exists(pg_conn, "sih_sincronizacoes")


def test_sih_internacoes_exists(pg_conn):
    assert table_exists(pg_conn, "sih_internacoes")


def test_sih_procedimentos_exists(pg_conn):
    assert table_exists(pg_conn, "sih_procedimentos")


# ---------------------------------------------------------------------------
# 2. Column presence
# ---------------------------------------------------------------------------


def test_sih_sincronizacoes_columns(pg_conn):
    cols = get_columns(pg_conn, "sih_sincronizacoes")
    assert {"id", "competencia", "status", "qtd_internacoes",
            "qtd_procedimentos", "orphan_cnes", "erros", "sincronizado_em"} <= cols


def test_sih_internacoes_columns(pg_conn):
    cols = get_columns(pg_conn, "sih_internacoes")
    assert {
        "id", "sincronizacao_id", "competencia", "cnes", "estabelecimento_id",
        "proc_principal", "diag_principal", "complexidade", "financiamento",
        "motivo_saida", "sexo", "qtd_aih", "total_diarias", "total_diarias_uti",
        "total_valor", "media_idade", "media_diarias",
    } <= cols


def test_sih_procedimentos_columns(pg_conn):
    cols = get_columns(pg_conn, "sih_procedimentos")
    assert {
        "id", "sincronizacao_id", "competencia", "cnes", "estabelecimento_id",
        "proc_detalhado", "cbo_profissional", "financiamento_detalhe",
        "qtd_aih_distintas", "total_quantidade", "total_valor_item",
    } <= cols


# ---------------------------------------------------------------------------
# 3. Indexes
# ---------------------------------------------------------------------------


def test_sih_sincronizacoes_unique_index(pg_conn):
    idxs = get_indexes(pg_conn, "sih_sincronizacoes")
    assert "idx_sih_sync_competencia" in idxs


def test_sih_internacoes_indexes(pg_conn):
    idxs = get_indexes(pg_conn, "sih_internacoes")
    assert {"idx_sih_int_cns_cmp", "idx_sih_int_estab",
            "idx_sih_int_diag", "idx_sih_int_grain"} <= idxs


def test_sih_procedimentos_indexes(pg_conn):
    idxs = get_indexes(pg_conn, "sih_procedimentos")
    assert {"idx_sih_proc_cns_cmp", "idx_sih_proc_estab",
            "idx_sih_proc_grain"} <= idxs


# ---------------------------------------------------------------------------
# 4. CHECK constraint on sih_sincronizacoes.status
# ---------------------------------------------------------------------------


def test_sih_sincronizacoes_status_check_valid(pg_conn):
    """Valid status values should insert without error."""
    for status in ("ok", "parcial", "erro", "pendente"):
        with pg_conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO sih_sincronizacoes (competencia, status)
                VALUES ('2020-01-01', %s)
                ON CONFLICT DO NOTHING
                """,
                (status,),
            )
    pg_conn.commit()


def test_sih_sincronizacoes_status_check_invalid(pg_conn):
    """Invalid status value should raise IntegrityError."""
    import psycopg2

    with pytest.raises(psycopg2.errors.CheckViolation):
        with pg_conn.cursor() as cur:
            cur.execute(
                "INSERT INTO sih_sincronizacoes (competencia, status) VALUES ('2020-02-01', 'invalido')"
            )
        pg_conn.commit()
    pg_conn.rollback()


# ---------------------------------------------------------------------------
# 5. FK CASCADE: DELETE sih_sincronizacoes cascades to children
# ---------------------------------------------------------------------------


def test_cascade_delete_sih_internacoes(pg_conn):
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sih_sincronizacoes (competencia, status)
            VALUES ('2021-03-01', 'ok')
            ON CONFLICT DO NOTHING
            RETURNING id
            """
        )
        row = cur.fetchone()
        if row is None:
            # Already exists — fetch id
            cur.execute(
                "SELECT id FROM sih_sincronizacoes WHERE competencia = '2021-03-01'"
            )
            row = cur.fetchone()
        sync_id = row[0]

        cur.execute(
            """
            INSERT INTO sih_internacoes
              (sincronizacao_id, competencia, cnes, qtd_aih, total_diarias,
               total_diarias_uti, total_valor)
            VALUES (%s, '2021-03-01', '1234567', 5, 20, 3, 10000.00)
            ON CONFLICT DO NOTHING
            """,
            (sync_id,),
        )
        pg_conn.commit()

        # Verify child exists
        cur.execute(
            "SELECT COUNT(*) FROM sih_internacoes WHERE sincronizacao_id = %s",
            (sync_id,),
        )
        assert cur.fetchone()[0] >= 1

        # Delete parent — should cascade
        cur.execute(
            "DELETE FROM sih_sincronizacoes WHERE id = %s", (sync_id,)
        )
        pg_conn.commit()

        cur.execute(
            "SELECT COUNT(*) FROM sih_internacoes WHERE sincronizacao_id = %s",
            (sync_id,),
        )
        assert cur.fetchone()[0] == 0


def test_cascade_delete_sih_procedimentos(pg_conn):
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sih_sincronizacoes (competencia, status)
            VALUES ('2021-04-01', 'ok')
            ON CONFLICT DO NOTHING
            RETURNING id
            """
        )
        row = cur.fetchone()
        if row is None:
            cur.execute(
                "SELECT id FROM sih_sincronizacoes WHERE competencia = '2021-04-01'"
            )
            row = cur.fetchone()
        sync_id = row[0]

        cur.execute(
            """
            INSERT INTO sih_procedimentos
              (sincronizacao_id, competencia, cnes, qtd_aih_distintas,
               total_quantidade, total_valor_item)
            VALUES (%s, '2021-04-01', '9876543', 2, 8, 500.00)
            ON CONFLICT DO NOTHING
            """,
            (sync_id,),
        )
        pg_conn.commit()

        cur.execute(
            "DELETE FROM sih_sincronizacoes WHERE id = %s", (sync_id,)
        )
        pg_conn.commit()

        cur.execute(
            "SELECT COUNT(*) FROM sih_procedimentos WHERE sincronizacao_id = %s",
            (sync_id,),
        )
        assert cur.fetchone()[0] == 0


# ---------------------------------------------------------------------------
# 6. UNIQUE grain constraint on sih_internacoes
# ---------------------------------------------------------------------------


def test_sih_internacoes_unique_grain(pg_conn):
    """Duplicate grain should raise UniqueViolation."""
    import psycopg2

    with pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sih_sincronizacoes (competencia, status)
            VALUES ('2022-06-01', 'ok')
            ON CONFLICT (competencia) DO UPDATE SET status = 'ok'
            RETURNING id
            """
        )
        sync_id = cur.fetchone()[0]
        # clean any existing child rows for this sync to ensure first insert succeeds
        cur.execute(
            "DELETE FROM sih_internacoes WHERE sincronizacao_id = %s", (sync_id,)
        )
        pg_conn.commit()

    def insert_row(conn, sid):
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO sih_internacoes
                  (sincronizacao_id, competencia, cnes, proc_principal,
                   diag_principal, complexidade, financiamento, motivo_saida,
                   sexo, qtd_aih, total_diarias, total_diarias_uti, total_valor)
                VALUES (%s, '2022-06-01', '5551111', '0301010153',
                        'J18', '02', '01', '11', 'M', 3, 12, 0, 6000.00)
                """,
                (sid,),
            )
        conn.commit()

    insert_row(pg_conn, sync_id)  # first insert must succeed

    with pytest.raises(psycopg2.errors.UniqueViolation):
        insert_row(pg_conn, sync_id)  # duplicate grain must fail
    pg_conn.rollback()


# ---------------------------------------------------------------------------
# 7. Seeds — painel_metricas_catalogo sih.* slugs
# ---------------------------------------------------------------------------


def test_sih_metric_seeds_count(pg_conn):
    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM painel_metricas_catalogo WHERE chave LIKE 'sih.%'"
        )
        count = cur.fetchone()[0]
    assert count >= 7, f"Expected >= 7 sih.* metrics, got {count}"


def test_sih_metric_seeds_slugs(pg_conn):
    with pg_conn.cursor() as cur:
        cur.execute(
            "SELECT chave FROM painel_metricas_catalogo WHERE chave LIKE 'sih.%'"
        )
        chaves = {row[0] for row in cur.fetchall()}
    expected = {
        "sih.total_aih",
        "sih.total_diarias",
        "sih.total_diarias_uti",
        "sih.total_valor",
        "sih.media_permanencia",
        "sih.taxa_mortalidade",
        "sih.pct_diarias_uti",
    }
    assert expected <= chaves, f"Missing slugs: {expected - chaves}"


def test_sih_widget_seeds_hospitalar(pg_conn):
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*) FROM painel_widgets
            WHERE perfil = 'Hospitalar' AND layout = 'A'
            """
        )
        count = cur.fetchone()[0]
    assert count >= 6, f"Expected >= 6 Hospitalar Layout A widgets, got {count}"


# ---------------------------------------------------------------------------
# 8. Idempotency — running migration twice raises no error
# ---------------------------------------------------------------------------


def test_migration_idempotent(pg_conn):
    """Re-applying migration_013 must not raise any exception."""
    apply_migration(pg_conn)  # second application (first done in autouse fixture)


# ---------------------------------------------------------------------------
# 9. fonte_tipo CHECK allows 'sih'
# ---------------------------------------------------------------------------


def test_fonte_tipo_check_accepts_sih(pg_conn):
    """After migration_013, fonte_tipo = 'sih' must be a valid value."""
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO painel_metricas_catalogo
              (chave, fonte_tipo, label, campo_json, agregacao, sql_template)
            VALUES ('sih._test_check', 'sih', 'Test SIH', 'valor', 'valor_unico',
                    'SELECT 1 AS valor')
            ON CONFLICT (chave) DO NOTHING
            """
        )
    pg_conn.commit()

    with pg_conn.cursor() as cur:
        cur.execute(
            "DELETE FROM painel_metricas_catalogo WHERE chave = 'sih._test_check'"
        )
    pg_conn.commit()
