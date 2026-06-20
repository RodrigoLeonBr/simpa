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

Config: `docker/nginx.conf` — proxy `/api` e `/auth` para serviço `api`.
