# Banco de dados — PostgreSQL

## Arquivos de schema

| Arquivo | Conteúdo |
|---------|----------|
| `schema_full.sql` | Schema inicial (esus, consolidado, metas) |
| `migration_002_auth.sql` | `usuarios`, JWT |
| `migration_003_*.sql` | (se existir) extensões auth |
| `migration_004_cadastros_sync.sql` | `estabelecimentos`, `procedimentos`, sync metadata |
| `migration_005_estabelecimentos_perfil_enrichment.sql` | `perfil_editado`, tabelas enriquecimento |

Docker init: `docker-compose.yml` monta `schema_full.sql` + migrations em `/docker-entrypoint-initdb.d/`.

## Tabelas por domínio

### e-SUS / consolidado

| Tabela | Uso |
|--------|-----|
| `esus_cargas` | Metadados de importação CSV |
| `esus_raw_*` | Dados brutos parseados |
| `dados_consolidados` | JSONB dashboard por competência/unidade/equipe |
| `metas_financiamento` | Metas por indicador |

### Cadastros

| Tabela | Uso |
|--------|-----|
| `estabelecimentos` | espelho MySQL; `perfil`, `perfil_editado`, `status` |
| `enriquecimento_aps` … `enriquecimento_outro` | enriquecimento manual por perfil |
| `estabelecimentos.enriquecimento` | JSONB legado (somente leitura/backfill) |
| `procedimentos` | Códigos SIGTAP |
| `cadastros_sync_log` | Histórico sync MySQL |

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

## Queries úteis

```sql
-- Última competência consolidada
SELECT competencia, unidade, equipe, updated_at
FROM dados_consolidados ORDER BY updated_at DESC LIMIT 5;

-- Estabelecimentos por perfil
SELECT perfil, COUNT(*) FROM estabelecimentos GROUP BY perfil;

-- Último sync cadastros
SELECT * FROM cadastros_sync_log ORDER BY started_at DESC LIMIT 1;
```

## MySQL (SIA / cadastros)

Read-only no XAMPP. Config em `.env` / `.env.docker`:

- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DB`, `MYSQL_USER`, `MYSQL_PASS`

Não migrar dados MySQL para PG manualmente — usar scripts Python.
