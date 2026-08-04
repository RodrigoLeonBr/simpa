"""Unit tests for scripts/lib/migrations_lib.py."""

from pathlib import Path

import pytest

from scripts.lib import migrations_lib as lib


def test_parse_migration_number():
    assert lib.parse_migration_number("migration_012_populacao_cadastrada.sql") == 12
    assert lib.parse_migration_number("migration_2_auth.sql") == 2
    assert lib.parse_migration_number("migration_027_fix_sih_metricas_utf8.sql") == 27


def test_parse_migration_number_invalid():
    with pytest.raises(ValueError):
        lib.parse_migration_number("schema_full.sql")
    with pytest.raises(ValueError):
        lib.parse_migration_number("migration_abc.sql")


def test_list_migration_files_sorted(tmp_path: Path):
    for name in (
        "migration_010_b.sql",
        "migration_002_a.sql",
        "migration_027_c.sql",
        "readme.txt",
    ):
        (tmp_path / name).write_text("--", encoding="utf-8")
    names = [p.name for p in lib.list_migration_files(tmp_path)]
    assert names == [
        "migration_002_a.sql",
        "migration_010_b.sql",
        "migration_027_c.sql",
    ]


def test_pending_migrations():
    files = [
        Path("migration_002_a.sql"),
        Path("migration_013_b.sql"),
        Path("migration_014_c.sql"),
    ]
    pending = lib.pending_migrations(files, applied={"migration_002_a.sql", "migration_013_b.sql"})
    assert [p.name for p in pending] == ["migration_014_c.sql"]


def test_baseline_filenames():
    files = [
        Path("migration_002_a.sql"),
        Path("migration_012_b.sql"),
        Path("migration_013_c.sql"),
    ]
    names = lib.baseline_filenames(files, through=12)
    assert names == ["migration_002_a.sql", "migration_012_b.sql"]


def test_ensure_migrations_table_sql():
    sql = lib.ENSURE_TABLE_SQL
    assert "simpa_schema_migrations" in sql
    assert "filename" in sql
