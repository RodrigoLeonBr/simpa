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
| `.env.docker.example` | template Compose |

Copiar antes do primeiro uso:

```powershell
copy .env.example .env
copy .env.docker.example .env.docker
```

## docker-compose.yml

Serviços típicos:

| Serviço | Imagem / build | Notas |
|---------|----------------|-------|
| `postgres` | postgres:15 | init SQL montados |
| `api` | `Dockerfile.api` | `env_file: .env.docker` |
| `web` | `Dockerfile.web` | nginx + static build |

## Scripts npm (raiz `package.json`)

| Script | Ação |
|--------|------|
| `npm run docker:up` | `docker compose --env-file .env.docker up -d` |
| `npm run docker:down` | para stack |
| `npm run docker:dev:refresh` | rebuild dev |
| `npm run docker:prod:refresh` | rebuild prod |
| `npm run docker:smoke` | health check |
| `npm run docker:test` | sobe stack para E2E |

## Scripts Windows

| Arquivo | Chama |
|---------|-------|
| `atualizar-docker-dev.bat` | `scripts/docker-dev-refresh.ps1` |
| `atualizar-docker-prod.bat` | `scripts/docker-prod-refresh.ps1` |

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
PYTHON_PATH=python
```

### Frontend (build)

```
VITE_API_URL=            # vazio = same origin no nginx
```

### MySQL (ETL)

```
MYSQL_HOST=host.docker.internal   # Docker → host XAMPP
MYSQL_PORT=3306
MYSQL_DB=...
```

### Compose

```
WEB_PORT=8080
```

## Troubleshooting

| Problema | Causa comum | Solução |
|----------|-------------|---------|
| API não conecta PG | `PG_PASS` ≠ senha do volume | alinhar senha ou `docker volume rm` |
| :8080 mostra Apache | `WEB_PORT` errado ou Apache na 80 | usar 8080, parar Apache ou mudar porta |
| Sync MySQL falha no Docker | host não alcança XAMPP | `host.docker.internal` |

## nginx

Config: `docker/nginx/nginx.conf` — proxy `/api` e `/auth` para serviço `api`.

`POST /api/sia/sincronizar` e `POST /api/sih/sincronizar` usam `proxy_read_timeout 600s` (demais rotas `/api/` permanecem em 120s). Rebuild/restart do container `web` após alterar o nginx.

Variáveis de lote SIA (`SIA_EXTRACT_BLOCK_SIZE`, `SIA_PG_BATCH_SIZE`): ver `.env.docker.example` — restart do container `api` após alterar.

## Deploy remoto (build local, sem compilar no servidor)

Para máquinas de produção com pouco recurso: **compile aqui**, transfira o pacote, **suba lá sem `--build`**.

### Fluxo resumido

| Etapa | Onde | Comando |
|-------|------|---------|
| 1. Exportar pacote | PC de desenvolvimento | `npm run docker:release:export` ou `exportar-docker-release.bat` |
| 2. Transferir | scp/rsync/USB | pasta `release/simpa-<versão>/` ou `.zip` |
| 3. Configurar env | Servidor remoto | `cp .env.docker.example .env.docker` + editar segredos |
| 4. Subir stack | Servidor remoto | `bash scripts/deploy-release.sh` |

### PC de desenvolvimento (build)

Pré-requisito: `.env.docker` configurado (só para `PG_PASS` no compose build context).

```powershell
# Compila api + web e gera pacote em release/simpa-<versão>/
npm run docker:release:export

# Opcional: só compilar, sem empacotar
npm run docker:release:build

# Versão customizada
powershell -File scripts/docker-release-export.ps1 -Version "1.2.0"
```

Saída:

- `release/simpa-<versão>/` — pasta completa para o servidor
- `release/simpa-<versão>.zip` — mesmo conteúdo compactado

O pacote inclui: imagens `.tar`, `docker-compose.yml`, `docker-compose.deploy.yml`, SQL, scripts ETL montados como volume, e `scripts/deploy-release.sh`.

### Servidor remoto (sem build)

```bash
unzip simpa-2026.06.21.zip
cd simpa-2026.06.21
cp .env.docker.example .env.docker
# Editar PG_PASS, JWT_SECRET, MYSQL_*, WEB_PORT
# IMPORTANTE: SIMPA_VERSION deve ser igual à versão do pacote (ex.: 2026.06.21-HHmm)
nano .env.docker

bash scripts/deploy-release.sh
```

Atualizar release mantendo dados do Postgres:

```bash
bash scripts/deploy-release.sh --recreate
```

Windows no servidor:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-release.ps1
```

### Variável SIMPA_VERSION

Definida em `.env.docker`. Deve coincidir com a tag das imagens no pacote.

As imagens são nomeadas `simpa-api:<versão>` e `simpa-web:<versão>`. O `docker-compose.deploy.yml` remove o bloco `build` e usa `--no-build`.

### Importar pacote já descompactado (dev)

```powershell
powershell -File scripts/docker-release-import.ps1 -BundlePath release/simpa-2026.06.21-HHmm
```

Requer `.env.docker` **dentro** da pasta do pacote com `SIMPA_VERSION` correto.

### Requisitos no servidor remoto

- Docker Engine + Docker Compose v2.24+ (suporte a `build: !reset null`)
- Portas livres: `WEB_PORT` (default 8080), `PG_PUBLISH_PORT` (opcional, default 5433)
- MySQL acessível se usar sync SIA (`MYSQL_HOST` — em Linux use IP do host, não `host.docker.internal`)
