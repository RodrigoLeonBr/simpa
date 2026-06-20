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

### Opção A — Docker Compose (recomendado, 1 servidor)

```powershell
copy .env.example .env
# Edite .env: defina PG_PASS e credenciais MySQL/XAMPP (SIA)

docker compose up -d --build
# Web:  http://localhost        (porta 80)
# API:  http://localhost/api/health  (via nginx)
# Dev:  docker compose -f docker-compose.yml -f docker-compose.dev.yml up
#       expõe postgres:5432 e api:3001

# Smoke test (valida postgres + schema + proxy nginx):
powershell -ExecutionPolicy Bypass -File scripts/smoke-compose.ps1
```

O PostgreSQL inicializa automaticamente com `schema_full.sql` + `migration_002_auth.sql` + `migration_003_cadastros_fase2.sql` na primeira subida (volume `pgdata` vazio).

Para recriar o banco do zero: `docker compose down -v` (apaga dados) e suba novamente.

### Opção B — PostgreSQL manual (legado)

```powershell
# Container esperado: saas-postgres (porta 5432)
docker exec saas-postgres psql -U postgres -c "CREATE DATABASE simpa;"  # se ainda não existir
Get-Content schema_full.sql | docker exec -i saas-postgres psql -U postgres -d simpa
Get-Content migration_002_auth.sql | docker exec -i saas-postgres psql -U postgres -d simpa
Get-Content migration_003_cadastros_fase2.sql | docker exec -i saas-postgres psql -U postgres -d simpa
```

### Variáveis de ambiente

```powershell
copy .env.example .env
# Edite .env com PG_PASS e credenciais MySQL/XAMPP (SIA)
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
```

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

Por padrão, `.env.development` aponta para o mock (`http://localhost:3100`). Para usar o backend real, altere para `http://localhost:3001` e reinicie o Vite.

Build de produção:

```powershell
npm run build
# dist/ — VITE_API_BASE=http://localhost:3001 (.env.production)
```

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
- [ ] Frontend React (`simpa-frontend/`) — Task 09+

## Repositório

https://github.com/RodrigoLeonBr/simpa
