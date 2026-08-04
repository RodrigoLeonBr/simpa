"""Pure helpers for SIMPA schema migration apply/baseline scripts."""

from __future__ import annotations

import re
from pathlib import Path

ENSURE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS simpa_schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
""".strip()

_MIGRATION_RE = re.compile(r"^migration_(\d+)_.*\.sql$", re.IGNORECASE)


def parse_migration_number(filename: str) -> int:
    match = _MIGRATION_RE.match(Path(filename).name)
    if not match:
        raise ValueError(f"Not a migration filename: {filename}")
    return int(match.group(1))


def list_migration_files(directory: Path) -> list[Path]:
    files = [
        p
        for p in directory.iterdir()
        if p.is_file() and _MIGRATION_RE.match(p.name)
    ]
    return sorted(files, key=lambda p: (parse_migration_number(p.name), p.name))


def pending_migrations(files: list[Path], applied: set[str]) -> list[Path]:
    return [p for p in files if p.name not in applied]


def baseline_filenames(files: list[Path], through: int) -> list[str]:
    return [p.name for p in files if parse_migration_number(p.name) <= through]


def main(argv: list[str] | None = None) -> int:
    """CLI used by apply-migrations shell scripts."""
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="SIMPA migration file helpers")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list", help="List migration filenames (sorted)")
    p_list.add_argument("--dir", type=Path, default=Path("."))

    p_pending = sub.add_parser("pending", help="List pending filenames")
    p_pending.add_argument("--dir", type=Path, default=Path("."))
    p_pending.add_argument(
        "--applied",
        default="",
        help="Newline-separated applied filenames (or pass via stdin with -)",
    )

    p_base = sub.add_parser("baseline", help="List filenames for baseline through N")
    p_base.add_argument("--dir", type=Path, default=Path("."))
    p_base.add_argument("--through", type=int, required=True)

    args = parser.parse_args(argv)
    files = list_migration_files(args.dir)

    if args.cmd == "list":
        for p in files:
            print(p.name)
        return 0

    if args.cmd == "pending":
        raw = args.applied
        if raw == "-":
            raw = sys.stdin.read()
        applied = {line.strip() for line in raw.splitlines() if line.strip()}
        for p in pending_migrations(files, applied):
            print(p.name)
        return 0

    if args.cmd == "baseline":
        for name in baseline_filenames(files, args.through):
            print(name)
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
