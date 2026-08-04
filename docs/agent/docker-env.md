# Docker e variáveis de ambiente

## Dois modos de desenvolvimento

| | Dev manual | Docker Compose |
|---|------------|----------------|
| Env file | `.env` | `.env.docker` |
| Frontend | Vite `:5173` | nginx `:8080` (via `WEB_PORT`) |
| API | Node `:3001` | container `api` |
| Postgres | container `:5433` publish | idem |

**Windows:** porta `80` costuma ser Apache/XAMPP — usar `WEB_PORT=8080` no `.env.docker`.

## Arquivos de exemplo

| Arquivo | Uso |
|---------|-----|
| `.env.example` | template dev local |
| `.env.docker.example` | template Compose / release |

Copiar antes do primeiro uso:

```powershell
copy .env.example .env
copy .env.docker.example .env.docker
```

## docker-compose.yml

| Serviço | Imagem / build | Notas |
|---------|----------------|-------|
| `postgres` | postgres:15 | init SQL montados (`schema_full` + `migration_002`…`027`) |
| `api` | `Dockerfile.api` | ETL Python no `/app`; `env_file: .env.docker` |
| `web` | `Dockerfile.web` | nginx + static build |

Volumes da `api` montam os `.py` da raiz (dev). No release, os mesmos arquivos vão no pacote; a imagem também faz `COPY` de todos os ETL (incl. `sync_sih_mysql.py` e `sync_cadastros_mysql.py`).

Overlay remoto: `docker-compose.deploy.yml` — remove `build` para subir só imagens pré-carregadas (`--no-build`).

## Scripts npm (raiz `package.json`)

| Script | Ação |
|--------|------|
| `npm run docker:up` | `docker compose --env-file .env.docker up -d` |
| `npm run docker:down` | para stack |
| `npm run docker:dev:refresh` | rebuild dev |
| `npm run docker:prod:refresh` | rebuild prod |
| `npm run docker:smoke` | health check |
| `npm run docker:test` | sobe stack para E2E |
| `npm run docker:release:build` | só build das imagens com tag `SIMPA_VERSION` |
| `npm run docker:release:export` | build + pacote `release/simpa-<versão>/` (+ zip) |
| `npm run docker:release:deploy` | importa pacote local (`docker-release-import.ps1`) |

## Scripts Windows / release

| Arquivo | Chama |
|---------|-------|
| `atualizar-docker-dev.bat` | `scripts/docker-dev-refresh.ps1` |
| `atualizar-docker-prod.bat` | `scripts/docker-prod-refresh.ps1` |
| `exportar-docker-release.bat` | `scripts/docker-release-export.ps1` |
| `scripts/deploy-release.sh` / `.ps1` | destino: load imagens + `up --no-build` (`--recreate`, `--migrate`) |
| `scripts/apply-migrations.sh` / `.ps1` | destino: apply pendentes / `--baseline N` |

## Dev manual (sem Docker para API/web)

```powershell
# Terminal 1 — só Postgres (ou docker compose postgres)
npm run dev:api    # :3001, lê .env
npm run dev:web    # :5173, proxy /api
```

## Variáveis importantes

### Postgres

```
PG_HOST=localhost        # ou postgres no compose
PG_PORT=5433             # publish host
PG_DB=simpa
PG_USER=postgres
PG_PASS=...
```

### API

```
PORT=3001
JWT_SECRET=...
UPLOAD_DIR=./uploads
PYTHON_BIN=python3
```

### Frontend (build)

```
VITE_API_BASE=           # vazio = same origin no nginx
```

### MySQL (ETL)

```
MYSQL_HOST=host.docker.internal   # Docker → host XAMPP
MYSQL_PORT=3306
MYSQL_DB=...
```

### Compose / release

```
WEB_PORT=8080
SIMPA_VERSION=2026.07.24          # tag das imagens do pacote
COMPOSE_PROJECT_NAME=simpa        # containers simpa-*-1
```

## Troubleshooting

| Problema | Causa comum | Solução |
|----------|-------------|---------|
| API não conecta PG | `PG_PASS` ≠ senha do volume | alinhar senha ou `docker volume rm` |
| :8080 mostra Apache | `WEB_PORT` errado ou Apache na 80 | usar 8080, parar Apache ou mudar porta |
| Sync MySQL falha no Docker | host não alcança XAMPP | `host.docker.internal` (Linux: IP do host) |
| `can't open file '/app/sync_sih_mysql.py'` | imagem antiga sem o script no `COPY` | rebuild/`docker:release:export` com `Dockerfile.api` atual |
| `Missing images/simpa-api-….tar` | `SIMPA_VERSION` divergente | alinhar `.env.docker` ao `MANIFEST.txt` do pacote |
| Apply reexecuta migrations antigas pós-restore | faltou baseline | `apply-migrations.sh --baseline N` |

## nginx

Config: `docker/nginx/nginx.conf` — proxy `/api` e `/auth` para serviço `api`.

`POST /api/sia/sincronizar` e `POST /api/sih/sincronizar` usam `proxy_read_timeout 600s` (demais rotas `/api/` permanecem em 120s). Rebuild/restart do container `web` após alterar o nginx.

Variáveis de lote SIA (`SIA_EXTRACT_BLOCK_SIZE`, `SIA_PG_BATCH_SIZE`): ver `.env.docker.example` — restart do container `api` após alterar.

## Deploy remoto (build local, sem compilar no servidor)

**Compile neste PC**, transfira o pacote, **suba no destino sem `--build`**.

Guia completo (restore, baseline, update): **[restore-backup-e-release-docker.md](restore-backup-e-release-docker.md)** (começa pelo cheatsheet).

### Fluxo resumido

| Etapa | Onde | Comando |
|-------|------|---------|
| 1. Exportar | PC de build | `npm run docker:release:export` ou `exportar-docker-release.bat` |
| 2. Transferir | scp/rsync/USB | `release/simpa-<versão>/` ou `.zip` |
| 3. Env | Destino | `cp .env.docker.example .env.docker` + segredos |
| 4a. 1ª vez | Destino | `bash scripts/deploy-release.sh` → restore → baseline → apply |
| 4b. Update | Destino | `bash scripts/deploy-release.sh --recreate --migrate` |

### PC de desenvolvimento (build)

```powershell
npm run docker:release:export
powershell -File scripts/docker-release-export.ps1 -Version "2026.07.24"
npm run docker:release:build   # só imagens
```

Saída: `release/simpa-<versão>/` + `.zip` (imagens, compose, SQL, ETL, `deploy-release.*`, `apply-migrations.*`, `MANIFEST.txt`).

### Servidor remoto

```bash
unzip simpa-2026.07.24.zip && cd simpa-2026.07.24
cp .env.docker.example .env.docker
# PG_PASS, JWT_SECRET, MYSQL_* — SIMPA_VERSION e COMPOSE_PROJECT_NAME=simpa já no example
bash scripts/deploy-release.sh
```

Update (preserva PG + migrations novas):

```bash
bash scripts/deploy-release.sh --recreate --migrate
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-release.ps1 -Recreate -Migrate
```

### `SIMPA_VERSION` e `COMPOSE_PROJECT_NAME`

- `SIMPA_VERSION` — tag `simpa-api:<versão>` / `simpa-web:<versão>` (deve coincidir com os `.tar`).
- `COMPOSE_PROJECT_NAME=simpa` — `simpa-postgres-1`, `simpa-api-1`, `simpa-web-1`.
- Deploy sempre usa `-p <projeto>` + `docker-compose.deploy.yml` + `--no-build`.

### Migrations no destino

Tracking: `simpa_schema_migrations` (criada pelo script).

```bash
bash scripts/apply-migrations.sh                 # só pendentes
bash scripts/apply-migrations.sh --baseline 012   # pós-restore: marca 002..012 sem executar
```

Detalhes e restore: [restore-backup-e-release-docker.md](restore-backup-e-release-docker.md).

### Importar pacote já descompactado (teste local)

```powershell
powershell -File scripts/docker-release-import.ps1 -BundlePath release/simpa-2026.07.24 -Recreate -Migrate
```

Requer `.env.docker` **dentro** da pasta do pacote com `SIMPA_VERSION` correto.

### Requisitos no servidor remoto

- Docker Engine + Docker Compose v2.24+ (`build: !reset null`)
- Portas: `WEB_PORT` (default 8080), `PG_PUBLISH_PORT` (opcional, 5433)
- MySQL acessível se usar sync SIA/SIH (`MYSQL_HOST` — em Linux use IP do host, não `host.docker.internal`)
