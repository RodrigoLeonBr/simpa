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
| `/sih` | `sih.js` | — |
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

| Método | Path | Service | Auth |
|--------|------|---------|------|
| POST | `/api/sia/sincronizar` | `sia.sincronizar` + `consolidator.runConsolidation` | JWT + `requirePlanningStaff` |
| GET | `/api/sia/sincronizar/progresso/:executionId` | `sia.getSyncProgress` | JWT + `requirePlanningStaff` |
| GET | `/api/sia/sincronizacoes/existe` | gate por competência em `sia_sincronizacoes` | JWT |
| GET | `/api/sia/sincronizacoes` | histórico em `sia_sincronizacoes` | JWT |
| GET | `/api/sia/producao` | `siaProducaoService.listProducao` | JWT |

`POST /api/sia/sincronizar` aceita body `{ competencia, reimportar?: boolean, executionId?: string }`.
Quando a competência já existe com `status IN ('ok','parcial')` e `reimportar !== true`, retorna `409`:

```json
{
  "code": "SIA_COMPETENCIA_JA_IMPORTADA",
  "competencia": "2026-05",
  "sincronizado_em": "2026-06-22T10:00:00Z",
  "registros": 8420
}
```

Query GET `producao`:

| Param | Obrigatório | Notas |
|-------|-------------|-------|
| `competencia` | não | `YYYY-MM` — filtra mês |
| `unidade` | não | ILIKE parcial |
| `codigo_sigtap` | não | match exato |
| `estabelecimento_id` | não | match exato por FK em `sia_producao.estabelecimento_id` |

Resposta agregada por procedimento/grupo-etário/sexo/cbo, com campos enriquecidos `descricao_forma` e `descricao_cbo` (join em `formas_sia` / `cbos_sia` via `cadastroReferenciaService`), além de métricas de glosa/apresentado:

- `quantidade_apresentada`
- `valor_apresentado`
- `grupo_idade_sia` (alias explícito para `faixa_etaria` no contrato SIA; `faixa_etaria` permanece por compatibilidade)

`POST /api/sia/sincronizar` retorna payload do sync Python (`registros`, `linhas_mysql_raw`, `orphan_cnes`, `estabelecimentos_resolvidos`) com `consolidacao` anexada (`runConsolidation`).

### SIHD (`routes/sih.js`)

| Método | Path | Auth | Notas |
|--------|------|------|-------|
| POST | `/api/sih/sincronizar` | JWT + `requirePlanningStaff` | Body `{ competencia, reimportar?: boolean, executionId?: string }` |
| GET | `/api/sih/sincronizar/progresso/:executionId` | JWT | Progresso em cache; 404 se expirado |
| GET | `/api/sih/sincronizacoes/existe` | JWT | `?competencia=YYYY-MM` → `{ exists, status, sincronizado_em, qtd_internacoes, qtd_procedimentos }` |
| GET | `/api/sih/sincronizacoes` | JWT | Lista `sih_sincronizacoes` desc |
| GET | `/api/sih/internacoes` | JWT | `?competencia&cnes&estabelecimento_id` — agrega `sih_internacoes` |
| GET | `/api/sih/procedimentos` | JWT | `?competencia&cnes&estabelecimento_id` — agrega `sih_procedimentos` |

`POST /api/sih/sincronizar` gate 409 quando a competência já existe com `status IN ('ok','parcial')` e `reimportar !== true`:

```json
{
  "code": "SIH_COMPETENCIA_JA_IMPORTADA",
  "competencia": "2025-01",
  "sincronizado_em": "2026-06-24T10:00:00Z",
  "qtd_internacoes": 3420,
  "qtd_procedimentos": 8710
}
```

503 quando MySQL SIHD (XAMPP) está indisponível: `{ "code": "SIH_MYSQL_UNAVAILABLE", "message": "..." }`.

Progresso via stderr do Python: linhas `SIH_PROGRESS <JSON>` com `{ stage, bloco, linhas_mysql_raw, duracao_ms }`. Acessível em `GET /progresso/:executionId`.

Services SIHD:

| Serviço | Responsabilidade |
|---------|-----------------|
| `sih.js` | Spawn `sync_sih_mysql.py --pg-write`, cache progresso, gate 409 |
| `sihProducaoService.js` | Queries `sih_internacoes` / `sih_procedimentos` com filtros opcionais |

### Cadastros (`routes/cadastros.js`)

| Método | Path | Auth |
|--------|------|------|
| GET | `/api/cadastros/estabelecimentos` | JWT |
| GET | `/api/cadastros/estabelecimentos/:id` | JWT |
| PUT | `/api/cadastros/estabelecimentos/:id/perfil` | JWT + `requirePlanningStaff` |
| PUT | `/api/cadastros/estabelecimentos/:id/enriquecimento/:slug` | JWT + `requirePlanningStaff` |
| PUT | `/api/cadastros/estabelecimentos/:id/enriquecimento` | JWT + `requirePlanningStaff` (legado) |
| GET | `/api/cadastros/estabelecimentos/:id/leitos-vigencias` | JWT |
| POST | `/api/cadastros/estabelecimentos/:id/leitos-vigencias` | JWT + `requirePlanningStaff` |
| PUT | `/api/cadastros/estabelecimentos/:id/leitos-vigencias/:vigenciaId` | JWT + `requirePlanningStaff` |
| DELETE | `/api/cadastros/estabelecimentos/:id/leitos-vigencias/:vigenciaId` | JWT + `requirePlanningStaff` |
| GET | `/api/cadastros/formas` | JWT — listagem paginada (`formasService.listFormas`) |
| GET | `/api/cadastros/cbos` | JWT — listagem paginada (`cbosService.listCbos`) |
| POST/PUT/DELETE | `/api/cadastros/formas`, `/cbos` | JWT — **405** read-only (MySQL espelho) |
| GET/POST | procedimentos, sincronizar, … | ver **[cadastros.md](cadastros.md)** |

#### Leitos hospitalares por vigência

Service: `leitosVigenciaService.js` (validação em `leitosVigenciaValidation.js`, catálogo em `leitosCatalog.js`).

| Método | Path | Auth | Corpo |
|--------|------|------|-------|
| GET | `/api/cadastros/estabelecimentos/:id/leitos-vigencias` | JWT | — → `LeitosVigencia[]` ordenado por `vigencia_inicio` |
| POST | `/api/cadastros/estabelecimentos/:id/leitos-vigencias` | JWT + `requirePlanningStaff` | `{ vigencia_inicio, vigencia_fim, leitos, leitos_detalhe? }` → 201 com a linha criada |
| PUT | `/api/cadastros/estabelecimentos/:id/leitos-vigencias/:vigenciaId` | JWT + `requirePlanningStaff` | idem POST → linha atualizada |
| DELETE | `/api/cadastros/estabelecimentos/:id/leitos-vigencias/:vigenciaId` | JWT + `requirePlanningStaff` | — → `{ ok: true }` |

- `vigencia_inicio`/`vigencia_fim`: string `YYYYMM`; `999999` em `vigencia_fim` = vigência aberta.
- `leitos`: objeto resumo com as 6 chaves de `LEITOS_RESUMO_KEYS` (`clinico`, `cirurgico`, `obstetrico`, `pediatrico`, `uti_adulto`, `uti_neonatal`), inteiros ≥ 0.
- `leitos_detalhe` (opcional): objeto por código do catálogo CNES fixo (`75`, `81`, `03`, `13`, `33`, `10`, `43`, `47`, `68`, `45`); soma por grupo deve casar com `leitos` quando o grupo tem algum código informado (consistência lenient).
- **400:** `vigencia_inicio`/`vigencia_fim` inválidos, `vigencia_inicio > vigencia_fim`, chave/código desconhecido, valor não-inteiro, inconsistência resumo×detalhe, ou sobreposição de vigência existente.
- **404:** estabelecimento inexistente (POST/PUT/DELETE) ou vigência não pertence ao estabelecimento (PUT/DELETE).
- Mutações auditam `estabelecimento_leitos_vigencia_update` (recurso `estabelecimentos`) e espelham a vigência aberta (`vigencia_fim = '999999'`) em `enriquecimento_hospitalar.leitos` / `enriquecimento_misto.leitos` conforme o `perfil` do estabelecimento.
- `GET /api/cadastros/estabelecimentos/:id` inclui `leitos_vigencias: LeitosVigencia[]` no corpo do detalhe (agregado via `estabelecimentosService.getEstabelecimentoById`).

Query GET `formas`: `q`, `grupo` (2 chars), `subgrupo` (4 chars), `status` (`ativo`|`inativo`|`all`, default `ativo`), `page`, `limit` (max 200).

Query GET `cbos`: `q`, `status`, `page`, `limit`.

Resposta paginada: `{ data: [...], pagination: { page, limit, total, pages } }`.

Detalhes de payloads, sync e slugs: **[cadastros.md](cadastros.md)**.

#### Painel widgets e métricas (`painelWidgetsCadastrosRoutes.js`, `painelMetricasCadastrosRoutes.js`)

Montados em `routes/cadastros.js`. Service: `painelWidgetsService.js`, `painelMetricsService.js`.

| Método | Path | Auth | Função |
|--------|------|------|--------|
| GET | `/api/cadastros/painel-widgets` | JWT | Lista widgets (`perfil`, `layout`, `include_inactive`) |
| GET | `/api/cadastros/painel-widgets/:id` | JWT | Detalhe + métrica join + `sql_preview` |
| POST | `/api/cadastros/painel-widgets` | JWT + planning | Criar widget |
| PUT | `/api/cadastros/painel-widgets/:id` | JWT + planning | Atualizar widget |
| PATCH | `/api/cadastros/painel-widgets/reorder` | JWT + planning | Body `{ perfil, layout, orderedIds }` |
| DELETE | `/api/cadastros/painel-widgets/:id` | JWT + planning | Soft-delete (`status=inativo`) |
| POST | `/api/cadastros/painel-widgets/preview` | JWT + planning | Body `{ widgetId \| widget, scope: { competencia, estabelecimentoId?, equipeId? } }` → valor resolvido |
| GET | `/api/cadastros/painel-metricas` | JWT | Catálogo paginado (`q`, `fonte_tipo`, `page`, `limit`) |
| GET | `/api/cadastros/painel-metricas/:id` | JWT | Detalhe + `sql_template` |
| POST | `/api/cadastros/painel-metricas/descobrir` | JWT + planning | Scan `esus_indicadores_raw` → UPSERT catálogo |

Auditoria (planning): `painel_widget_create`, `painel_widget_update`, `painel_widget_reorder`, `painel_widget_inactivate`, `painel_metricas_descobrir`.

Workflow UI: **[cadastros.md#workflow-painel-widgets-dinamicos](cadastros.md#workflow-painel-widgets-dinamicos)**.

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
| `sia.js` | Spawn `sync_sia_mysql.py` |
| `cadastrosSync.js` | Spawn `sync_cadastros_mysql.py`; histórico com blocos `formas`/`cbos` |
| `formasService.js` | `listFormas` — tabela `formas_sia` (read-only) |
| `cbosService.js` | `listCbos` — tabela `cbos_sia` (read-only) |
| `cadastroReferenciaService.js` | `resolveFormaDescricao`, `resolveCboDescricao`; expressões SQL canônicas para join |
| `siaProducaoService.js` | `listProducao` — agrega `sia_producao` + descrições forma/cbo |
| `sih.js` | Spawn `sync_sih_mysql.py`, cache progresso, gate 409 |
| `sihProducaoService.js` | `listInternacoes`, `listProcedimentos` — agrega `sih_internacoes` / `sih_procedimentos` |
| `estabelecimentosService.js` | listagem, `updatePerfil`, `upsertEnrichment` (transação) |
| `procedimentosService.js` | CRUD procedimentos |
| `cadastroRegistry.js` | Registry genérico outros cadastros |
| `painelMetricsService.js` | `bindTemplate`, `executeMetric`, `discoverMetricsFromRaw` |
| `painelWidgetsService.js` | CRUD widgets, `resolvePainelLayout`, `previewWidget` |
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
