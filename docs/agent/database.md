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

Docker init: `docker-compose.yml` monta `schema_full.sql` + migrations `02` … `08` em `/docker-entrypoint-initdb.d/`.

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
| `procedimentos` | Códigos SIGTAP |
| `cadastros_sync_log` | Histórico sync MySQL |

### Painel dinâmico (migration 008)

| Tabela | Uso |
|--------|-----|
| `painel_metricas_catalogo` | Métricas descobíveis (e-SUS raw, SIA, consolidado); `sql_template` parametrizado |
| `painel_widgets` | Slots do Painel por `perfil`/`layout`; FK opcional → catálogo; `sql_preview` para admin |

Seed inicial: 10 métricas + 8 widgets APS Layout A (espelha cards/gráficos atuais).

### Auth / admin

| Tabela | Uso |
|--------|-----|
| `usuarios` | login, perfil role, bcrypt |
| `audit_log` | ações administrativas |

### SIA (se aplicável)

Tabelas populadas por `sync_sia_mysql.py` — ver script e `siaSync.js`.

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
SELECT * FROM cadastros_sync_log ORDER BY started_at DESC LIMIT 1;
```

## MySQL (SIA / cadastros)

Read-only no XAMPP. Config em `.env` / `.env.docker`:

- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DB`, `MYSQL_USER`, `MYSQL_PASS`

Não migrar dados MySQL para PG manualmente — usar scripts Python.
