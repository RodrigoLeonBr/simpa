# SIMPA — Sistema Integrado de Monitoramento e Planejamento de Americana

Plataforma de BI governamental para a Secretaria de Saúde de Americana/SP. Unifica dados do e-SUS APS, SIA/SUS e SIHD em painéis gerenciais com arquitetura spec-driven (contrato JSON v3.1.0).

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [`prd-simpa.md`](prd-simpa.md) | PRD completo — visão, módulos, contrato API, roadmap |
| [`estrutura_simpa.md`](estrutura_simpa.md) | Estrutura de menus (7 módulos CRM-like) |
| [`docs/superpowers/specs/`](docs/superpowers/specs/) | Design spec do frontend MVP |
| [`docs/superpowers/plans/`](docs/superpowers/plans/) | Planos de implementação (A: ETL, B: Backend, C: Frontend) |

## Stack prevista

- **PostgreSQL 15+** — staging + JSONB (`schema_full.sql`)
- **Python** — ETL e-SUS, consolidação dashboard e conector SIA (`parse_esus_csv.py`, `consolidate_dashboard.py`)
- **Node.js / Express** — API REST (Plano B)
- **React + Vite + ECharts** — dashboards (Plano C)

## Setup local

### Opção A — Docker Compose (recomendado, app completo)

Um comando sobe **PostgreSQL + API + React (nginx)** na mesma origem:

```powershell
copy .env.docker.example .env.docker
# Edite .env.docker: PG_PASS, JWT_SECRET, credenciais MySQL/XAMPP (SIA)

npm run docker:up
# ou: docker compose --env-file .env.docker up -d --build

# Rebuild/recreate apos mudar frontend/backend (producao):
npm run docker:prod:refresh
# ou clique em atualizar-docker-prod.bat

# Web:  http://localhost:8080         (porta WEB_PORT, default 8080)
# API:  http://localhost:8080/api/health  (proxy nginx → api:3001)
# Login: admin / simpa@2026 (após seed — ver abaixo)

# Dev compose (API :3001, web build em :8080):
npm run docker:dev
npm run docker:dev:up

# Rebuild/recreate apos mudar frontend/backend:
npm run docker:dev:refresh
# ou clique em atualizar-docker-dev.bat

# Smoke test (postgres + schema + proxy + SPA React):
npm run docker:smoke
```

**Primeiro deploy:** criar usuário admin no banco (fora ou dentro do container):

```powershell
npm run seed:admin
# ou: docker compose --env-file .env.docker exec api node scripts/seed-admin.js
```

O PostgreSQL inicializa automaticamente com `schema_full.sql` + migrations na primeira subida (volume `pgdata` vazio).

Para recriar o banco do zero: `docker compose --env-file .env.docker down -v` (apaga dados) e suba novamente.

### Opção B — Dev local (API + Vite, sem Docker web)

Postgres acessível via `.env` (`PG_HOST=127.0.0.1`, `PG_PUBLISH_PORT=5433` se Docker só do PG):

```powershell
copy .env.example .env
npm run install:all

# Terminal único (PowerShell):
powershell -ExecutionPolicy Bypass -File scripts/dev-local.ps1

# Ou dois terminais:
npm run dev:api    # http://localhost:3001
npm run dev:web    # http://localhost:5173 (proxy Vite → API)
```

No fluxo local, o backend lê `/.env`; no Docker Compose, os containers usam `/.env.docker`.

### Opção C — Build manual + Docker só da API

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-all.ps1
docker compose --env-file .env.docker up -d --build postgres api web
```

### Opção D — PostgreSQL manual (legado)

```powershell
# Container esperado: saas-postgres (porta 5432)
docker exec saas-postgres psql -U postgres -c "CREATE DATABASE simpa;"  # se ainda não existir
Get-Content schema_full.sql | docker exec -i saas-postgres psql -U postgres -d simpa
Get-Content migration_002_auth.sql | docker exec -i saas-postgres psql -U postgres -d simpa
Get-Content migration_003_cadastros_fase2.sql | docker exec -i saas-postgres psql -U postgres -d simpa
Get-Content migration_004_cadastros_sync.sql | docker exec -i saas-postgres psql -U postgres -d simpa
```

### Variáveis de ambiente

```powershell
copy .env.example .env
# Edite .env para o desenvolvimento manual (backend :3001 / frontend :5173)

copy .env.docker.example .env.docker
# Edite .env.docker para o Docker Compose
```

### 3. Python

```powershell
pip install -r requirements.txt
python parse_esus_csv.py <arquivo.csv> --json-out   # preview JSON
python parse_esus_csv.py <arquivo.csv> --pg-write   # grava no PostgreSQL (esus_cargas + esus_indicadores_raw)
python parse_esus_csv.py <pasta_csvs> seed.sql      # modo legado (gera SQL)
python consolidate_dashboard.py --competencia 2026-05 --unidade "..." --equipe "..." --json-out  # preview Painel
python consolidate_dashboard.py --competencia 2026-05 --unidade "..." --equipe "..." --pg-write  # grava dados_consolidados
python consolidate_dashboard.py --all --pg-write    # backfill: todos os grupos com cargas e-SUS
python sync_sia_mysql.py --competencia 2025-06      # sync SIA (requer MySQL)
python sync_cadastros_mysql.py --pg-write          # espelho prestador/procedimento MySQL
python scripts/migrate_cadastros_legacy.py --pg-write  # FK legado → estabelecimentos (one-time)
```

**Ordem cadastros sync (one-time):**

1. Migrations 001–004 (`schema_full` + `migration_002` + `003` + `004`)
2. `python sync_cadastros_mysql.py --pg-write` — popula `estabelecimentos` do MySQL
3. `python scripts/migrate_cadastros_legacy.py --pg-write` — backfill FK + relatório + rename `_deprecated_*`

Preview: `python scripts/migrate_cadastros_legacy.py --dry-run`

**API cadastros sync:** `POST /api/cadastros/sincronizar` exige JWT com perfil `Administrador`, `Gestor Secretaria` ou `Planejamento`. Sync concorrente retorna HTTP 409; timeout configurável via `CADASTRO_SYNC_TIMEOUT_MS` (padrão 300000 ms).

> **Nota:** exports e-SUS vêm em ISO-8859-1. Converta para UTF-8 antes do parse, ou use `iconv`.

**Fluxo importação → Painel:** upload CSV (`POST /importacao/upload`) grava raw e dispara consolidação automaticamente. O Painel (`GET /api/v1/dashboard/planejamento`) lê `dados_consolidados`. Se você importou antes desta feature, rode o backfill:

```powershell
python consolidate_dashboard.py --all --pg-write
# ou via API:
curl -X POST "http://localhost:3001/api/v1/dashboard/consolidar?all=true"
```

### 4. Backend API

```powershell
cd simpa-backend
npm install
copy ..\.env .env
npm run dev
# http://localhost:3001/api/health
```

### 5. Frontend React

```powershell
cd simpa-frontend
npm install

# Terminal 1 — mock API (json-server 0.17, porta 3100)
npm run mock

# Terminal 2 — app Vite (porta 5173)
npm run dev
# http://localhost:5173
```

Por padrão, `.env.development` aponta para `http://localhost:3001`. Para mock json-server (`:3100`), altere e reinicie o Vite.

Build de produção (gera `simpa-frontend/dist/`, API same-origin quando servido pelo nginx):

```powershell
npm run build
# ou na raiz: scripts/build-all.ps1
# VITE_API_BASE vazio em .env.production — /api e /auth via nginx
```

### Scripts na raiz (`package.json`)

| Comando | Descrição |
|---------|-----------|
| `npm run install:all` | Instala deps backend + frontend |
| `npm run build` | Build Vite → `simpa-frontend/dist` |
| `npm run dev:api` / `dev:web` | Dev local separado |
| `npm run docker:up` | Compose produção (PG + API + React/nginx) |
| `npm run docker:prod:refresh` | Rebuild/recreate do Docker prod usando `.env.docker` |
| `npm run docker:dev` | Compose dev (portas 3001/8080) |
| `npm run docker:dev:up` | Compose dev em background |
| `npm run docker:dev:refresh` | Rebuild/recreate do Docker dev usando `.env.docker` |
| `npm run docker:smoke` | Valida stack Docker |
| `npm run test` | Jest backend + Vitest frontend |
| `npm run test:py` | Pytest unitário (sem integração PG) |
| `npm run test:py:integration` | Pytest integração (requer Postgres em `PG_HOST`) |
| `npm run test:e2e` | Playwright E2E (stack test em `:8080`) |
| `npm run ci` | Pipeline completo (`scripts/ci.sh` — Linux/CI) |
| `npm run docker:test` | Sobe stack CI/E2E (porta 8080) |

## Agentes Claude Code

Os arquivos `simpa_*.md` na raiz descrevem personas especializadas (ETL, DBA, backend, frontend, financiamento, LGPD, produto) para uso com Claude Code.

## Estado do projeto

- [x] PRD, design spec, TechSpec Compozy e planos de implementação
- [x] **Task 01** — Docker Compose (postgres + api + nginx), migrations 002/003
- [x] Parser e-SUS (`parse_esus_csv.py`) + seed SQL de exemplo
- [x] Schema PostgreSQL completo (`schema_full.sql` v3.1.0)
- [x] Consolidador dashboard (`consolidate_dashboard.py`) — Task 02
- [x] `sync_sia_mysql.py` — Task 02
- [x] Backend Express stub (`simpa-backend/`) — health + PG; rotas completas Task 03+
- [x] Frontend React (`simpa-frontend/`) — Painel, Importação, analytics (tasks 09–15)
- [x] Docker web — build React integrado no nginx (`Dockerfile.web` multi-stage)
- [x] **Task 17** — Administração UI (usuários, auditoria, configurações)
- [x] **Task 18** — nginx prod, Playwright E2E, GitHub Actions CI

## CI / E2E

Pipeline em [`.github/workflows/ci.yml`](.github/workflows/ci.yml) executa três camadas:

1. **pytest** — unit + integração PostgreSQL
2. **Jest + Vitest** — API e frontend
3. **Playwright** — fluxo crítico contra stack Docker (login → painel → filtros → importação → cadastros → tema → logout)

Local (Linux/macOS ou Git Bash):

```bash
cp .env.docker.example .env.docker   # ajuste PG_PASS e JWT_SECRET
npm run ci
```

Somente E2E (stack test já rodando):

```powershell
npm run docker:test
docker compose --env-file .env.docker exec -T api node scripts/seed-admin.js
npm run test:e2e
# App: http://localhost:8080
```

Credenciais E2E padrão: `admin` / `simpa@2026` (variáveis `E2E_ADMIN_USER`, `E2E_ADMIN_PASS`).

**Deploy produção (TI municipal):** `copy .env.docker.example .env.docker` → definir `PG_PASS` e `JWT_SECRET` → `npm run docker:up` → `npm run seed:admin` → acessar `http://localhost:8080` (porta `WEB_PORT`).

**Atualização rápida do Docker dev no Windows:** execute `atualizar-docker-dev.bat` na raiz. Opcionalmente passe `api` ou `web` para recriar só um serviço: `atualizar-docker-dev.bat api`.

**Atualização rápida do Docker prod no Windows:** execute `atualizar-docker-prod.bat` na raiz. Opcionalmente passe `api` ou `web`: `atualizar-docker-prod.bat web`.

## Repositório

https://github.com/RodrigoLeonBr/simpa
