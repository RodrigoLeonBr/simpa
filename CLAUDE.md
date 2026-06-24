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

Sub-rotas em `routes/api.js`: `/v1/dashboard`, `/importacao`, `/sia`, `/cadastros`, `/admin`.

Mapa completo de endpoints: **[docs/agent/backend-api.md](docs/agent/backend-api.md)**.

---

## Ambientes e portas

| Modo | Web | API | Postgres | Env |
|------|-----|-----|----------|-----|
| Dev manual | `:5173` (Vite) | `:3001` | `:5433` (host) | `.env` |
| Docker | `:8080` (nginx) | proxy `/api` | `:5433` publish | `.env.docker` |

Detalhes, scripts `.bat` e refresh: **[docs/agent/docker-env.md](docs/agent/docker-env.md)**.

---

## Banco de dados

- Init Docker: `schema_full.sql` + `migration_002` … `009` em `docker-compose.yml`.
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

## Feature concluída: frontend-manutenibilidade

**Entregue:** catálogo unificado read-only; `useEntityCrud`; lazy routes + `manualChunks` (index ~15 KB gzip); split enrichment/utils/drawer; registry `cadastroEntities` com `mode`; docs agent.

Spec: `.compozy/tasks/frontend-manutenibilidade/` · Resumo padrões: **[frontend.md](docs/agent/frontend.md#patterns)**.

---

## Feature concluída: importacao-depara-unidade-equipe

**Entregue:** registry `esus_import_mapeamentos`; preview gate + upload com `resolucoes`; FKs em `esus_cargas`/`dados_consolidados`; Painel por `estabelecimento_id`/`equipe_id`; review-001 resolvido.

**Commit:** `be60db2` · Spec arquivada: `.compozy/tasks/_archived/*-importacao-depara-unidade-equipe/`

Resumo: **[docs/agent/cadastros.md](docs/agent/cadastros.md#workflow-importacao-depara)** · Importação UI: **[frontend.md](docs/agent/frontend.md#importacao)** · API: **[backend-api.md](docs/agent/backend-api.md)**.

---

## Feature concluída: estabelecimentos-perfil-painel

**Entregue:** `perfil` editável (planning staff); sync preserva `perfil_editado`; 5 tabelas `enriquecimento_*`; seletor APS/MAC/Hospitalar/Misto no Painel; layouts A/B/C só no APS (demais perfis → placeholder); E2E Playwright.

**Commits principais:** `4c43959`, `8353acf`, `5e20371`.

Resumo técnico: **[docs/agent/cadastros.md](docs/agent/cadastros.md#workflow-estabelecimentos-perfil-painel)** · Painel: **[frontend.md](docs/agent/frontend.md#painel)**.

---

## Feature concluída: cadastros-forma-cbo-sia-sih

**Entregue:** espelho MySQL `forma`/`cbo` → `formas_sia`/`cbos_sia`; APIs read-only; cards e páginas Cadastros; enriquecimento `GET /api/sia/producao` com `descricao_forma`/`descricao_cbo`; contrato SIH em `cadastroReferenciaService.js`.

Spec arquivada: `.compozy/tasks/_archived/*-cadastros-forma-cbo-sia-sih/` · Resumo: **[docs/agent/cadastros.md](docs/agent/cadastros.md#workflow-forma-cbo-sia-sih)** · API: **[backend-api.md](docs/agent/backend-api.md)** · UI: **[frontend.md](docs/agent/frontend.md#cadastros)**.

---

## Feature concluída: painel-widgets-dinamicos

**Entregue:** migration 008 runtime; `painelMetricsService` + `painelWidgetsService`; `GET /painel-layout`; CRUD/preview/discovery cadastro; `IndicadoresPainelPage`; Layout A dinâmico com fallback; E2E `painel-widgets.spec.ts`.

**Commits:** `fedd158`, `73ff413` · Spec arquivada: `.compozy/tasks/_archived/*-painel-widgets-dinamicos/` · Resumo: **[cadastros.md](docs/agent/cadastros.md#workflow-painel-widgets-dinamicos)** · Design: **[superpowers spec](docs/superpowers/specs/2026-06-20-painel-widgets-dinamicos-design.md)**.

---

## Feature concluída: importacao-cadastro-individual

**Entregue:** `migration_012_populacao_cadastrada.sql`; parser `cadastro_individual` em `parse_esus_csv.py`; ETL contract `pop_row` + denominadores C1/IGM-APS/IGM-ICSAP; `populacaoService.js` + `GET /api/populacao`; `PopulacaoPage.tsx` em `/painel/populacao`; badge `cidadaos_ativos` no preview de importação; 526 JS + 171 Python testes passando.

**Commit:** `f204714` · Spec arquivada: `.compozy/tasks/_archived/*-importacao-cadastro-individual/`

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
| Como cadastro de widgets do Painel? | `IndicadoresPainelPage.tsx` · `painelWidgetsService.js` |
| Extensão SIH forma/cbo? | `cadastroReferenciaService.js` → `resolveFormaDescricao` / `resolveCboDescricao` |
| Enriquecimento por perfil? | `PUT …/enriquecimento/:slug` + tabelas `enriquecimento_*` |
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
| [docker-env.md](docs/agent/docker-env.md) | Compose, env, scripts refresh |
| [auth-roles.md](docs/agent/auth-roles.md) | JWT, perfis, auditoria |
| [testing-ci.md](docs/agent/testing-ci.md) | Testes e pipeline |
| [compozy.md](docs/agent/compozy.md) | PRD → TechSpec → tasks |

---

*Última atualização: 2026-06-21 · Manter CLAUDE.md ≤300 linhas; detalhes novos vão em `docs/agent/`.*
