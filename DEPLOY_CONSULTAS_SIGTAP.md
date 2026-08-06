# Deploy — Consultas (SIA) + unificação e-SUS × SIGTAP

Guia para aplicar no **servidor destino** as alterações desta entrega:

- View base `v_esus_producao` + refactor de 3 métricas do Painel (migration 028).
- Blocos SIGTAP do e-SUS no de-para + view unificada `v_esus_producao_sigtap` + descoberta automática (migration 029 + código).
- Widgets **Consultas** e **Consultas médicas** no Painel APS (migration 030).

> **Ordem obrigatória:** aplicar **migrations antes** do deploy do backend. O código novo de exportação lê `v_esus_producao_sigtap` (criada na 029); se o código subir antes da migration, o endpoint de produção SIGTAP quebra.

---

## 1. Inventário das alterações

### Migrations (raiz do repo)

| Arquivo | O que faz | Depende de |
|---|---|---|
| `migration_028_esus_producao_view.sql` | Cria view `v_esus_producao`; refatora 3 métricas `esus_raw` para lê-la | schema base + migration 008 |
| `migration_029_esus_sigtap_blocos.sql` | Coluna `origem` em `procedimentos_esus_sigtap`; **backfill** dos blocos SIGTAP; view `v_esus_producao_sigtap` (join único) | migration 022 + **028** |
| `migration_030_widgets_consultas_aps.sql` | 2 métricas SIA + 2 widgets APS Layout A (Consultas / Consultas médicas) | migrations 008 + 010 |

### Código backend (`simpa-backend/`)

| Arquivo | Mudança |
|---|---|
| `src/services/producaoSigtapService.js` | `exportProducao` lê a view (join único, sem UNION/regexp → sem dupla contagem); nova função `discoverEsusSigtapFromBlocks()` |
| `src/routes/importacao.js` | Chama `discoverEsusSigtapFromBlocks()` (best-effort) após consolidação de cada importação |
| `tests/producaoSigtapService.test.js` | Testes atualizados (export via view + descoberta) |

### Infra

| Arquivo | Mudança |
|---|---|
| `docker-compose.yml` | 3 mounts novos em `/docker-entrypoint-initdb.d/` (28, 29, 30) — só afetam **init de volume vazio** |

---

## 2. Pré-requisitos no destino

- Stack já rodando (`postgres` container up).
- `.env.docker` presente na raiz do release (usado pelo `apply-migrations`).
- **Backup do banco** antes de começar (ver passo 3.0).
- Para os widgets de Consulta funcionarem: **SIA sincronizado** (`sia_producao` com dados). Sem SIA, os cards mostram `0` — não é erro.

---

## 3. Passo a passo

### 3.0 Backup (obrigatório)

```bash
docker compose -p simpa --env-file .env.docker exec -T postgres \
  pg_dump -U postgres -d simpa > backup_pre_consultas_$(date +%Y%m%d_%H%M).sql
```

### 3.1 Copiar os arquivos para o release

Colocar na **raiz** do pacote release (mesmo nível de `docker-compose.yml` e `scripts/`):

- `migration_028_esus_producao_view.sql`
- `migration_029_esus_sigtap_blocos.sql`
- `migration_030_widgets_consultas_aps.sql`
- `docker-compose.yml` (atualizado)
- `simpa-backend/src/services/producaoSigtapService.js`
- `simpa-backend/src/routes/importacao.js`
- `simpa-backend/tests/producaoSigtapService.test.js`

### 3.2 Aplicar as migrations

**Opção A — script do projeto (recomendado).** Aplica só as pendentes e registra em `simpa_schema_migrations`:

```bash
bash scripts/apply-migrations.sh
```

Saída esperada: aplica `028`, `029`, `030` (as anteriores já constam como aplicadas).

**Opção B — manual, uma a uma (UTF-8 safe no Windows/Docker).** Use se não tiver o script no destino:

```bash
for m in 028_esus_producao_view 029_esus_sigtap_blocos 030_widgets_consultas_aps; do
  docker cp migration_${m}.sql simpa-postgres-1:/tmp/m.sql
  docker exec simpa-postgres-1 psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/m.sql
done
```

> **Nunca** use `Get-Content ... | docker exec -i psql` no Windows PowerShell — o pipe corrompe acento (ç/ã/é vira `?`).

Todas as migrations são **idempotentes** (`CREATE OR REPLACE`, `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) — reexecutar é seguro.

### 3.3 Deploy do backend

Subir o código novo (sem `--build` se for release exportado; ver `restore-backup-e-release-docker.md`) e reiniciar a API:

```bash
docker compose -p simpa --env-file .env.docker up -d api
```

---

## 4. Verificação

### 4.1 Migrations registradas

```sql
SELECT filename FROM simpa_schema_migrations
WHERE filename LIKE 'migration_02[89]%' OR filename LIKE 'migration_030%'
ORDER BY filename;
-- esperado: 028, 029, 030
```

### 4.2 Views existem

```sql
SELECT viewname FROM pg_views
WHERE viewname IN ('v_esus_producao', 'v_esus_producao_sigtap');
-- esperado: 2 linhas
```

### 4.3 de-para com blocos descobertos

```sql
SELECT origem, count(*) FROM procedimentos_esus_sigtap GROUP BY 1;
-- esperado: curado (78) + descoberto (>0, depende do e-SUS importado)
```

### 4.4 Métricas e widgets de Consulta

```sql
SELECT chave FROM painel_metricas_catalogo
WHERE chave IN ('sia.consultas.030101','sia.consultas_medicas.030101');

SELECT ordem, slug, titulo FROM painel_widgets
WHERE perfil='APS' AND layout='A' AND slug IN ('consultas','consultas_medicas')
ORDER BY ordem;
-- esperado: 2 métricas + 2 widgets (ordem 9 e 10)
```

### 4.5 Números batem (troque a competência)

```sql
SELECT COALESCE(SUM(quantidade_apresentada),0) AS consultas
FROM sia_producao
WHERE competencia='2026-03-01'::date AND codigo_sigtap LIKE '030101%';

SELECT COALESCE(SUM(quantidade_apresentada),0) AS consultas_medicas
FROM sia_producao
WHERE competencia='2026-03-01'::date
  AND codigo_sigtap LIKE '030101%'
  AND codigo_sigtap NOT IN ('0301010030','0301010048');
-- consultas_medicas deve ser < consultas
```

### 4.6 UI

- Painel → perfil **APS** → devem aparecer os cards **Consultas** e **Consultas médicas** (ordem 9 e 10).
- Se o Layout A dinâmico já renderiza widgets do banco, aparecem sem alteração de frontend.

---

## 5. Rollback

As migrations não removem dados existentes. Reverter:

```sql
-- 030: remove widgets + métricas de consulta
DELETE FROM painel_widgets WHERE perfil='APS' AND layout='A'
  AND slug IN ('consultas','consultas_medicas');
DELETE FROM painel_metricas_catalogo
  WHERE chave IN ('sia.consultas.030101','sia.consultas_medicas.030101');

-- 029: remove só as linhas descobertas (preserva curado); dropa a view
DELETE FROM procedimentos_esus_sigtap WHERE origem='descoberto';
DROP VIEW IF EXISTS v_esus_producao_sigtap;
-- (coluna origem pode ficar; é inócua)

-- 028: dropa a view base (as 3 métricas voltam a referenciar via UPDATE manual
--      se necessário — ou restaure do backup)
DROP VIEW IF EXISTS v_esus_producao;
```

Depois remover as linhas de `simpa_schema_migrations` correspondentes e re-deploy do backend **anterior**.

> Se dropar `v_esus_producao`/`v_esus_producao_sigtap`, faça deploy do **código antigo** junto (o código novo depende delas). Rollback de banco e de código andam juntos.

Para reverter tudo de forma limpa: **restaurar o backup do passo 3.0**.

---

## 6. Notas / decisões

- **Fonte das consultas = SIA**, não e-SUS. O e-SUS não codifica consulta em SIGTAP (nem tem CBO ainda), então não distingue médico de não-médico. Isso só existe no SIA.
- **Métrica somada = `quantidade_apresentada`** (convenção "apresentado" do SIA). Para usar aprovado, trocar `quantidade_apresentada` → `quantidade` nos 2 templates da migration 030 antes de aplicar.
- **Sem grão de equipe** nos widgets de Consulta (SIA só tem `estabelecimento_id`) — respondem a competência + unidade.
- **`v_esus_producao_sigtap` cobre exames/procedimentos** (grupo `02...`), **não** consultas `0301`. As duas coisas são independentes: a view unifica produção e-SUS por SIGTAP; os widgets de consulta vêm do SIA.
- **Descoberta automática:** a partir do deploy, cada importação e-SUS atualiza o de-para com códigos SIGTAP novos (`discoverEsusSigtapFromBlocks`, best-effort — não derruba a importação se falhar).
