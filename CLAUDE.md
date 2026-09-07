# SIMPA — Guia para agentes (Claude Code / Cursor)

Plataforma de BI da Secretaria de Saúde de **Americana/SP**. Unifica e-SUS APS, SIA/SUS e SIHD em painéis gerenciais. Contrato de dashboard JSON **v3.1.0**.

**Leia este arquivo primeiro.** Detalhes por módulo estão em [`docs/agent/`](docs/agent/README.md) — não varra o repositório inteiro antes de consultar o índice abaixo.

---

## Stack

| Camada | Tecnologia | Pasta / artefato |
|--------|------------|------------------|
| API | Node 18, Express, JWT, `pg` | `simpa-backend/` |
| UI | React 19, Vite 8, Tailwind 4, ECharts | `simpa-frontend/` |
| ETL | Python 3, pandas, psycopg2 | raiz (`*.py`) |
| DB | PostgreSQL 15 | `schema_full.sql`, `migration_*.sql` |
| SIA (read-only) | MySQL/XAMPP | `sync_sia_mysql.py`, `sync_cadastros_mysql.py` |
| Deploy | Docker Compose + nginx | `docker-compose.yml`, `Dockerfile.*` |
| Spec / tasks | Compozy | `.compozy/tasks/<slug>/` |

---

## Mapa do repositório

```
simpa/
├── simpa-backend/src/     # API Express
├── simpa-frontend/src/    # SPA React
├── docker/                # nginx.conf
├── scripts/               # dev, CI, docker refresh, smoke
├── docs/agent/            # referência modular (LEIA AQUI)
├── .compozy/tasks/        # PRD, TechSpec, tasks por feature
├── schema_full.sql        # schema base PG
├── migration_002..009.sql # auth, cadastros, sync, perfil/enrichment, import de-para, forma/cbo
├── parse_esus_csv.py      # ETL e-SUS
├── consolidate_dashboard.py
├── sync_cadastros_mysql.py
├── .env                   # dev local (host)
├── .env.docker            # Docker Compose
└── package.json           # scripts raiz
```

Documentação de produto legada: `prd-simpa.md`, `estrutura_simpa.md`, `readme.md`.

---

## Módulos funcionais → onde implementar

| Módulo UI | Rota frontend | API / serviço | Doc detalhada |
|-----------|---------------|---------------|---------------|
| Login | `/login` | `POST /auth/login` | [auth-roles.md](docs/agent/auth-roles.md) |
| Painel | `/` | `GET /planejamento` + `GET /painel-layout` | [frontend.md](docs/agent/frontend.md#painel) |
| Indicadores do Painel | `/cadastros/indicadores-painel` | `/api/cadastros/painel-*` | [cadastros.md](docs/agent/cadastros.md#workflow-painel-widgets-dinamicos) |
| Cadastros | `/cadastros/*` | `/api/cadastros/*` | [cadastros.md](docs/agent/cadastros.md) |
| Importação | `/importacao` | `/api/importacao/*` | [backend-api.md](docs/agent/backend-api.md#importação) |
| Sync produção SIA | `/cadastros` (banner) | `/api/sia/sincronizar`, `/api/sia/sincronizacoes*`, `/api/sia/producao` | [backend-api.md](docs/agent/backend-api.md#sia) |
| Metas | `/metas` | dashboard + `metas_financiamento` | [frontend.md](docs/agent/frontend.md) |
| Indicadores | `/indicadores` | contrato `indicadores_qualidade` | [frontend.md](docs/agent/frontend.md) |
| Relatórios | `/relatorios` | (placeholder UI) | [frontend.md](docs/agent/frontend.md) |
| Vacinas | `/vacinas` | `/api/vacina/*` | [vacinas.md](docs/agent/vacinas.md) |
| Administração | `/admin/*` | `/api/admin/*` | [auth-roles.md](docs/agent/auth-roles.md#admin) |

Navegação: `simpa-frontend/src/config/navigation.ts` · Rotas: `simpa-frontend/src/App.tsx`.

---

## API — pontos de entrada

Montagem em `simpa-backend/src/app.js`:

| Prefixo | Auth | Router |
|---------|------|--------|
| `/auth` | público (login) | `routes/auth.js` |
| `/api/health` | público | `routes/health.js` |
| `/api/config` | público | `routes/config.js` |
| `/api/*` | JWT (`verifyJWT`) | `routes/api.js` |

Sub-rotas em `routes/api.js`: `/v1/dashboard`, `/importacao`, `/sia`, `/sih`, `/cadastros`, `/admin`.

Mapa completo de endpoints: **[docs/agent/backend-api.md](docs/agent/backend-api.md)**.

---

## Ambientes e portas

| Modo | Web | API | Postgres | Env |
|------|-----|-----|----------|-----|
| Dev manual | `:5173` (Vite) | `:3001` | `:5433` (host) | `.env` |
| Docker | `:8080` (nginx) | proxy `/api` | `:5433` publish | `.env.docker` |

Detalhes e refresh: **[docs/agent/docker-env.md](docs/agent/docker-env.md)**.  
Release (build local → destino sem `--build`, `--migrate`, restore): **[docs/agent/restore-backup-e-release-docker.md](docs/agent/restore-backup-e-release-docker.md)**.

---

## Banco de dados

- Init Docker: `schema_full.sql` + `migration_002` … `036` em `docker-compose.yml`.
- Volume já existente / destino: `scripts/apply-migrations.*` + tabela `simpa_schema_migrations`.
- Tabelas-chave: `estabelecimentos`, `procedimentos`, `formas_sia`, `cbos_sia`, `enriquecimento_*`, `esus_cargas`, `dados_consolidados`, `usuarios`.
- Contrato dashboard lido de `dados_consolidados.dados_conteudo` (JSONB).

Schema e migrations: **[docs/agent/database.md](docs/agent/database.md)**.

---

## ETL Python

Scripts na raiz, invocados pela API (`parser.js`, `consolidator.js`, `cadastrosSync.js`) ou CLI.

| Script | Função |
|--------|--------|
| `parse_esus_csv.py` | CSV e-SUS → `esus_cargas` / raw |
| `consolidate_dashboard.py` | raw → `dados_consolidados` |
| `sync_sia_mysql.py` | SIA MySQL → PG |
| `sync_cadastros_mysql.py` | prestador/procedimento/forma/cbo → estabelecimentos, procedimentos, formas_sia, cbos_sia |
| `sync_sih_mysql.py` | `s_aih` + `s_aih_pa` MySQL → `sih_internacoes`, `sih_procedimentos` PG |

Detalhes: **[docs/agent/etl-python.md](docs/agent/etl-python.md)**.

---

## Frontend — estrutura rápida

```
simpa-frontend/src/
├── api/           # client HTTP (apiFetch, cadastros, dashboard)
├── pages/         # uma pasta por módulo (Painel, Cadastros, …)
├── components/    # layout, painel, cadastros, shared
├── hooks/         # useFilters, useDashboard, useImportBadge
├── contexts/      # AuthContext
├── types/         # contrato.ts, cadastros.ts, painel.ts
└── utils/         # dashboardView, enrichmentView, enrichmentByPerfil, kpi
```

Proxy Vite dev: `/api` e `/auth` → `localhost:3001` (`vite.config.ts`).

Detalhes por página e hooks: **[docs/agent/frontend.md](docs/agent/frontend.md)**.

---

## Backend — estrutura rápida

```
simpa-backend/src/
├── app.js
├── middleware/    # verifyJWT, requirePlanningStaff, requireAdmin, …
├── routes/        # thin handlers
└── services/      # lógica de negócio + SQL
```

Padrão: rotas finas → `services/*.js` → `services/db.js` (`query`).

Cadastros especiais: `estabelecimentosService.js`, `procedimentosService.js` (não usam `cadastroRegistry` genérico para PUT de identidade).

---

## Testes e CI

```powershell
npm test              # Jest + Vitest
npm run test:py       # pytest unit (python -m pytest se pytest não estiver no PATH)
npm run test:e2e      # Playwright (stack :8080 + seed:e2e)
npm run seed:e2e      # reativa E2E001–004 após sync
npm run docker:smoke  # compose health
npm run ci            # pipeline completo (bash)
```

Detalhes: **[docs/agent/testing-ci.md](docs/agent/testing-ci.md)**.

---

## Compozy (spec-driven)

Arquivados em `.compozy/tasks/_archived/`:

| Slug | Estado | Conteúdo |
|------|--------|----------|
| `importacao-depara-unidade-equipe` | **arquivado ✅** | De-para e-SUS, preview gate, Painel por IDs |
| `estabelecimentos-perfil-painel` | **arquivado ✅** | Perfil editável, enriquecimento por perfil, Painel multi-perfil |
| `cadastros-forma-cbo-sia-sih` | **arquivado ✅** | Forma/CBO MySQL → PG, Cadastros read-only, enriquecimento SIA |
| `painel-widgets-dinamicos` | **arquivado ✅** | Widgets/métricas governadas, Layout A dinâmico, cadastro Indicadores do Painel |
| `importacao-cadastro-individual` | **arquivado ✅** | Cadastro individual CSV, `populacao_cadastrada`, denominadores, `/painel/populacao` |

Guia: **[docs/agent/compozy.md](docs/agent/compozy.md)**.

---

## Features concluídas (arquivo)

| Feature | Entregue (resumo) | Refs |
|---------|-------------------|------|
| `frontend-manutenibilidade` | `useEntityCrud`; lazy routes; `cadastroEntities` registry | [frontend.md](docs/agent/frontend.md#patterns) |
| `importacao-depara-unidade-equipe` | `esus_import_mapeamentos`; preview gate; FKs cargas/consolidado | [cadastros.md](docs/agent/cadastros.md#workflow-importacao-depara) |
| `estabelecimentos-perfil-painel` | `perfil` editável; 5 tabelas enriquecimento; seletor perfil Painel | [cadastros.md](docs/agent/cadastros.md#workflow-estabelecimentos-perfil-painel) |
| `cadastros-forma-cbo-sia-sih` | `formas_sia`/`cbos_sia`; enriquecimento forma/cbo SIA | [cadastros.md](docs/agent/cadastros.md#workflow-forma-cbo-sia-sih) |
| `painel-widgets-dinamicos` | `migration_008`; `painelWidgetsService`; Layout A dinâmico | [cadastros.md](docs/agent/cadastros.md#workflow-painel-widgets-dinamicos) |
| `importacao-cadastro-individual` | `migration_012`; `populacao_cadastrada`; denominadores | [etl-python.md](docs/agent/etl-python.md) |
| `importacao-sihd-hospitalar` | `migration_013`; `sync_sih_mysql.py`; `sihProducaoService` | [backend-api.md](docs/agent/backend-api.md#sihd) |

---

## Feature concluída: leitos-hospitalares-vigencia

**Entregue:** leitos hospitalares versionados por vigência (`migration_026`); `leitosVigenciaService.js`/`LeitosVigenciasPanel.tsx`; rotas `GET/POST/PUT/DELETE /estabelecimentos/:id/leitos-vigencias`; espelho em `enriquecimento_hospitalar/misto.leitos`.

Resumo: **[cadastros.md](docs/agent/cadastros.md#workflow-leitos-hospitalares-vigencia)** · API: **[backend-api.md](docs/agent/backend-api.md)** · DB: **[database.md](docs/agent/database.md)**.

---

## Feature concluída: vacinas-cobertura

**Entregue:** `migration_036_vacinas.sql` (7 tabelas); `parse_vacina_xlsx.py` (parser xlsx NIES — aba Export, rodapé, filtro Americana, competência do rodapé ou nome do arquivo); `vacinaImportService.js` + `vacinaService.js` + `vacinaCadastroService.js` + `routes/vacina.js`; `VacinaImportSection.tsx` em `/importacao`; página `/vacinas` com `CoberturaMatrix` (heatmap) e export CSV; 4 páginas de cadastro `/cadastros/vacina-{grupos,faixa-grupo,populacao,esquema}`; Jest + Vitest + pytest. Fórmula: doses acumuladas jan→mês / (pop_alvo × num_doses_esquema); sem widget no Painel v1.

**Migration:** `migration_036_vacinas.sql` · Doc: **[vacinas.md](docs/agent/vacinas.md)** · API: **[backend-api.md](docs/agent/backend-api.md#vacinas)** · DB: **[database.md](docs/agent/database.md)**.

---

## Feature concluída: painel-periodo-foco-hospitalar

**Entregue:** seleção de período (mês/trimestre/quadrimestre/ano); `periodo.js`; `migration_031` `agregacao_periodo`; `resolveMetricValueForWidget`; `PeriodoSelect`; Layout B (Foco) dinâmico para não-APS.

**Commit:** `df63168` · Manual: **[manual-editar-widget-painel.md](docs/agent/manual-editar-widget-painel.md)** · DB: **[database.md](docs/agent/database.md)**.

---

## Convenções para agentes

### Faça

- Leia `docs/agent/` do módulo que vai tocar antes de editar.
- Siga padrões existentes: `services/` no backend, `api/` + `pages/` no frontend.
- Dev local: `.env` · Docker: `.env.docker` + `--env-file .env.docker`.
- Testes obrigatórios na mesma task (Jest/Vitest/pytest conforme camada).
- Commits só quando o usuário pedir.

### Evite

- Criar estabelecimentos que não existem no MySQL (espelho read-only).
- Escrever em `estabelecimentos.enriquecimento` JSONB após migration 005 (usar tabelas normalizadas).
- Assumir porta `80` no host Windows (Apache/XAMPP conflita — usar `8080`).
- Duplicar lógica de perfil: usar `estabelecimentos.perfil` como fonte para filtros e Painel.

### Onde buscar comportamento atual

| Pergunta | Arquivo |
|----------|---------|
| Como lista estabelecimentos? | `estabelecimentosService.js` → `listEstabelecimentos` |
| Como Painel carrega dashboard? | `useDashboard.ts` → `fetchDashboard(competencia, { estabelecimentoId, equipeId })` |
| Como Painel lista unidades? | `useDashboard.ts` → `fetchEstabelecimentos(buildEstabelecimentosPerfilQuery(painelPerfil))` |
| Como importação resolve de-para? | `importMappingService.js` + `routes/importacao.js` |
| Como deriva perfil no sync? | `sync_cadastros_mysql.py` → `derive_perfil` |
| Como enriquece forma/cbo no SIA? | `siaProducaoService.js` + `cadastroReferenciaService.js` |
| Como Layout A carrega widgets dinâmicos? | `usePainelLayout.ts` → `fetchPainelLayout` · fallback `dashboardView.ts` |
| Como Layout B (Foco) exibe todos os widgets? | `LayoutB.tsx` `FocoDynamic` (auto-fit) · `catalogView.ts` Hospitalar B = ready |
| Como seleciona período (trimestre/quadri/ano)? | `PeriodoSelect.tsx` + `useFilters.periodo` · resolve em `services/periodo.js` |
| Como widget agrega período? | `painel_widgets.agregacao_periodo` · `resolveMetricValueForWidget` · placeholders `:competencia_inicio/:fim` em `bindTemplate` |
| Como cadastro de widgets do Painel? | `IndicadoresPainelPage.tsx` · `painelWidgetsService.js` |
| Extensão SIH forma/cbo? | `cadastroReferenciaService.js` → `resolveFormaDescricao` / `resolveCboDescricao` |
| De-para procedimento e-SUS→SIGTAP? | `cadastroRegistry.js` (`procedimentos_esus_sigtap`) + tabela homônima (migration 022) · UI `/cadastros/procedimentos-sigtap` |
| Exportar cadastro CRUD em CSV? | botão ⤓ em `CadastroCrudPage` → `utils/csv.ts` `downloadCsv` (client-side, todas as linhas ativas) · [cadastros.md](docs/agent/cadastros.md#exportar-csv) |
| Exportar produção e-SUS casada com de-para SIGTAP? | `producaoSigtapService.js` + `GET /api/cadastros/procedimentos-sigtap/producao?competencia=` · UI `ProducaoSigtapExport.tsx` · [cadastros.md](docs/agent/cadastros.md) |
| Enriquecimento por perfil? | `PUT …/enriquecimento/:slug` + tabelas `enriquecimento_*` |
| Como cadastra leitos por vigência? | `leitosVigenciaService.js` / `LeitosVigenciasPanel.tsx` |
| Como calcula cobertura vacinal? | `vacinaService.js` `getCobertura` / `computeCobertura` |
| Como importa doses do NIES? | `vacinaImportService.js` + `parse_vacina_xlsx.py` |
| Gate manter/aplicar do sync de cadastros? | `cadastrosSync.js` `planejarSync`/`aplicarPlano` · UI `SyncPlanoPreview.tsx` · [cadastros.md](docs/agent/cadastros.md#workflow-sync-plano-gate) |
| Deploy release sem build no destino? | `npm run docker:release:export` → `deploy-release.sh --recreate --migrate` · [restore-backup-e-release-docker.md](docs/agent/restore-backup-e-release-docker.md) |
| Contrato dashboard tipos | `simpa-frontend/src/types/contrato.ts` |
| Roles de usuário | `requirePlanningStaff.js`, `admin.js` |

---

## Índice completo `docs/agent/`

| Arquivo | Conteúdo |
|---------|----------|
| [README.md](docs/agent/README.md) | Índice e como usar |
| [backend-api.md](docs/agent/backend-api.md) | Endpoints, services, middleware |
| [frontend.md](docs/agent/frontend.md) | Páginas, hooks, componentes |
| [cadastros.md](docs/agent/cadastros.md) | Estabelecimentos, procedimentos, formas/cbo, sync, SIA/SIH |
| [database.md](docs/agent/database.md) | Tabelas, migrations, FKs |
| [etl-python.md](docs/agent/etl-python.md) | Scripts ETL e fluxo de dados |
| [docker-env.md](docs/agent/docker-env.md) | Compose, env, release export |
| [restore-backup-e-release-docker.md](docs/agent/restore-backup-e-release-docker.md) | Restore `.sql`, baseline/migrate, deploy sem build |
| [auth-roles.md](docs/agent/auth-roles.md) | JWT, perfis, auditoria |
| [testing-ci.md](docs/agent/testing-ci.md) | Testes e pipeline |
| [compozy.md](docs/agent/compozy.md) | PRD → TechSpec → tasks |
| [vacinas.md](docs/agent/vacinas.md) | Cobertura vacinal NIES: import xlsx, fórmula, endpoints, frontend |

---

*Última atualização: 2026-09-07 · Manter CLAUDE.md ≤300 linhas; detalhes novos vão em `docs/agent/`.*
