# Restaurar backup PostgreSQL e release Docker

Guia operacional: restaurar `.sql` de outro servidor neste ambiente, aplicar migrations pendentes, gerar pacote Docker aqui e atualizar outro servidor **sem compilar no destino**.

Pré-requisitos locais:

- Pasta do projeto com `.env.docker` configurado
- Docker Compose no ar (`npm run docker:up` ou `npm run docker:dev:refresh`)
- Arquivo de backup `.sql` (ex.: `simpa-backup-2026-07-08T20-17-57-530Z.sql`)

---

## Solução: banco vazio → restaurar

### Por que limpar antes

Se o Postgres local já tem migrations mais novas que o dump (ex.: `sih_*`, `metas_oci_par`), o restore com `--clean` falha ao dropar a PK de `estabelecimentos` por causa de FKs que **não existem** no arquivo de backup.

Não use `docker compose down -v` + `up` e restaure em cima: o init recria o schema atual completo e o mesmo erro volta.

### Passos (PowerShell, raiz do projeto)

```powershell
# 1) Encerrar conexões e recriar o banco vazio
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'simpa' AND pid <> pg_backend_pid();"
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS simpa;"
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE simpa OWNER postgres;"

# 2) Copiar o .sql para o container (repita se o container foi recriado)
docker compose --env-file .env.docker cp "CAMINHO\PARA\simpa-backup-....sql" postgres:/tmp/backup.sql

# 3) Restaurar
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/backup.sql
```

Alternativa equivalente (mesmo efeito):

```powershell
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d simpa -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/backup.sql
```

Ignore dicas do tipo **Gordon / docker ai** — não resolvem esse caso.

### Ajuste de usuário/banco

Se no `.env.docker` `PG_USER` / `PG_DB` forem diferentes de `postgres` / `simpa`, troque nos comandos.

### Alternativa pela UI

Com stack no ar e login **admin**: **Administração → Backup → Restaurar de arquivo .sql**, confirme digitando `RESTAURAR`.

Limite padrão: 500 MB (`BACKUP_MAX_RESTORE_MB` no `.env.docker`). O ponto crítico continua o mesmo: **não restaurar em cima de um schema mais novo sem limpar antes**.

---

## Depois do restore: schema da origem

O schema fica **como no servidor de origem** (data do backup). O código local pode esperar tabelas/migrations posteriores.

- Só para **consultar dados** daquele backup → ok.
- Para o app **atual** funcionar em cima desses dados → aplicar as migrations que faltam (próxima seção).

Conferir tabelas:

```powershell
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d simpa -c "\dt public.*"
```

Exemplo: backup até ~migration 012 tem `populacao_cadastrada`, mas **não** tem `sih_*`, `metas_oci_par`, `procedimentos_esus_sigtap`.

---

## Aplicar migrations pendentes (013 → 024)

Na raiz `E:\xampp\htdocs\simpa` (ou pasta do clone):

```powershell
$files = @(
  "migration_013_sih_tabelas.sql",
  "migration_014_sia_painel_indicadores.sql",
  "migration_015_apac_metas_oci_par.sql",
  "migration_016_fix_painel_widgets_utf8.sql",
  "migration_017_estabelecimentos_nome_utf8.sql",
  "migration_018_estabelecimentos_status_editado.sql",
  "migration_019_widget_sql_override.sql",
  "migration_020_sih_aih.sql",
  "migration_021_fix_painel_metricas_utf8.sql",
  "migration_022_procedimentos_esus_sigtap.sql",
  "migration_023_sih_aih_campos.sql",
  "migration_024_sih_aih_widgets.sql"
)

foreach ($f in $files) {
  Write-Host "`n==> $f"
  Get-Content -Raw $f | docker compose --env-file .env.docker exec -T postgres psql -U postgres -d simpa -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FALHOU em $f — pare aqui e analise o erro."
    break
  }
}
```

| Migration | Efeito principal |
|-----------|------------------|
| 013 | `sih_sincronizacoes`, `sih_internacoes`, `sih_procedimentos` |
| 014 | métricas/widgets SIA no painel |
| 015 | `metas_oci_par` + coluna APAC em `sia_producao` |
| 016–017 | correções UTF-8 (widgets / nomes) |
| 018 | `status_editado` em estabelecimentos |
| 019 | `sql_override` em widgets |
| 020 | `sih_aih` |
| 021 | UTF-8 métricas |
| 022 | `procedimentos_esus_sigtap` |
| 023 | campos extras em `sih_aih` |
| 024 | widgets SIH AIH |

A maioria usa `IF NOT EXISTS` / `ON CONFLICT`. Se falhar, **não pule a ordem** — retome a partir do arquivo que quebrou.

### Conferir depois

```powershell
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d simpa -c "\dt public.*"
```

Devem aparecer, entre outras: `sih_sincronizacoes`, `sih_internacoes`, `sih_procedimentos`, `sih_aih`, `metas_oci_par`, `procedimentos_esus_sigtap`.

Lista esperada alinhada ao código atual (~37 tabelas), incluindo as acima + `usuarios`, `estabelecimentos`, `sia_producao`, `painel_widgets`, etc.

### Próximos passos após migrations

1. Reiniciar a API (se estava no ar durante restore/migrations):

   ```powershell
   docker compose --env-file .env.docker restart api
   ```

2. Login com usuário que veio no **backup** (não o do banco vazio antigo).
3. Smoke: http://localhost:8080/api/health e abrir Painel / Cadastros.
4. Dados **SIH**: migrations só criam schema; tabelas podem estar vazias. Sincronize em **Importação** se precisar de produção hospitalar.
5. **SIA / e-SUS**: dados do dump já devem estar em `sia_producao` / `dados_consolidados`; re-sincronize só se quiser atualizar.

Opcional — colunas críticas:

```powershell
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d simpa -c "\d sih_aih"
docker compose --env-file .env.docker exec -T postgres psql -U postgres -d simpa -c "\d estabelecimentos"
```

---

## Gerar pacote Docker neste servidor (build local)

Para máquinas de destino com pouco recurso: **compile aqui**, transfira o pacote, **suba lá sem `--build`**.

Pré-requisito: `.env.docker` configurado (o build usa o compose/`PG_PASS` do contexto).

### Comandos (PC / servidor de build)

```powershell
# Compila api + web e gera pacote em release/simpa-<versão>/
npm run docker:release:export

# Atalho Windows (se existir na raiz)
.\exportar-docker-release.bat

# Só compilar imagens, sem empacotar
npm run docker:release:build

# Versão customizada
powershell -File scripts/docker-release-export.ps1 -Version "1.2.0"
```

### Saída

| Artefato | Conteúdo |
|----------|----------|
| `release/simpa-<versão>/` | Pasta pronta para o servidor |
| `release/simpa-<versão>.zip` | Mesmo conteúdo compactado |

O pacote inclui: imagens `.tar` (`simpa-api:<versão>`, `simpa-web:<versão>`), `docker-compose.yml`, `docker-compose.deploy.yml`, SQL, scripts ETL montados como volume, e `scripts/deploy-release.sh` / `deploy-release.ps1`.

### Variável `SIMPA_VERSION`

Definida em `.env.docker` do **destino**. Deve coincidir com a tag das imagens do pacote (ex.: `2026.06.21-HHmm`).

---

## Atualizar outro servidor (sem compilar no destino)

### Requisitos no servidor remoto

- Docker Engine + Docker Compose **v2.24+** (suporte a `build: !reset null`)
- Portas livres: `WEB_PORT` (default 8080), `PG_PUBLISH_PORT` (opcional, default 5433)
- MySQL acessível se usar sync SIA (`MYSQL_HOST` — em Linux use IP do host, não `host.docker.internal`)

### Fluxo resumido

| Etapa | Onde | Ação |
|-------|------|------|
| 1 | Servidor de build | `npm run docker:release:export` |
| 2 | Rede / USB | Transferir `release/simpa-<versão>/` ou o `.zip` |
| 3 | Servidor remoto | Configurar `.env.docker` |
| 4 | Servidor remoto | `deploy-release` **sem** `--build` |

### Primeira instalação no remoto

```bash
unzip simpa-2026.06.21.zip   # use o nome real do zip
cd simpa-2026.06.21
cp .env.docker.example .env.docker
# Editar PG_PASS, JWT_SECRET, MYSQL_*, WEB_PORT
# IMPORTANTE: SIMPA_VERSION = versão do pacote (ex.: 2026.06.21-HHmm)
nano .env.docker

bash scripts/deploy-release.sh
```

Windows no servidor:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-release.ps1
```

### Atualizar release mantendo dados do Postgres

```bash
# Descompactar/substituir pasta da nova versão, ajustar SIMPA_VERSION no .env.docker
bash scripts/deploy-release.sh --recreate
```

O `--recreate` sobe as novas imagens **sem** apagar o volume do Postgres (dados preservados). Ainda assim, faça backup `.sql` antes de atualizar produção.

### Importar pacote já descompactado (teste local do pacote)

```powershell
powershell -File scripts/docker-release-import.ps1 -BundlePath release/simpa-2026.06.21-HHmm
```

Requer `.env.docker` **dentro** da pasta do pacote com `SIMPA_VERSION` correto.

### Migrations após atualizar o app no remoto

Se o pacote novo trouxer `migration_*.sql` além do schema do volume antigo:

1. Faça backup do Postgres no remoto.
2. Aplique só as migrations **faltantes**, na ordem (mesmo padrão da seção acima).
3. Reinicie o container `api`.

---

## Referências

- Compose / env / portas: [docker-env.md](docker-env.md)
- Schema e migrations: [database.md](database.md)
- Backup pela UI admin: [auth-roles.md](auth-roles.md) (seção Backup PostgreSQL)
