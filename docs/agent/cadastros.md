# Cadastros — estabelecimentos e procedimentos

## Modelo de dados (estado atual)

Tabela `estabelecimentos` (migration 004 + 005):

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | serial | PK |
| `codigo_externo` | varchar | único, espelho MySQL (`re_cunid`) |
| `nome`, `cnpj`, `tipouni`, `status`… | — | sync MySQL |
| `perfil` | varchar | APS, MAC, Hospitalar, Misto, Outro |
| `perfil_editado` | boolean | se `true`, sync **não** sobrescreve `perfil` |
| `enriquecimento` | JSONB | legado; **não usar** para writes novos |

Enriquecimento normalizado (migration 005), 1:1 com `estabelecimentos`:

| Tabela | Perfil |
|--------|--------|
| `enriquecimento_aps` | APS |
| `enriquecimento_mac` | MAC |
| `enriquecimento_hospitalar` | Hospitalar |
| `enriquecimento_misto` | Misto |
| `enriquecimento_outro` | Outro |

`procedimentos`: código SIGTAP, descrição — sync MySQL.

Tabelas de referência SIA (migration 009):

| Tabela | Chave join | Origem MySQL |
|--------|------------|--------------|
| `formas_sia` | `codigo_forma` (6 chars) | `forma` — grupo/subgrupo/forma + descrição |
| `cbos_sia` | `codigo_cbo` (6 chars) | `cbo` — código + descrição |

Colunas comuns: `descricao`, `status` (`ativo`|`inativo`), `sincronizado_em`. CBO de produção pode vir com até 8 chars (`prd_cbo`); join usa os 6 primeiros (equivale a `left(prd_cbo, 6)`). Forma deriva de `left(prd_pa, 6)` ou `left(codigo_sigtap, 6)`.

Auditoria em `cadastros_sincronizacoes`: colunas `forma_inseridos/atualizados/inativados` e `cbo_inseridos/atualizados/inativados`.

## Fonte de verdade

- **Identidade** (código, nome, tipouni, status): MySQL via `sync_cadastros_mysql.py`.
- **Forma/CBO:** MySQL tabelas `forma` e `cbo` — espelho read-only em `formas_sia`/`cbos_sia`; sem CRUD manual na API.
- **Perfil:** derivado no sync (`derive_perfil`); editável na UI → `perfil_editado = true`.
- **Enriquecimento manual:** `PUT /enriquecimento/:slug` → tabela do perfil ativo.

## Backend

### `estabelecimentosService.js`

| Função | Descrição |
|--------|-----------|
| `listEstabelecimentos(query)` | paginação, `q`, filtro `perfil`, `status` |
| `getEstabelecimentoById(id)` | detalhe + `enrichment` (JOIN nas 5 tabelas) |
| `updatePerfil(id, perfil)` | set `perfil_editado = true` |
| `upsertEnrichment(id, slug, body)` | transação `FOR UPDATE`; validação por slug |
| `updateEnriquecimento(id, body)` | legado Hospitalar/Misto → proxy para `upsertEnrichment` |

`FORBIDDEN_IDENTITY_KEYS` inclui `perfil` — perfil só via `updatePerfil`.

Validação de leitos: inteiros ≥ 0. Merge parcial de `leitos` faz deep-merge.

### `routes/cadastros.js` — endpoints

| Método | Path | Auth |
|--------|------|------|
| GET | `/api/cadastros/estabelecimentos` | JWT |
| GET | `/api/cadastros/estabelecimentos/:id` | JWT |
| PUT | `/api/cadastros/estabelecimentos/:id/perfil` | JWT + `requirePlanningStaff` |
| PUT | `/api/cadastros/estabelecimentos/:id/enriquecimento/:slug` | JWT + `requirePlanningStaff` |
| PUT | `/api/cadastros/estabelecimentos/:id/enriquecimento` | JWT + `requirePlanningStaff` (legado Hospitalar/Misto) |
| GET | `/api/cadastros/procedimentos` | JWT |
| GET | `/api/cadastros/formas` | JWT — read-only |
| GET | `/api/cadastros/cbos` | JWT — read-only |
| POST | `/api/cadastros/sincronizar` | JWT + `requirePlanningStaff` |
| GET | `/api/cadastros/sincronizacoes` | JWT |
| GET | `/api/cadastros/sincronizacoes/ultima` | JWT |

Roles de edição: Administrador, Gestor Secretaria, Planejamento.

### `formasService.js` / `cbosService.js`

| Função | Descrição |
|--------|-----------|
| `listFormas(query)` | paginação; filtros `q`, `grupo`, `subgrupo`, `status` |
| `listCbos(query)` | paginação; filtros `q`, `status` |

POST/PUT/DELETE em `/formas` e `/cbos` retornam **405** (`createReadOnlyWriteHandler`).

### Sync (`sync_cadastros_mysql.py`)

- UPSERT estabelecimentos/procedimentos/**formas**/**cbos**; inativa ausentes no snapshot MySQL.
- **Snapshot vazio:** não inativa em massa (guarda contra falha MySQL) — inclui forma/cbo.
- **Ratio mínimo:** `CADASTRO_SNAPSHOT_MIN_RATIO` (default 0.25) — snapshot pequeno demais não inativa forma/cbo.
- Normalização: forma com códigos 2/4/6 chars; CBO canônico 6 chars (`_canonical_code`).
- Payload JSON do sync e histórico API incluem blocos `{ formas: {inserted, updated, inactivated}, cbos: {...} }`.
- `perfil`: `CASE WHEN perfil_editado THEN atual ELSE derivado END`.
- Linhas de enriquecimento antigas **permanecem** ao trocar perfil (TechSpec).

Invocado por `cadastrosSync.js` → `POST /api/cadastros/sincronizar`. Detalhe ETL: [etl-python.md](etl-python.md).

## Frontend

| Arquivo | Comportamento |
|---------|---------------|
| `EstabelecimentosPage.tsx` | tabela, chips perfil (incl. Misto) |
| `FormasPage.tsx` | listagem read-only forma de organização (grupo/subgrupo/forma) |
| `CbosPage.tsx` | listagem read-only CBO |
| `EstabelecimentoDetailDrawer.tsx` | perfil editável; enriquecimento por `perfilDraft` |
| `config/cadastroEntities.ts` | cards `formas`/`cbos` em `CADASTRO_GRID_ITEMS` |
| `EnrichmentFormByPerfil.tsx` | forms APS/MAC/Hospitalar/Misto/Outro |
| `api/cadastros.ts` | `updatePerfil`, `updateEnrichmentBySlug`, `fetchEstabelecimentos` |
| `utils/enrichmentByPerfil.ts` | slug, payloads, títulos por perfil |
| `utils/enrichmentView.ts` | `canViewEnrichment`, `canEditEnrichment` |

`useDashboard.ts` lista unidades via `fetchEstabelecimentos({ perfil: painelPerfil })` — ver [frontend.md](frontend.md#painel).

**De-para importação:** rótulos e-SUS (unidade/equipe) mapeiam para `estabelecimentos.id` já sincronizados do MySQL — o operador escolhe entre sugestões do cadastro; não cria estabelecimento novo. Equipes ausentes podem ser auto-criadas em `equipes` durante o upload (`importMappingService.ensureEquipe`).

---

## Workflow: importacao-depara-unidade-equipe {#workflow-importacao-depara}

Spec: `.compozy/tasks/_archived/1781996141048-c9181226-importacao-depara-unidade-equipe/` · **Status: concluído e arquivado (tasks 01–10)**

Resumo: migration 006 + registry `esus_import_mapeamentos` + preview gate na UI + Painel consulta dashboard por `estabelecimento_id`/`equipe_id` (fallback legado por nome). Review round `reviews-001/` (8 issues resolvidos). Commit `be60db2`.

Detalhe de endpoints: [backend-api.md](backend-api.md) · UI: [frontend.md](frontend.md#importacao).

---

## Workflow: estabelecimentos-perfil-painel {#workflow-estabelecimentos-perfil-painel}

Spec: `.compozy/tasks/_archived/*-estabelecimentos-perfil-painel/` · **Status: concluído e arquivado (tasks 01–10)**

### ADRs resumidos

| ADR | Decisão |
|-----|---------|
| adr-001 | Produto: perfis APS/MAC/Hospitalar/Misto, KPIs distintos |
| adr-002 | `perfil_editado BOOLEAN`; sync não sobrescreve se true |
| adr-003 | 5 tabelas enriquecimento + `enriquecimento_outro` |
| adr-004 | `painelPerfil` em `useFilters`; dashboard API APS no MVP |

### Migration 005 ✅

Arquivo: `migration_005_estabelecimentos_perfil_enrichment.sql` (init Docker + manual).

- `perfil_editado BOOLEAN DEFAULT false`
- Tabelas `enriquecimento_*`
- Backfill JSONB legado com `ON CONFLICT DO UPDATE` (preenche vazios)

### Tasks ✅

| # | Entrega |
|---|---------|
| 01 | Migration 005 + backfill |
| 02 | Sync condicional + guard snapshot vazio |
| 03–04 | Service + rotas + audit |
| 05–06 | Types, API client, drawer + forms |
| 07 | `painelPerfil` em `useFilters` |
| 08 | FilterBar + `useDashboard` por perfil |
| 09 | `ProfileSwitcher`, placeholder, `PAINEL_KPI_CATALOGS` |
| 10 | E2E `perfil-painel.spec.ts` + seed `E2E001–004` |

Review round: `reviews-001/` (11 issues resolvidos).

---

## Workflow: forma-cbo-sia-sih {#workflow-forma-cbo-sia-sih}

Spec: `.compozy/tasks/_archived/*-cadastros-forma-cbo-sia-sih/` · **Status: concluído e arquivado (tasks 01–12)**

### Fluxo end-to-end

```
MySQL (forma, cbo)
  → sync_cadastros_mysql.py → formas_sia / cbos_sia (PG)
  → GET /api/cadastros/formas|cbos → FormasPage / CbosPage (UI)
  → GET /api/sia/producao → descricao_forma / descricao_cbo (SIA)
  → cadastroReferenciaService → extensão SIH (futuro)
```

### Uso analítico SIA (implementado)

`siaProducaoService.listProducao` agrega `sia_producao` com LEFT JOIN:

- `formas_sia` ON `codigo_forma = left(trim(codigo_sigtap), 6)` (status `ativo`)
- `cbos_sia` ON `codigo_cbo` canônico 6 chars a partir de `sp.cbo`

Campos extras na resposta: `descricao_forma`, `descricao_cbo` (null quando código ausente ou sem match).

### Contrato de extensão SIH (preparação)

Serviço compartilhado: `simpa-backend/src/services/cadastroReferenciaService.js`.

| Export | Uso |
|--------|-----|
| `resolveFormaDescricao(codigoForma)` | Lookup async em `formas_sia` após `canonicalFormaFromSigtap` (left 6) |
| `resolveCboDescricao(codigoCbo)` | Lookup async em `cbos_sia` após `canonicalCboCode` (truncate/pad 6) |
| `canonicalFormaFromSigtap(codigoSigtap)` | Normaliza código procedimento → forma |
| `canonicalCboCode(codigoCbo)` | Normaliza CBO → 6 chars |
| `SQL_CANONICAL_FORMA_EXPR` | Expressão SQL para join em queries batch (ex.: `siaProducaoService`) |
| `SQL_CANONICAL_CBO_EXPR` | Idem para CBO |

**Adoção SIH:** quando existir pipeline/consulta SIH no PG, reutilizar as mesmas funções ou expressões SQL — não duplicar lógica de truncamento/padding. Join sempre por código canônico 6 chars contra tabelas `formas_sia`/`cbos_sia`; registros `inativo` são ignorados nos lookups.

Testes: `simpa-backend/tests/cadastroReferencia.test.js`, `siaProducao.test.js`, `formasCbos.routes.test.js`.

---

## Workflow: painel-widgets-dinamicos {#workflow-painel-widgets-dinamicos}

Spec: `.compozy/tasks/painel-widgets-dinamicos/` · **Status: MVP concluído (tasks 01–18)** · Design: [superpowers spec](../superpowers/specs/2026-06-20-painel-widgets-dinamicos-design.md)

### Fluxo end-to-end

```
migration_008 (catálogo + widgets seed)
  → painelMetricsService (executeMetric, discoverMetricsFromRaw)
  → painelWidgetsService (CRUD, resolvePainelLayout, previewWidget)
  → GET /painel-layout + cadastro /painel-widgets|metricas
  → IndicadoresPainelPage (CRUD, preview, Atualizar catálogo)
  → LayoutA + usePainelLayout (fallback dashboardView se API falhar)
```

### Cadastro UI — `/cadastros/indicadores-painel`

| Ação | Quem | Detalhe |
|------|------|---------|
| Listar widgets APS/A | JWT | Tabela ordenada por `ordem` |
| Criar/editar/inativar | Planning staff | `FormDialog` + picker métricas (`fetchPainelMetricas`) |
| Pré-visualizar | Planning staff | `WidgetPreviewModal` → POST preview; SQL read-only em `<details>` |
| Atualizar catálogo | Planning staff | `discoverPainelMetricas()` → toast inserted/updated |

Grid: card `cadastro-card-indicadores-painel`. Diferente de `/indicadores` (drill-down qualidade).

### ADRs resumidos

| ADR | Decisão |
|-----|---------|
| adr-001 | Catálogo curado + templates governados; cadastro e Painel mesma prioridade |
| adr-002 | `/painel-layout` separado de `/planejamento` |
| adr-003 | Binding server-side; SQL nunca no browser |

Testes: `painelMetricsService.test.js`, `painelWidgets*.test.js`, `IndicadoresPainelPage.test.tsx`, E2E `painel-widgets.spec.ts`.
