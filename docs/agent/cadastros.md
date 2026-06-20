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

## Fonte de verdade

- **Identidade** (código, nome, tipouni, status): MySQL via `sync_cadastros_mysql.py`.
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
| POST | `/api/cadastros/sincronizar` | JWT + `requirePlanningStaff` |
| GET | `/api/cadastros/sincronizacoes` | JWT |

Roles de edição: Administrador, Gestor Secretaria, Planejamento.

### Sync (`sync_cadastros_mysql.py`)

- UPSERT estabelecimentos/procedimentos; inativa ausentes no snapshot MySQL.
- **Snapshot vazio:** não inativa em massa (guarda contra falha MySQL).
- `perfil`: `CASE WHEN perfil_editado THEN atual ELSE derivado END`.
- Linhas de enriquecimento antigas **permanecem** ao trocar perfil (TechSpec).

## Frontend

| Arquivo | Comportamento |
|---------|---------------|
| `EstabelecimentosPage.tsx` | tabela, chips perfil (incl. Misto) |
| `EstabelecimentoDetailDrawer.tsx` | perfil editável; enriquecimento por `perfilDraft` |
| `EnrichmentFormByPerfil.tsx` | forms APS/MAC/Hospitalar/Misto/Outro |
| `api/cadastros.ts` | `updatePerfil`, `updateEnrichmentBySlug`, `fetchEstabelecimentos` |
| `utils/enrichmentByPerfil.ts` | slug, payloads, títulos por perfil |
| `utils/enrichmentView.ts` | `canViewEnrichment`, `canEditEnrichment` |

`useDashboard.ts` lista unidades via `fetchEstabelecimentos({ perfil: painelPerfil })` — ver [frontend.md](frontend.md#painel).

**De-para importação:** rótulos e-SUS (unidade/equipe) mapeiam para `estabelecimentos.id` já sincronizados do MySQL — o operador escolhe entre sugestões do cadastro; não cria estabelecimento novo. Equipes ausentes podem ser auto-criadas em `equipes` durante o upload (`importMappingService.ensureEquipe`).

---

## Workflow: importacao-depara-unidade-equipe {#workflow-importacao-depara}

Spec: `.compozy/tasks/importacao-depara-unidade-equipe/` · **Status: concluído (tasks 01–10)**

Resumo: migration 006 + registry `esus_import_mapeamentos` + preview gate na UI + Painel consulta dashboard por `estabelecimento_id`/`equipe_id`. Detalhe de endpoints: [backend-api.md](backend-api.md) · UI: [frontend.md](frontend.md#importacao).

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
