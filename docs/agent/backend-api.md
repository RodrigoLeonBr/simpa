# Backend API — SIMPA

Express em `simpa-backend/src/`. Entry: `app.js` → `server.js`.

## Montagem de rotas (`app.js`)

```
/auth/*              → routes/auth.js (sem JWT)
/api/health          → routes/health.js
/api/config          → routes/config.js
/api/*               → verifyJWT → routes/api.js
```

## `routes/api.js`

| Mount | Router | Auth extra |
|-------|--------|------------|
| `/v1/dashboard` | `dashboard.js` | — |
| `/importacao` | `importacao.js` | — |
| `/sia` | `sia.js` | — |
| `/cadastros` | `cadastros.js` | — |
| `/admin` | `admin.js` | `requireAdmin` / `requireAdminOrPlanning` |

## Endpoints principais

### Auth (`routes/auth.js`)

| Método | Path | Service |
|--------|------|---------|
| POST | `/auth/login` | `authService.authenticate` |
| GET | `/auth/me` | JWT payload |

### Dashboard (`routes/dashboard.js`)

| Método | Path | Service |
|--------|------|---------|
| GET | `/api/v1/dashboard/planejamento` | `dashboardService.fetchDashboard` |
| GET | `/api/v1/dashboard/painel-layout` | `painelWidgetsService.resolvePainelLayout` |
| POST | `/api/v1/dashboard/consolidar` | `consolidator.runConsolidation` |

Query GET `planejamento`:

| Param | Obrigatório | Notas |
|-------|-------------|-------|
| `competencia` | sim | `YYYY-MM` |
| `estabelecimento_id` | par | Com `equipe_id` — consulta `dados_consolidados` por FK (MVP pós de-para) |
| `equipe_id` | par | Deve vir junto com `estabelecimento_id` |
| `unidade`, `equipe` | legado | Fallback por texto para linhas sem FK |

404 quando não há linha consolidada para os filtros. Consolidar POST: `all=true` ou trio texto `competencia` + `unidade` + `equipe`.

Query GET `painel-layout`:

| Param | Obrigatório | Notas |
|-------|-------------|-------|
| `competencia` | sim | `YYYY-MM` |
| `perfil` | não | default `APS` |
| `layout` | não | default `A` |
| `estabelecimento_id` | não | inteiro |
| `equipe_id` | não | inteiro |

### Importação (`routes/importacao.js`)

| Método | Path | Auth | Notas |
|--------|------|------|-------|
| POST | `/api/importacao/preview` | JWT | multer `files[]`; preview enriquecido (`mapeamento_status`, sugestões) |
| POST | `/api/importacao/upload` | JWT + `requirePlanningStaff` | multer + `resolucoes` JSON; parser/consolidator com IDs |
| GET | `/api/importacao/mapeamentos` | JWT | lista de-para (`?q=`, paginação) |
| POST | `/api/importacao/mapeamentos` | JWT + planning | criar/atualizar mapeamento |
| PUT | `/api/importacao/mapeamentos/:id` | JWT + planning | editar mapeamento |
| DELETE | `/api/importacao/mapeamentos/:id` | JWT + planning | soft-delete (`status=inativo`) |
| GET | `/api/importacao/cargas` | JWT | histórico com JOIN cadastro |
| POST | `/api/importacao/:id/reprocessar` | JWT | reprocessa carga existente |
| PUT | `/api/importacao/:id/substituir` | JWT | substitui CSV |
| DELETE | `/api/importacao/:id` | JWT | remove carga |

**Fluxo upload:** preview → cliente envia `resolucoes[]` (`arquivo`, `estabelecimento_id`, `equipe_id`, `salvar_mapeamento`, `confirmar_remocao_todas?`) → `importMappingService.resolveForUpload` → `parser.processar` + `consolidator.runConsolidation` com IDs.

Regras `"Todas"`: conflito detectado no preview; purge exige confirmação explícita.

Limite upload: `UPLOAD_MAX_BYTES` (default 50MB).

### SIA (`routes/sia.js`)

| Método | Path | Service |
|--------|------|---------|
| POST | `/api/sia/sync` | `siaSync.runSync` |
| GET | `/api/sia/status` | último sync |

### Cadastros (`routes/cadastros.js`)

| Método | Path | Auth |
|--------|------|------|
| GET | `/api/cadastros/estabelecimentos` | JWT |
| GET | `/api/cadastros/estabelecimentos/:id` | JWT |
| PUT | `/api/cadastros/estabelecimentos/:id/perfil` | JWT + `requirePlanningStaff` |
| PUT | `/api/cadastros/estabelecimentos/:id/enriquecimento/:slug` | JWT + `requirePlanningStaff` |
| PUT | `/api/cadastros/estabelecimentos/:id/enriquecimento` | JWT + `requirePlanningStaff` (legado) |
| GET/POST | procedimentos, sincronizar, … | ver **[cadastros.md](cadastros.md)** |

Detalhes de payloads e slugs: **[cadastros.md](cadastros.md)**.

### Admin (`routes/admin.js`)

Ver **[auth-roles.md](auth-roles.md#admin)**.

### Health / Config

| Método | Path |
|--------|------|
| GET | `/api/health` |
| GET | `/api/config` | feature flags, versão |

## Services (`simpa-backend/src/services/`)

| Arquivo | Responsabilidade |
|---------|------------------|
| `db.js` | Pool PG, `query(sql, params)` |
| `authService.js` | Login, bcrypt, JWT |
| `dashboardService.js` | Lê `dados_consolidados` por IDs ou texto legado |
| `importMappingService.js` | De-para, sugestões, `ensureEquipe`, regras Todas |
| `consolidator.js` | Spawn `consolidate_dashboard.py` (aceita IDs) |
| `parser.js` | Spawn `parse_esus_csv.py` (aceita IDs) |
| `storage.js` | Paths de upload em disco |
| `siaSync.js` | Spawn `sync_sia_mysql.py` |
| `cadastrosSync.js` | Spawn `sync_cadastros_mysql.py` |
| `estabelecimentosService.js` | listagem, `updatePerfil`, `upsertEnrichment` (transação) |
| `procedimentosService.js` | CRUD procedimentos |
| `cadastroRegistry.js` | Registry genérico outros cadastros |
| `auditService.js` | `audit_log` inserts |

## Middleware (`middleware/`)

| Arquivo | Uso |
|---------|-----|
| `verifyJWT.js` | Todas rotas `/api/*` |
| `requireAdmin.js` | Administração sensível |
| `requireAdminOrPlanning.js` | Audit log, alguns GET admin |
| `requirePlanningStaff.js` | Planejamento + Gestor Secretaria + Admin |

## Padrão para novo endpoint

1. Lógica em `services/<dominio>Service.js`.
2. Rota fina em `routes/<dominio>.js` — validação, status HTTP, `next(err)`.
3. Registrar em `routes/api.js` se novo mount.
4. Teste Jest em `simpa-backend/tests/`.
5. Client frontend em `simpa-frontend/src/api/`.

## Variáveis de ambiente (API)

| Var | Default | Uso |
|-----|---------|-----|
| `PORT` | 3001 | Listen |
| `PG_HOST`, `PG_PORT`, `PG_DB`, `PG_USER`, `PG_PASS` | — | Postgres |
| `JWT_SECRET` | — | Tokens |
| `PYTHON_PATH` | `python` | Spawn ETL |
| `UPLOAD_DIR` | — | Arquivos importados |

Ver também **[docker-env.md](docker-env.md)**.
