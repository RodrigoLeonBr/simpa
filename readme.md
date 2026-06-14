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
- **Python** — ETL e-SUS e conector SIA (`parse_esus_csv.py`)
- **Node.js / Express** — API REST (Plano B)
- **React + Vite + ECharts** — dashboards (Plano C)

## Setup local

### 1. PostgreSQL (Docker)

```powershell
# Container esperado: saas-postgres (porta 5432)
docker exec saas-postgres psql -U postgres -c "CREATE DATABASE simpa;"  # se ainda não existir
Get-Content schema_full.sql | docker exec -i saas-postgres psql -U postgres -d simpa
```

### 2. Variáveis de ambiente

```powershell
copy .env.example .env
# Edite .env com PG_PASS e credenciais MySQL/XAMPP (SIA)
```

### 3. Python

```powershell
pip install -r requirements.txt
python parse_esus_csv.py <arquivo.csv> --json-out   # preview JSON
python parse_esus_csv.py <arquivo.csv> --pg-write   # grava no PostgreSQL
python parse_esus_csv.py <pasta_csvs> seed.sql      # modo legado (gera SQL)
python sync_sia_mysql.py --competencia 2026-05      # sync SIA (requer MySQL)
```

> **Nota:** exports e-SUS vêm em ISO-8859-1. Converta para UTF-8 antes do parse, ou use `iconv`.

## Agentes Claude Code

Os arquivos `simpa_*.md` na raiz descrevem personas especializadas (ETL, DBA, backend, frontend, financiamento, LGPD, produto) para uso com Claude Code.

## Estado do projeto

- [x] PRD, design spec e planos de implementação
- [x] Parser e-SUS (`parse_esus_csv.py`) + seed SQL de exemplo
- [x] Schema PostgreSQL completo (`schema_full.sql` v3.1.0) aplicado no Docker
- [x] Flags `--json-out` / `--pg-write` no parser (Plano A)
- [x] `sync_sia_mysql.py` — conector SIA (requer credenciais MySQL/XAMPP no `.env`)
- [ ] Backend Express (`simpa-backend/`)
- [ ] Frontend React (`simpa-frontend/`)

## Repositório

https://github.com/RodrigoLeonBr/simpa
