# Design: Deploy release com `--migrate` e `simpa_schema_migrations`

**Data:** 2026-07-24  
**Status:** aprovado  
**Contexto:** build local → pacote → servidor destino sem `--build`; updates futuros aplicam só migrations novas.

## Objetivo

No destino: carregar imagens pré-compiladas, subir a stack sem compilar, e opcionalmente aplicar `migration_*.sql` ainda não registradas, com tracking em PostgreSQL.

## Tabela

```sql
CREATE TABLE IF NOT EXISTS simpa_schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Criada sob demanda pelo script de apply (não exige migration dedicada no initdb).

## Scripts

| Artefato | Função |
|----------|--------|
| `scripts/apply-migrations.sh` | Linux: apply + `--baseline N` |
| `scripts/apply-migrations.ps1` | Windows: idem |
| `scripts/deploy-release.sh` | passa a aceitar `--migrate` (e `--recreate`) |
| `scripts/deploy-release.ps1` | idem (`-Migrate`, `-Recreate`) |

### Apply (pendentes)

1. Lê `PG_USER` / `PG_DB` / `COMPOSE_PROJECT_NAME` de `.env.docker` (defaults: `postgres` / `simpa` / `simpa`).
2. Garante a tabela `simpa_schema_migrations`.
3. Lista `migration_*.sql` na raiz do pacote (ordem lexicográfica = ordem numérica zero-padded).
4. Para cada arquivo cujo `filename` não está na tabela: `docker cp` → `psql -v ON_ERROR_STOP=1 -f` → `INSERT INTO simpa_schema_migrations(filename)`.
5. Para no primeiro erro; imprime resumo (aplicadas / já registradas / baseline).

### Baseline (pós-restore)

`apply-migrations.sh --baseline 012` (ou `.ps1 -Baseline 012`):

- Não executa SQL das migrations.
- Insere em `simpa_schema_migrations` todos os arquivos cujo número extraído do prefixo `migration_NNN_` seja `<= 12`.
- Idempotente (`ON CONFLICT DO NOTHING`).

Uso típico após restore de dump antigo (~até 012): baseline 012 → apply → restart api.

### Deploy

| Comando | Efeito |
|---------|--------|
| `deploy-release.sh` | `docker load` + `compose up -d --no-build` |
| `deploy-release.sh --recreate` | + `--force-recreate` (preserva volume PG) |
| `deploy-release.sh --migrate` | sobe stack + `apply-migrations` |
| `deploy-release.sh --recreate --migrate` | update de versão típico |

Ordem das flags irrelevante. Após `--migrate`, restart do serviço `api`.

## Projeto Compose `simpa`

- `.env.docker.example`: `COMPOSE_PROJECT_NAME=simpa`.
- `deploy-release` / `apply-migrations` leem o valor e passam `docker compose -p <nome>` (não confiar só em `--env-file` para project name).
- Containers esperados: `simpa-postgres-1`, `simpa-api-1`, `simpa-web-1`.

## Export (PC de build)

`docker-release-export.ps1` continua build local + `docker save` + zip, e passa a incluir:

- `scripts/apply-migrations.sh` / `.ps1`
- `scripts/deploy-release.sh` / `.ps1` (já incluídos)
- ETL completo (incl. `sync_sih_mysql.py`)
- todos `migration_*.sql`
- `.env.docker.example` com `SIMPA_VERSION=<versão do pacote>` e `COMPOSE_PROJECT_NAME=simpa`

## Fluxos

### Primeira instalação + restore

1. Export no PC de build → transferir zip.
2. Destino: `.env.docker` com segredos + `SIMPA_VERSION` + `COMPOSE_PROJECT_NAME=simpa`.
3. `bash scripts/deploy-release.sh` (sem migrate).
4. Recriar DB vazio + restore do `.sql` (guia operacional).
5. `bash scripts/apply-migrations.sh --baseline 012`
6. `bash scripts/apply-migrations.sh`
7. `docker compose -p simpa --env-file .env.docker restart api`

### Update de versão

1. Novo pacote no destino; atualizar `SIMPA_VERSION` no `.env.docker`.
2. `bash scripts/deploy-release.sh --recreate --migrate`

## Fora de escopo

- Alterar mounts `docker-entrypoint-initdb.d` (volume zerado segue aplicando 002–027 no first boot).
- Baseline automático por introspecção de schema.
- UI admin para migrations.

## Testes

- Pytest (unitário, sem Docker): parsing de número de migration, filtro de pendentes vs registrados, seleção de baseline `<= N`.
- Extensão do teste de pacote release: export inclui `apply-migrations.*`.
- Docs: `docs/agent/docker-env.md` + `docs/agent/restore-backup-e-release-docker.md`.
