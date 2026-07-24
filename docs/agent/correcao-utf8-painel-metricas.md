# Correção UTF-8 — acentos virando `??` no banco

## Sintoma

Em **Cadastros → Indicadores do Painel** (`/cadastros/indicadores-painel`), ao editar um widget, os selects **Métrica principal** e **Métrica sparkline (opcional)** mostram labels com `??` no lugar de acentos (ex.: `Produ????o odontol??gica`, `S??rie hist??rica`).

Os rótulos fixos da UI (“Métrica principal”, etc.) estão corretos — o problema é o **conteúdo dinâmico** vindo da API/banco.

## Causa raiz

Não é bug do frontend nem do Express. Os textos já estão **corrompidos no PostgreSQL**: bytes de caracteres acentuados foram substituídos por `?` (ASCII `0x3F`) na gravação.

### Como aconteceu

Migrations SQL com literais UTF-8 (008, 013, 014, 015, 024…) foram aplicadas no **Windows** via PowerShell com pipe, por exemplo:

```powershell
# ERRADO — corrompe UTF-8 no Windows
Get-Content -Raw migration_XXX.sql | docker exec -i <container> psql -U postgres -d simpa
```

O PowerShell relê o arquivo com encoding inadequado; acentos viram `?` **antes** de chegar ao `psql`. O Postgres grava o `?` literal.

Volumes Docker já existentes **não** reexecutam scripts de `/docker-entrypoint-initdb.d/` — só o primeiro `up` com volume vazio. Correções posteriores precisam de apply manual.

### Evidência típica

```sql
SELECT chave, label
FROM painel_metricas_catalogo
WHERE label LIKE '%??%'
LIMIT 10;
```

Hex do label corrompido contém `3f` (`?`) onde deveria haver sequências UTF-8 (ex.: `ç` = `C3 A7`).

## Escopo afetado (e não afetado)

| Onde | Afetado? | Observação |
|------|----------|------------|
| Selects de métrica em Indicadores do Painel | Sim | `painel_metricas_catalogo.label` |
| Coluna “Métrica” / títulos de widgets no cadastro | Sim | métrica + `painel_widgets` |
| Painel (`/`) — títulos de cards com acento | Sim | mesma origem em `painel_widgets` |
| Cadastros → Estabelecimentos (alguns nomes) | Sim | espelho MySQL / apply ruim |
| Cadastros → Formas SIA (`Aten??o em …`) | Sim | 5 códigos `090100`–`090500` |
| Procedimentos / CBOs | Não (caso típico) | |
| Labels hardcoded no React | Não | |

## Migrations de correção

| Arquivo | O que corrige |
|---------|----------------|
| `migration_016_fix_painel_widgets_utf8.sql` | Títulos/subtítulos em `painel_widgets` (APS / MAC / Hospitalar) |
| `migration_017_estabelecimentos_nome_utf8.sql` | Nomes corrompidos em `estabelecimentos` (+ `nome_editado`) |
| `migration_021_fix_painel_metricas_utf8.sql` | Labels/descrições e-SUS / SIA / PATE em `painel_metricas_catalogo` |
| `migration_027_fix_sih_metricas_utf8.sql` | 12 métricas `sih.*`, widgets Hospitalar da 024, 5 `formas_sia` (“Atenção…”) |

A **021 sozinha não basta**: métricas SIH ficam de fora até a **027**.

Todas são idempotentes (`UPDATE` por chave/slug/`codigo_externo`).

## Resolução — PowerShell (qualquer servidor)

**Regra:** use `docker cp` + `psql -f`. **Nunca** `Get-Content | docker exec` para esses arquivos.

```powershell
# 1) Nome do container Postgres
docker ps --format "table {{.Names}}\t{{.Status}}"
$container = "simpa-postgres-1"   # ajuste se necessário

# 2) Raiz do clone SIMPA (pasta com os .sql)
Set-Location E:\xampp\htdocs\simpa   # ajuste o caminho no outro servidor

# 3) Aplicar as 4 correções (ordem sugerida)
$files = @(
  "migration_016_fix_painel_widgets_utf8.sql",
  "migration_017_estabelecimentos_nome_utf8.sql",
  "migration_021_fix_painel_metricas_utf8.sql",
  "migration_027_fix_sih_metricas_utf8.sql"
)

foreach ($f in $files) {
  if (-not (Test-Path $f)) {
    Write-Host "ARQUIVO AUSENTE: $f — copie o arquivo para esta pasta e rode de novo."
    break
  }
  Write-Host "`n==> $f"
  docker cp $f "${container}:/tmp/$f"
  if ($LASTEXITCODE -ne 0) { Write-Host "FALHOU docker cp $f"; break }

  docker exec $container psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f "/tmp/$f"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FALHOU em $f — pare e analise o erro."
    break
  }
}
```

### Verificação

Esperado: **ruins = 0** em todas as linhas.

```powershell
docker exec $container psql -U postgres -d simpa -c @"
SELECT 'metricas' AS t, COUNT(*) FILTER (WHERE label LIKE '%??%' OR descricao LIKE '%??%') AS ruins
FROM painel_metricas_catalogo
UNION ALL
SELECT 'widgets', COUNT(*) FILTER (WHERE titulo LIKE '%??%' OR subtitulo LIKE '%??%')
FROM painel_widgets
UNION ALL
SELECT 'estab', COUNT(*) FILTER (WHERE nome LIKE '%??%')
FROM estabelecimentos
UNION ALL
SELECT 'formas', COUNT(*) FILTER (WHERE descricao LIKE '%??%')
FROM formas_sia;
"@
```

Amostra SIH:

```powershell
docker exec $container psql -U postgres -d simpa -c "
SELECT chave, label FROM painel_metricas_catalogo
WHERE chave LIKE 'sih.%' ORDER BY chave;
"
```

Exemplo correto: `Permanência média (dias)`, `Série histórica — internações mensais`.

### Conferência na UI

1. Abrir `/cadastros/indicadores-painel`
2. Editar um widget
3. Conferir opções de **Métrica principal** / **Métrica sparkline** sem `??`

## Prevenção

1. Em Windows, aplicar SQL com:

   ```powershell
   docker cp arquivo.sql "${container}:/tmp/arquivo.sql"
   docker exec $container psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/arquivo.sql
   ```

2. Em Linux/macOS, `psql -f arquivo.sql` direto no host também é seguro (arquivo lido pelo `psql` em UTF-8).

3. Volume novo: `docker-compose.yml` já monta 016, 017, 021 e 027 em `initdb` — greenfield nasce corrigido **se** o compose for o da versão atual.

4. Após restore de backup antigo, seguir [restore-backup-e-release-docker.md](restore-backup-e-release-docker.md) (bloco de migrations com `docker cp`, não pipe).

5. Re-sync de cadastros MySQL → PG pode **reintroduzir** nomes/descrições ruins se a origem MySQL já tiver `?`. A 017 marca `nome_editado = true` nos estabelecimentos corrigidos para o sync não sobrescrever; formas da 027 podem voltar a corromper em sync futuro se o MySQL estiver ruim — nesse caso corrigir a origem ou reaplicar a 027.

## Referências

- Migrations: `migration_016_*.sql`, `migration_017_*.sql`, `migration_021_*.sql`, `migration_027_*.sql`
- Schema / ordem: [database.md](database.md)
- Restore / release: [restore-backup-e-release-docker.md](restore-backup-e-release-docker.md)
- UI: `WidgetEditDrawer.tsx` → `buildSelectOptions` usa `metric.label` da API
