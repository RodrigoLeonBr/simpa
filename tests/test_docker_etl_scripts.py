"""Regression: ETL scripts and deploy helpers must ship in Docker image/deploy."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Scripts Node spawns via path.join(__dirname, '../../../<name>')
# plus shared helpers imported by those scripts.
REQUIRED_ETL_SCRIPTS = (
    "parse_esus_csv.py",
    "consolidate_dashboard.py",
    "sync_sia_mysql.py",
    "sync_sih_mysql.py",
    "sync_cadastros_mysql.py",
    "etl_contract.py",
    "etl_db.py",
)

REQUIRED_RELEASE_SCRIPTS = (
    "deploy-release.sh",
    "deploy-release.ps1",
    "apply-migrations.sh",
    "apply-migrations.ps1",
)


def test_dockerfile_api_copies_all_etl_scripts():
    dockerfile = (ROOT / "Dockerfile.api").read_text(encoding="utf-8")
    copy_lines = [
        line for line in dockerfile.splitlines() if line.strip().startswith("COPY ") and ".py" in line
    ]
    assert copy_lines, "Dockerfile.api must COPY Python ETL scripts"
    copied = "\n".join(copy_lines)
    missing = [name for name in REQUIRED_ETL_SCRIPTS if name not in copied]
    assert not missing, f"Dockerfile.api missing COPY for: {missing}"


def test_compose_mounts_all_etl_scripts():
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    missing = [
        name
        for name in REQUIRED_ETL_SCRIPTS
        if f"./{name}:/app/{name}:ro" not in compose
    ]
    assert not missing, f"docker-compose.yml missing volume mounts for: {missing}"


def test_release_export_includes_all_etl_scripts():
    export_script = (ROOT / "scripts" / "docker-release-export.ps1").read_text(encoding="utf-8")
    missing = [name for name in REQUIRED_ETL_SCRIPTS if f'"{name}"' not in export_script]
    assert not missing, f"docker-release-export.ps1 missing bundle files: {missing}"


def test_release_export_includes_apply_migrations_scripts():
    export_script = (ROOT / "scripts" / "docker-release-export.ps1").read_text(encoding="utf-8")
    missing = [name for name in REQUIRED_RELEASE_SCRIPTS if f'"{name}"' not in export_script]
    assert not missing, f"docker-release-export.ps1 missing scripts: {missing}"
    for name in REQUIRED_RELEASE_SCRIPTS:
        assert (ROOT / "scripts" / name).is_file(), f"missing scripts/{name}"


def test_deploy_release_supports_migrate_flag():
    sh = (ROOT / "scripts" / "deploy-release.sh").read_text(encoding="utf-8")
    ps1 = (ROOT / "scripts" / "deploy-release.ps1").read_text(encoding="utf-8")
    assert "--migrate" in sh
    assert "apply-migrations.sh" in sh
    assert "COMPOSE_PROJECT_NAME" in sh
    assert "Migrate" in ps1
    assert "apply-migrations.ps1" in ps1
    assert "COMPOSE_PROJECT_NAME" in ps1


def test_env_example_has_compose_project_name():
    example = (ROOT / ".env.docker.example").read_text(encoding="utf-8")
    assert "COMPOSE_PROJECT_NAME=simpa" in example
