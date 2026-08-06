# Restaurar backup PostgreSQL e release Docker

Guia operacional: gerar pacote **neste PC** (com build), subir no **servidor destino sem compilar**, restaurar backup e aplicar migrations com tracking.

Design: [2026-07-24-deploy-release-migrate-design.md](../superpowers/specs/2026-07-24-deploy-release-migrate-design.md) · Env/Compose: [docker-env.md](docker-env.md) · Schema: [database.md](database.md).

---

## Cheatsheet (o essencial)

### Neste PC (build + pacote)

```powershell
# Na raiz do clone, com .env.docker ok
powershell -ExecutionPolicy Bypass -File scripts\docker-release-export.ps1 -Version "2026.07.24"
# Saída: release\simpa-2026.07.24\  e  release\simpa-2026.07.24.zip
```

### Servidor destino — 1ª vez (stack zero + restore + migrations)

```bash
unzip simpa-2026.07.24.zip && cd simpa-2026.07.24
cp .env.docker.example .env.docker
# Editar: PG_PASS, JWT_SECRET, MYSQL_*  (SIMPA_VERSION e COMPOSE_PROJECT_NAME=simpa já vêm no example)

bash scripts/deploy-release.sh

# Recriar DB vazio + restore do .sql (seção "Banco vazio → restaurar")
bash scripts/apply-migrations.sh --baseline 012
bash scripts/apply-migrations.sh
docker compose -p simpa --env-file .env.docker restart api
```

Containers: `simpa-postgres-1`, `simpa-api-1`, `simpa-web-1`.

### Servidor destino — próximas versões

```bash
# Nova pasta/zip; atualizar SIMPA_VERSION no .env.docker
bash scripts/deploy-release.sh --recreate --migrate
```

`--recreate` troca imagens **sem** apagar o volume PG. `--migrate` aplica só `migration_*.sql` ainda não registrados em `simpa_schema_migrations` e reinicia a `api`.

---

## Pré-requisitos

| Onde | Precisa |
|------|---------|
| PC de build | Docker, `.env.docker`, código atual (incl. `Dockerfile.api` com ETL SIH) |
| Destino | Docker Engine + Compose **v2.24+**, portas `WEB_PORT` / `PG_PUBLISH_PORT`, MySQL acessível se for sync SIA/SIH |
| Destino | **Não** precisa de Node/npm para build — só `docker load` + scripts do pacote |

---

## Banco vazio → restaurar

### Por que limpar antes

Se o Postgres já tem migrations mais novas que o dump (ex.: `sih_*`, `metas_oci_par`), o restore com `--clean` falha ao dropar a PK de `estabelecimentos` por causa de FKs que **não existem** no arquivo de backup.

Não use `docker compose down -v` + `up` e restaure em cima: o init recria o schema atual completo e o mesmo erro volta.

### Destino / projeto `simpa` (recomendado)

Com `COMPOSE_PROJECT_NAME=simpa` no `.env.docker`:

```bash
docker compose -p simpa --env-file .env.docker exec -T postgres \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'simpa' AND pid <> pg_backend_pid();"

docker compose -p simpa --env-file .env.docker exec -T postgres \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS simpa;"

docker compose -p simpa --env-file .env.docker exec -T postgres \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE simpa OWNER postgres;"

docker compose -p simpa --env-file .env.docker cp /caminho/backup.sql postgres:/tmp/backup.sql
docker compose -p simpa --env-file .env.docker exec -T postgres \
  psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/backup.sql
```

### Dev local (sem `-p`, pasta do clone)

```powershell
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'simpa' AND pid <> pg_backend_pid();"
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS simpa;"
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE simpa OWNER postgres;"
docker compose --env-file .env.docker cp "CAMINHO\PARA\simpa-backup-....sql" postgres:/tmp/backup.sql
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/backup.sql
```

Alternativa (mesmo efeito):

```powershell
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d simpa -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/backup.sql
```

Se `PG_USER` / `PG_DB` no `.env.docker` forem diferentes de `postgres` / `simpa`, troque nos comandos.

### Alternativa pela UI

Com stack no ar e login **admin**: **Administração → Backup → Restaurar de arquivo .sql**, confirme digitando `RESTAURAR`.

Limite padrão: 500 MB (`BACKUP_MAX_RESTORE_MB`). Continua válido: **não restaurar em cima de um schema mais novo sem limpar antes**.

---

## Depois do restore: schema da origem

O schema fica **como no dump**. O código novo pode exigir migrations posteriores.

- Só consultar dados do backup → ok.
- App atual em cima desses dados → baseline + apply (próxima seção).

Exemplo: dump até ~migration **012** tem `populacao_cadastrada`, mas **não** tem `sih_*`, `metas_oci_par`, `procedimentos_esus_sigtap`.

```bash
docker compose -p simpa --env-file .env.docker exec -T postgres \
  psql -U postgres -d simpa -c "\dt public.*"
```

---

## Migrations com tracking (`simpa_schema_migrations`)

Tabela criada sob demanda por `scripts/apply-migrations.sh` / `.ps1`:

```sql
CREATE TABLE IF NOT EXISTS simpa_schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Comando | Efeito |
|---------|--------|
| `apply-migrations.sh` | Aplica `migration_*.sql` cujo `filename` **não** está na tabela; registra após sucesso |
| `apply-migrations.sh --baseline 012` | **Não** executa SQL: marca `migration_002`…`migration_012_*` como aplicadas (`ON CONFLICT DO NOTHING`) |
| `deploy-release.sh --migrate` | Sobe/atualiza stack + apply pendentes + `restart api` |

**UTF-8 no Windows:** o script usa `docker cp` + `psql -f` (nunca `Get-Content | docker exec`).

### Após restore de dump antigo

```bash
# Ajuste 012 ao último número já coberto pelo dump
bash scripts/apply-migrations.sh --baseline 012
bash scripts/apply-migrations.sh
docker compose -p simpa --env-file .env.docker restart api
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\apply-migrations.ps1 -Baseline 012
powershell -ExecutionPolicy Bypass -File scripts\apply-migrations.ps1
docker compose -p simpa --env-file .env.docker restart api
```

Se falhar, **não pule a ordem** — corrija e rode `apply-migrations` de novo (só pendentes).

| Migration | Efeito principal |
|-----------|------------------|
| 013 | `sih_sincronizacoes`, `sih_internacoes`, `sih_procedimentos` |
| 014 | métricas/widgets SIA no painel |
| 015 | `metas_oci_par` + coluna APAC em `sia_producao` |
| 016–017 | correções UTF-8 (widgets / nomes) |
| 018 | `status_editado` em estabelecimentos |
| 019 | `sql_override` em widgets |
| 020 | `sih_aih` |
| 021 | UTF-8 métricas e-SUS/SIA/PATE |
| 022 | `procedimentos_esus_sigtap` |
| 023 | campos extras em `sih_aih` |
| 024 | widgets SIH AIH |
| 025 | `sih_procedimentos.qtd_linhas` |
| 026 | leitos por vigência |
| 027 | UTF-8 métricas SIH + formas “Atenção…” |
| 028 | view `v_esus_producao` (join canônico e-SUS) |
| 029 | `procedimentos_esus_sigtap.origem` + view `v_esus_producao_sigtap` |
| 030 | métricas/widgets "Consultas" APS (SIA) |
| 031 | `painel_widgets.agregacao_periodo` (período trimestre/quadri/ano) |

### Conferir depois

```bash
docker compose -p simpa --env-file .env.docker exec -T postgres \
  psql -U postgres -d simpa -c "SELECT filename FROM simpa_schema_migrations ORDER BY filename;"
```

Devem existir, entre outras: `sih_sincronizacoes`, `sih_internacoes`, `sih_procedimentos`, `sih_aih`, `metas_oci_par`, `procedimentos_esus_sigtap`.

### Após migrations

1. Login com usuário que veio no **backup**.
2. Smoke: `http://localhost:8080/api/health` (ou `WEB_PORT`).
3. **SIH:** migrations só criam schema — sincronize em **Importação** se precisar de produção.
4. **SIA / e-SUS:** dados do dump já devem estar em `sia_producao` / `dados_consolidados`.

---

## Gerar pacote neste PC (build local)

Pré-requisito: `.env.docker` no clone (compose usa `PG_PASS` no contexto de build).

```powershell
npm run docker:release:export
# ou
.\exportar-docker-release.bat
# ou versão fixa:
powershell -ExecutionPolicy Bypass -File scripts\docker-release-export.ps1 -Version "2026.07.24"

# Só build das imagens, sem zip:
npm run docker:release:build
```

| Artefato | Conteúdo |
|----------|----------|
| `release/simpa-<versão>/` | Pasta pronta para o servidor |
| `release/simpa-<versão>.zip` | Mesmo conteúdo compactado |

O pacote inclui:

- Imagens `images/simpa-api-<versão>.tar` e `simpa-web-<versão>.tar`
- `docker-compose.yml`, `docker-compose.deploy.yml`
- `.env.docker.example` com `SIMPA_VERSION=<versão>` e `COMPOSE_PROJECT_NAME=simpa`
- `schema_full.sql` + todos `migration_*.sql`
- ETL: `parse_esus_csv.py`, `consolidate_dashboard.py`, `sync_sia_mysql.py`, `sync_sih_mysql.py`, `sync_cadastros_mysql.py`, `etl_contract.py`, `etl_db.py`
- Scripts: `deploy-release.sh` / `.ps1`, `apply-migrations.sh` / `.ps1`
- `MANIFEST.txt`

---

## Atualizar outro servidor (sem `--build`)

### Variáveis no destino

| Variável | Função |
|----------|--------|
| `SIMPA_VERSION` | Tag das imagens (`simpa-api:<versão>`, `simpa-web:<versão>`) — deve bater com o nome dos `.tar` |
| `COMPOSE_PROJECT_NAME` | Default `simpa` → containers `simpa-postgres-1`, `simpa-api-1`, `simpa-web-1` |
| `PG_PASS`, `JWT_SECRET`, `MYSQL_*`, `WEB_PORT` | Segredos / rede |

`docker-compose.deploy.yml` remove o bloco `build` (deploy sempre `--no-build`) **e** os bind-mounts `./sync_*.py`/`etl_*.py` do serviço `api` (`volumes: !override` → só `uploads`). Os scripts Python já estão embutidos na imagem (`Dockerfile.api`); assim o destino **não** precisa dos `.py` no host e não corre o risco do diretório-fantasma. Requer Compose **v2.24+** (tags `!reset`/`!override`).

### Flags do deploy

| Comando | Efeito |
|---------|--------|
| `bash scripts/deploy-release.sh` | `docker load` + `up -d --no-build` |
| `… --recreate` | + `--force-recreate` (mantém volume PG) |
| `… --migrate` | + apply pendentes + restart `api` |
| `… --recreate --migrate` | update típico de versão |

Windows: `deploy-release.ps1 -Recreate -Migrate`.

### Fluxo

| Etapa | Onde | Ação |
|-------|------|------|
| 1 | PC de build | `npm run docker:release:export` (ou `-Version "…"`) |
| 2 | Rede / USB | Transferir pasta ou `.zip` |
| 3 | Destino | `cp .env.docker.example .env.docker` + editar segredos |
| 4 | Destino | `deploy-release` (1ª vez) ou `--recreate --migrate` (update) |

### Teste local do pacote (no PC de build)

```powershell
# Copiar .env.docker para dentro da pasta do release e ajustar SIMPA_VERSION
powershell -File scripts/docker-release-import.ps1 -BundlePath release/simpa-2026.07.24 -Recreate -Migrate
```

---

## Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| `python3: can't open file '/app/sync_sia_mysql.py'` (ou `sync_sih`/`consolidate_dashboard`/`parse_esus`…) | **Bind-mount mascarando a imagem.** `docker-compose.yml` monta `./sync_*.py:/app/…:ro`; se o `.py` faltar no host (deploy parcial), o Docker cria um **diretório vazio** no lugar e esconde a cópia embutida na imagem | Usar o overlay deploy (que **remove** esses mounts — imagem já contém os scripts): `docker compose -f docker-compose.yml -f docker-compose.deploy.yml --env-file .env.docker up -d --no-build --force-recreate api`. Se sobraram dirs-fantasma no host, `rmdir sync_*.py etl_*.py consolidate_dashboard.py parse_esus_csv.py`. Ver [docker-env.md](docker-env.md) |
| `can't open file '/app/sync_sih_mysql.py'` mesmo com overlay deploy | Imagem antiga sem ETL SIH no `Dockerfile.api` | Reexportar release neste PC (código atual) e redeploy |
| `Missing images/simpa-api-….tar` | `SIMPA_VERSION` ≠ tag do pacote | Alinhar `.env.docker` com o nome da pasta/`MANIFEST.txt` |
| Containers com prefixo estranho | `COMPOSE_PROJECT_NAME` ausente | Usar `simpa` e `docker compose -p simpa …` |
| Apply tenta reexecutar 002… após restore | Sem baseline | `apply-migrations.sh --baseline N` antes do apply |
| Compose exige build no destino | Esqueceu overlay deploy | Scripts já usam `-f docker-compose.deploy.yml` |

---

## Referências

- Compose / env / portas: [docker-env.md](docker-env.md)
- Schema e lista de migrations: [database.md](database.md)
- Backup pela UI admin: [auth-roles.md](auth-roles.md) (seção Backup PostgreSQL)
- Spec: [deploy-release-migrate design](../superpowers/specs/2026-07-24-deploy-release-migrate-design.md)
