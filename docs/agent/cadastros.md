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

Tabelas de referência SIA (migration 009 + 011):

| Tabela | Chave join | Origem MySQL |
|--------|------------|--------------|
| `formas_sia` | `codigo_forma` (6 chars) | `forma` — grupo/subgrupo/forma + descrição |
| `cbos_sia` | `codigo_cbo` (6 chars) | `cbo` — código + descrição |
| `rubricas_sia` | `codigo_rubrica` (4 chars) | `s_rub` — `RUB_ID` + `RUB_DC` |

Colunas comuns: `descricao`, `status` (`ativo`|`inativo`), `sincronizado_em`. CBO de produção pode vir com até 8 chars (`prd_cbo`); join usa os 6 primeiros (equivale a `left(prd_cbo, 6)`). Forma deriva de `left(prd_pa, 6)` ou `left(codigo_sigtap, 6)`.

Auditoria em `cadastros_sincronizacoes`: colunas de contagem para `forma_*`, `cbo_*` e `rubrica_*`.

## Fonte de verdade

- **Identidade** (código, nome, tipouni, status): MySQL via `sync_cadastros_mysql.py`.
- **Forma/CBO/Rubrica:** MySQL tabelas `forma`, `cbo` e `s_rub` — espelho read-only em `formas_sia`/`cbos_sia`/`rubricas_sia`; sem CRUD manual na API.
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

- UPSERT estabelecimentos/procedimentos/**formas**/**cbos**/**rubricas**; inativa ausentes no snapshot MySQL.
- **Snapshot vazio:** não inativa em massa (guarda contra falha MySQL) — inclui forma/cbo/rubrica.
- **Ratio mínimo:** `CADASTRO_SNAPSHOT_MIN_RATIO` (default 0.25) — snapshot pequeno demais não inativa forma/cbo/rubrica.
- Normalização: forma (2/4/6 chars), CBO canônico 6 chars e rubrica canônica 4 chars (`_canonical_code`).
- Payload JSON do sync e histórico API incluem blocos `{ formas: {...}, cbos: {...}, rubricas: {...} }`.
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
Para reduzir ambiguidade sem quebrar clientes legados, o contrato de `GET /api/sia/producao` expõe também `grupo_idade_sia` como alias explícito de `faixa_etaria`.
Também retorna `quantidade_apresentada` e `valor_apresentado` quando disponíveis na competência importada.

### Operação de sync produção SIA (UI Cadastros)

- `SiaProducaoSyncBanner` (na grade de Cadastros, abaixo do banner de cadastros referência) dispara:
  - `POST /api/sia/sincronizar`
  - `GET /api/sia/sincronizacoes`
  - `GET /api/sia/sincronizacoes/existe`
- Gate de reimportação: se API retorna 409 (`SIA_COMPETENCIA_JA_IMPORTADA`), UI exige confirmação explícita para retry com `reimportar: true`.

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

## De-para procedimentos e-SUS → SIGTAP (migration 022)

Relatórios de produção por unidade agregam **quantidade de procedimentos por código SIGTAP**. Os relatórios analíticos e-SUS gravam em `esus_indicadores_raw` só a **descrição amigável** (`esus_indicadores_raw.descricao`) — sem código. A tabela `procedimentos_esus_sigtap` faz o de-para.

### Duas categorias de bloco

| Categoria | Onde | Como obter o código |
|-----------|------|---------------------|
| **Nome amigável** (precisa de-para) | `procedimentos_individualizados` → Procedimentos / Pequenas cirurgias, Testes rápidos, Administração de medicamentos · `atendimento_odontologico` → Procedimentos · `atendimento_domiciliar` → Procedimentos | JOIN em `procedimentos_esus_sigtap` |
| **Código inline** (não precisa de-para) | Qualquer bloco "Outros procedimentos (SIGTAP)" · `atividade_coletiva` → Práticas em saúde | 10 primeiros dígitos da própria `descricao` |

Regra do código SIGTAP: **10 primeiros dígitos** do campo, separados do nome por `-` ou espaço (`0309050022 - SESSÃO DE ACUPUNTURA…`).

### Tabela `procedimentos_esus_sigtap`

`(tipo_relatorio, bloco, descricao_esus, codigo_sigtap CHAR(10), descricao_sigtap)` · `UNIQUE(tipo_relatorio, descricao_esus)`.

Chave de join: `tipo_relatorio` (= `esus_cargas.tipo_relatorio`) + `descricao_esus` (= `esus_indicadores_raw.descricao`). `bloco` é informativo. Códigos consistentes entre relatórios (ex.: "Retirada de pontos…" = `0301100152` em individualizados/odonto/domiciliar).

### Produção por unidade + SIGTAP

```sql
-- Blocos com nome amigável (via de-para)
SELECT c.estabelecimento_id, m.codigo_sigtap, m.descricao_sigtap,
       SUM((r.valores->>'quantidade')::int) AS quantidade
FROM esus_indicadores_raw r
JOIN esus_cargas c ON c.id = r.carga_id
JOIN procedimentos_esus_sigtap m
  ON m.tipo_relatorio = c.tipo_relatorio AND m.descricao_esus = r.descricao
WHERE c.competencia = $1 AND m.status = 'ativo'
GROUP BY c.estabelecimento_id, m.codigo_sigtap, m.descricao_sigtap;

-- Blocos "Outros procedimentos (SIGTAP)": código já vem na descrição
SELECT LEFT(regexp_replace(r.descricao, '\D', '', 'g'), 10) AS codigo_sigtap,
       SUM((r.valores->>'quantidade')::int) AS quantidade
FROM esus_indicadores_raw r
JOIN esus_cargas c ON c.id = r.carga_id
WHERE r.secao ILIKE 'Outros procedimentos%'
GROUP BY 1;
```

`descricao_sigtap` reflete o texto do relatório e-SUS — alguns diferem do nome oficial SIGTAP (ex.: `0307010082` rotulado "DENTE DECÍDUO POSTERIOR"). Mantido como veio; corrigir só se virar requisito.

### Cadastro UI — `/cadastros/procedimentos-sigtap`

CRUD genérico (`mode: 'crud'`), mesmo motor de Equipes/Emendas — sem código dedicado:

| Camada | Onde |
|--------|------|
| Backend | entry `procedimentos_esus_sigtap` em `cadastroRegistry.js` → `registerResource` auto-monta GET/POST/PUT/DELETE em `/api/cadastros/procedimentos_esus_sigtap` |
| Frontend | entry em `CADASTRO_ENTITIES` + `CADASTRO_GRID_ITEMS` (`cadastroEntities.ts`) → `CadastroCrudPage` genérico |
| Soft-delete | coluna `status` (`ativo`/`inativo`); DELETE = inativa; lista filtra `status != 'inativo'` |

`tipo_relatorio` é `<select>` com enum fixo (`TIPO_RELATORIO_OPTIONS`) — evita typo que quebraria o join. `descricao_esus` livre: **precisa bater exatamente** com `esus_indicadores_raw.descricao`.

**Ceiling:** writes usam só `verifyJWT` (padrão do `registerResource`, igual Equipes/Emendas), sem `requirePlanningStaff`. Se precisar restringir a planning staff, é preciso guard por-entidade no `registerResource` — hoje não existe.

---

## Workflow: leitos-hospitalares-vigencia {#workflow-leitos-hospitalares-vigencia}

Migration: `migration_026_leitos_vigencia.sql` (tabela `enriquecimento_hospitalar_leitos_vigencia`) — ver [database.md](database.md#migration-026-aplicada). Endpoints: [backend-api.md](backend-api.md).

### Modelo de dados

Leitos hospitalares (perfis **Hospitalar** e **Misto**) deixaram de ser um campo único editável no enriquecimento e passaram a ser **versionados por vigência** (período `vigencia_inicio`/`vigencia_fim`, formato `YYYYMM`, `vigencia_fim = '999999'` = vigência aberta/sem data de término). Cada vigência tem:

- **Resumo (`leitos`):** objeto com 6 chaves fixas (`LEITOS_RESUMO_KEYS` em `leitosCatalog.js`/`leitosCatalog.ts`) — `clinico`, `cirurgico`, `obstetrico`, `pediatrico`, `uti_adulto`, `uti_neonatal`. UTI foi desdobrada em adulto/neonatal (chave legada `uti` é migrada para `uti_adulto` no backfill e em qualquer payload que ainda a envie).
- **Detalhe opcional (`leitos_detalhe`):** objeto por código do catálogo fixo CNES (`75`, `81`, `03`, `13`, `33`, `10`, `43`, `47`, `68`, `45`) — cada código mapeia para um grupo do resumo (ex.: `47` Psiquiatria → `clinico`; `75` UTI-A Tipo II → `uti_adulto`). Catálogo único, compartilhado backend (`leitosCatalog.js`) e frontend (`utils/leitosCatalog.ts`).

### Regras de negócio

- **Consistência lenient:** só valida grupos do resumo que têm ao menos um código de detalhe informado — se o detalhe cobre um grupo, a soma dos códigos daquele grupo precisa bater com o valor do resumo (`assertDetalheConsistente`, duplicado em backend e frontend para validação client-side + server-side).
- **Sem sobreposição:** vigências do mesmo estabelecimento não podem se sobrepor (`rangesOverlap` em `leitosVigenciaValidation.js`), validado em app layer no create/update (exclui a própria linha no update).
- **Espelho da vigência aberta:** `enriquecimento_hospitalar.leitos` / `enriquecimento_misto.leitos` (colunas legadas) são atualizadas automaticamente por `mirrorOpenVigenciaLeitos` a cada create/update/delete de vigência, refletindo sempre a vigência com `vigencia_fim = '999999'` (ou `{}` se não houver). O `PUT /enriquecimento/:slug` **não gerencia mais leitos** — só os demais campos do perfil.

### Backend

| Arquivo | Responsabilidade |
|---------|------------------|
| `leitosCatalog.js` | `LEITOS_RESUMO_KEYS`, `LEITOS_DETALHE_CATALOG`, `DETALHE_CODIGO_TO_GRUPO` |
| `leitosVigenciaValidation.js` | `normalizeLeitosResumo` (migra `uti`→`uti_adulto`), `rangesOverlap`, `assertDetalheConsistente`, `validateVigenciaPayload` |
| `leitosVigenciaService.js` | `listLeitosVigencias`, `createLeitosVigencia`, `updateLeitosVigencia`, `deleteLeitosVigencia`, `mirrorOpenVigenciaLeitos` (transação `BEGIN/COMMIT` por mutação) |

`estabelecimentosService.getEstabelecimentoById` agrega `leitos_vigencias` (JOIN lateral com `jsonb_agg`, ordenado por `vigencia_inicio`) no detalhe do estabelecimento.

### Frontend

| Arquivo | Comportamento |
|---------|---------------|
| `utils/leitosCatalog.ts` | Espelho TS do catálogo backend + `parseVigenciaUi`/`formatVigenciaUi` (MM/AAAA ↔ YYYYMM, `99/9999` ↔ `999999`) + `assertDetalheConsistente` (validação client-side) |
| `components/cadastros/leitos/LeitosVigenciasPanel.tsx` | Lista vigências do estabelecimento, ações Nova/Editar/Excluir (planning staff) |
| `components/cadastros/leitos/LeitosVigenciaEditor.tsx` | Form de uma vigência (datas + resumo + detalhe opcional), valida no submit antes de chamar a API |
| `components/cadastros/estabelecimento/EstabelecimentoEnrichmentPanel.tsx` | Renderiza `LeitosVigenciasPanel` acima do `EnrichmentFormByPerfil` quando `perfil` é Hospitalar/Misto |

A edição inline de leitos que existia dentro do form de enriquecimento (Hospitalar/Misto) foi **removida** — leitos só são editados via painel de vigências. Ver [frontend.md](frontend.md#cadastros).

Testes: `simpa-backend/tests/leitosVigencia*.test.js`, `simpa-frontend/src/components/cadastros/leitos/LeitosVigenciasPanel.test.tsx`.
