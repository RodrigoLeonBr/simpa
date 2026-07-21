# Banco de dados — PostgreSQL

## Arquivos de schema

| Arquivo | Conteúdo |
|---------|----------|
| `schema_full.sql` | Schema inicial (esus, consolidado, metas) |
| `migration_002_auth.sql` | `usuarios`, JWT |
| `migration_003_*.sql` | (se existir) extensões auth |
| `migration_004_cadastros_sync.sql` | `estabelecimentos`, `procedimentos`, sync metadata |
| `migration_005_estabelecimentos_perfil_enrichment.sql` | `perfil_editado`, tabelas enriquecimento |
| `migration_006_import_depara.sql` | `esus_import_mapeamentos`, FKs em `esus_cargas` / `dados_consolidados` |
| `migration_007_atendimento_domiciliar.sql` | CHECK `tipo_relatorio` inclui `atendimento_domiciliar` |
| `migration_008_painel_widgets.sql` | `painel_metricas_catalogo`, `painel_widgets` (layout dinâmico APS) |
| `migration_009_cadastros_forma_cbo.sql` | `formas_sia`, `cbos_sia`; contadores forma/cbo em `cadastros_sincronizacoes` |
| `migration_010_sia_producao.sql` | `sia_producao`, `sia_sincronizacoes` |
| `migration_011_rubricas_sia.sql` | `rubricas_sia` |
| `migration_012_populacao_cadastrada.sql` | `populacao_cadastrada` + tabelas denominadores |
| `migration_013_sih_tabelas.sql` | `sih_sincronizacoes`, `sih_internacoes`, `sih_procedimentos`; seeds widgets Hospitalar Layout A |
| `migration_020_sih_aih.sql` | `sih_aih` (grão AIH); coluna `qtd_aih` em `sih_sincronizacoes` |
| `migration_022_procedimentos_esus_sigtap.sql` | `procedimentos_esus_sigtap` — de-para descrição e-SUS → código SIGTAP (relatórios de produção) |
| `migration_023_sih_aih_campos.sql` | Campos extras em `sih_aih`: `carater_internacao`, `diag_secundario`, `cid_obito`, `dt_internacao`, `dt_saida` (DATE) |
| `migration_024_sih_aih_widgets.sql` | Métricas `sih.permanencia_media_real`/`sih.pct_obito_cid`/`sih.internacoes_por_carater` + widgets Hospitalar Layout A (ordem 9–11) |
| `migration_026_leitos_vigencia.sql` | `enriquecimento_hospitalar_leitos_vigencia` — leitos hospitalares versionados por vigência (Hospitalar/Misto) |

Docker init: `docker-compose.yml` monta `schema_full.sql` + migrations `02` … `013` em `/docker-entrypoint-initdb.d/`.

## Tabelas por domínio

### e-SUS / consolidado

| Tabela | Uso |
|--------|-----|
| `esus_cargas` | Metadados de importação CSV; FK `estabelecimento_id`, `equipe_id` (migration 006) |
| `esus_import_mapeamentos` | De-para persistente e-SUS unidade/equipe → cadastro (migration 006) |
| `esus_raw_*` | Dados brutos parseados |
| `dados_consolidados` | JSONB dashboard; FK `estabelecimento_id`, `equipe_id` + colunas texto legado |
| `metas_financiamento` | Metas por indicador |

### Cadastros

| Tabela | Uso |
|--------|-----|
| `estabelecimentos` | espelho MySQL; `perfil`, `perfil_editado`, `status` |
| `enriquecimento_aps` … `enriquecimento_outro` | enriquecimento manual por perfil |
| `estabelecimentos.enriquecimento` | JSONB legado (somente leitura/backfill) |
| `enriquecimento_hospitalar_leitos_vigencia` | leitos hospitalares por vigência (migration 026); ver seção dedicada abaixo |
| `procedimentos` | Códigos SIGTAP |
| `procedimentos_esus_sigtap` | De-para descrição amigável e-SUS → código SIGTAP (migration 022); usado em relatórios de produção por unidade |
| `formas_sia` | Forma de organização (grupo/subgrupo/forma 6 chars); espelho MySQL `forma` |
| `cbos_sia` | CBO canônico 6 chars; espelho MySQL `cbo` |
| `cadastros_sincronizacoes` | Histórico sync cadastros (incl. contadores forma/cbo) |
| `cadastros_sync_log` | Histórico sync MySQL (legado) |

### Painel dinâmico (migration 008)

| Tabela | Uso |
|--------|-----|
| `painel_metricas_catalogo` | Métricas descobíveis (e-SUS raw, SIA, consolidado); `sql_template` parametrizado |
| `painel_widgets` | Slots do Painel por `perfil`/`layout`; FK opcional → catálogo; `sql_preview` para admin |

Seed inicial: 10 métricas + 8 widgets APS Layout A (espelha cards/gráficos atuais). Runtime MVP: `painelWidgetsService.resolvePainelLayout` + cadastro CRUD — ver [cadastros.md#workflow-painel-widgets-dinamicos](cadastros.md#workflow-painel-widgets-dinamicos).

### SIHD (migration 013)

| Tabela | Uso |
|--------|-----|
| `sih_sincronizacoes` | Histórico por competência; status `ok/parcial/erro/pendente`; `UNIQUE(competencia)`; `qtd_aih` (migration 020) |
| `sih_aih` | Cabeçalho `s_aih` no grão **AIH × CNES × competência**; coluna `aih` (13 chars) para filtros analíticos (ex. `SUBSTRING(aih,5,1)`). Campos extras (mig. 023): `carater_internacao`, `diag_secundario`, `cid_obito`, `dt_internacao`/`dt_saida` (DATE) |
| `sih_internacoes` | Cabeçalho AIH agregado por `(sincronizacao_id, cnes, proc_principal, diag_principal, complexidade, financiamento, motivo_saida, sexo)` |
| `sih_procedimentos` | Itens `s_aih_pa` agregados por `(sincronizacao_id, cnes, proc_detalhado, cbo_profissional, financiamento_detalhe)` |

FK: `sih_aih`, `sih_internacoes` e `sih_procedimentos.sincronizacao_id` → `sih_sincronizacoes(id) ON DELETE CASCADE`.

**Dicionário de campos / SQL para Indicadores:** [sihd-internacao-dicionario-dados.md](sihd-internacao-dicionario-dados.md).

**FINANCIAMENTO 2-char vs RUB_ID:** `s_aih.FINANCIAMENTO` é 2 chars → mapeia direto para `rubricas_sia.RUB_ID` (2 chars). Diferente do SIA onde `PRD_RUB` tem 4 chars com `LEFT(PRD_RUB, 4)`. Não usar CAST — colunas numéricas `DIARIAS`, `DIARIAS_UTI`, `VALOR_TOTAL_AIH` são nativas `int`/`decimal`.

### Auth / admin

| Tabela | Uso |
|--------|-----|
| `usuarios` | login, perfil role, bcrypt |
| `audit_log` | ações administrativas |

### SIA / SIHD (MySQL → PG)

Tabelas SIA populadas por `sync_sia_mysql.py`; tabelas SIHD por `sync_sih_mysql.py` — ver `sih.js` e `sihProducaoService.js`.

## Conexão

| Contexto | Host | Porta |
|----------|------|-------|
| Dev host → PG Docker | `localhost` | `5433` |
| API no Compose | `postgres` | `5432` |

Pool: `simpa-backend/src/services/db.js`.

## Migrations — como adicionar

1. Criar `migration_NNN_descricao.sql` na raiz.
2. Adicionar volume em `docker-compose.yml` (initdb) **ou** rodar manualmente em DB existente.
3. Documentar em `cadastros.md` / techspec se feature Compozy.
4. Atualizar testes que mockam schema.

**Nota:** volumes Postgres persistem — alterar `PG_PASS` no `.env.docker` não reseta senha em volume antigo.

## Migration 005 (aplicada)

`migration_005_estabelecimentos_perfil_enrichment.sql`:

- `estabelecimentos.perfil_editado`
- `enriquecimento_aps`, `enriquecimento_mac`, `enriquecimento_hospitalar`, `enriquecimento_misto`, `enriquecimento_outro`
- FK `estabelecimento_id` → `estabelecimentos(id) ON DELETE CASCADE`
- Backfill JSONB → tabelas normalizadas (idempotente com `ON CONFLICT DO UPDATE`)

Montada em `docker-compose.yml` (`05-migration_005_…`). DB existente: aplicar manualmente via `psql` (ver cabeçalho do arquivo).

## Migration 006 (aplicada)

`migration_006_import_depara.sql` — ordem Docker: `06-migration_006_import_depara.sql` (após 005).

- **`esus_import_mapeamentos`:** vínculos e-SUS → `estabelecimentos` / `equipes`; índices únicos parciais (unidade-only vs equipe); soft-delete via `status=inativo`.
- **`esus_cargas`:** colunas nullable `estabelecimento_id`, `equipe_id` + FKs; `uq_esus_cargas_ids` para reimport por IDs.
- **`dados_consolidados`:** colunas nullable `estabelecimento_id`, `equipe_id` + FKs; `uq_dados_consolidados_ids` para Painel por cadastro.
- UNIQUE legado `(competencia, unidade, equipe)` mantido até backfill Phase 2.

Novas importações devem gravar FKs (app layer); linhas legadas permanecem nullable.

## Migration 009 (aplicada)

`migration_009_cadastros_forma_cbo.sql` — ordem Docker: `09-migration_009_cadastros_forma_cbo.sql`.

- **`formas_sia`:** `codigo_grupo`, `codigo_subgrupo`, `codigo_forma` (UNIQUE 6 chars), `descricao`, `status`, `sincronizado_em`.
- **`cbos_sia`:** `codigo_cbo` (UNIQUE 6 chars), `descricao`, `status`, `sincronizado_em`.
- **`cadastros_sincronizacoes`:** colunas `forma_inseridos/atualizados/inativados`, `cbo_inseridos/atualizados/inativados`.

Join analítico SIA: `left(trim(codigo_sigtap), 6)` → `formas_sia.codigo_forma`; CBO canônico 6 chars → `cbos_sia.codigo_cbo`. Detalhe: [cadastros.md#workflow-forma-cbo-sia-sih](cadastros.md#workflow-forma-cbo-sia-sih).

## Migration 026 (aplicada)

`migration_026_leitos_vigencia.sql` — ordem Docker: `26-migration_026_leitos_vigencia.sql`.

- **`enriquecimento_hospitalar_leitos_vigencia`:** `id` (PK), `estabelecimento_id` (FK → `estabelecimentos(id) ON DELETE CASCADE`), `vigencia_inicio`/`vigencia_fim` `CHAR(6)` (formato `YYYYMM`; `999999` = vigência aberta/sem fim definido), `leitos` JSONB (resumo — 6 chaves: `clinico`, `cirurgico`, `obstetrico`, `pediatrico`, `uti_adulto`, `uti_neonatal`), `leitos_detalhe` JSONB (opcional, por código CNES), `atualizado_em`.
- **Constraints:** `chk_leitos_vigencia_ym` (ambas as colunas casam `^[0-9]{6}$`); `chk_leitos_vigencia_ordem` (`vigencia_inicio <= vigencia_fim`). Não-sobreposição de vigências por estabelecimento é validada em app layer (`leitosVigenciaValidation.js`), não via constraint SQL.
- **Índice:** `idx_leitos_vigencia_estab` em `estabelecimento_id`.
- **Backfill:** cria uma vigência aberta (`000001`–`999999`) por estabelecimento a partir de `enriquecimento_hospitalar.leitos` / `enriquecimento_misto.leitos` existentes (pula estabelecimentos que já têm vigência); normaliza chave legada `uti` → `uti_adulto`.
- **Relação com colunas legadas:** `enriquecimento_hospitalar.leitos` / `enriquecimento_misto.leitos` continuam existindo e são mantidas como **espelho somente-leitura da vigência aberta** (`vigencia_fim = '999999'`), atualizado por `mirrorOpenVigenciaLeitos` a cada create/update/delete de vigência — `PUT /enriquecimento/:slug` não grava mais em `leitos` (ver [cadastros.md](cadastros.md#workflow-leitos-hospitalares-vigencia)).

## Queries úteis

```sql
-- Última competência consolidada (legado por texto)
SELECT competencia, unidade, equipe, updated_at
FROM dados_consolidados ORDER BY updated_at DESC LIMIT 5;

-- Consolidado por cadastro (Painel ID-based)
SELECT competencia, estabelecimento_id, equipe_id, atualizado_em
FROM dados_consolidados
WHERE estabelecimento_id IS NOT NULL
ORDER BY atualizado_em DESC LIMIT 5;

-- Mapeamentos e-SUS ativos
SELECT esus_unidade_label, esus_equipe_nome, estabelecimento_id, equipe_id
FROM esus_import_mapeamentos WHERE status = 'ativo' LIMIT 10;

-- Estabelecimentos por perfil
SELECT perfil, COUNT(*) FROM estabelecimentos GROUP BY perfil;

-- Último sync cadastros
SELECT * FROM cadastros_sincronizacoes ORDER BY sincronizado_em DESC LIMIT 1;

-- Formas/CBOs ativos (referência SIA)
SELECT codigo_forma, descricao FROM formas_sia WHERE status = 'ativo' LIMIT 10;
SELECT codigo_cbo, descricao FROM cbos_sia WHERE status = 'ativo' LIMIT 10;
```

## MySQL (SIA / cadastros)

Read-only no XAMPP. Config em `.env` / `.env.docker`:

- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DB`, `MYSQL_USER`, `MYSQL_PASS`

Não migrar dados MySQL para PG manualmente — usar scripts Python.
