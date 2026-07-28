import pytest
from sync_cadastros_mysql import sincronizar


def test_refs_only_requires_pg_write():
    with pytest.raises(ValueError, match="--refs-only requer --pg-write"):
        sincronizar(refs_only=True)


def test_refs_only_incompatible_with_plan():
    with pytest.raises(ValueError, match="--refs-only incompatível"):
        sincronizar(refs_only=True, pg_write=True, plan=True)


def test_refs_only_incompatible_with_dry_run():
    with pytest.raises(ValueError, match="--refs-only incompatível"):
        sincronizar(refs_only=True, pg_write=True, dry_run=True)
