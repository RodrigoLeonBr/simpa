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
| POST | `/api/v1/dashboard/consolidar` | `consolidator.runConsolidation` |

Query: `competencia`, `unidade`, `equipe` (YYYY-MM). Consolidar: `all=true` ou trio obrigatório.

### Importação (`routes/importacao.js`)

| Método | Path | Notas |
|--------|------|-------|
| POST | `/api/importacao/preview` | multer, `parser.preview` |
| POST | `/api/importacao/processar` | `parser.processar` + storage |
| GET | `/api/importacao/cargas` | lista `esus_cargas` |
| DELETE | `/api/importacao/cargas/:id` | remove carga |

Limite upload: `UPLOAD_MAX_BYTES` (default 50MB).

### SIA (`routes/sia.js`)

| Método | Path | Service |
|--------|------|---------|
| POST | `/api/sia/sync` | `siaSync.runSync` |
| GET | `/api/sia/status` | último sync |

### Cadastros (`routes/cadastros.js`)

Ver **[cadastros.md](cadastros.md)** — endpoints de estabelecimentos e procedimentos.

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
| `dashboardService.js` | Lê `dados_consolidados`, monta resposta |
| `consolidator.js` | Spawn `consolidate_dashboard.py` |
| `parser.js` | Spawn `parse_esus_csv.py` |
| `storage.js` | Paths de upload em disco |
| `siaSync.js` | Spawn `sync_sia_mysql.py` |
| `cadastrosSync.js` | Spawn `sync_cadastros_mysql.py` |
| `estabelecimentosService.js` | CRUD listagem, enriquecimento |
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
4. Teste Jest em `simpa-backend/__tests__/`.
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
