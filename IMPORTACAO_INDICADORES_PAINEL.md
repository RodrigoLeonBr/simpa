# Importar indicadores do Painel no servidor destino

Recria **todos os indicadores do Painel** (`/cadastros/indicadores-painel`) no servidor
destino, a partir do export gerado na origem.

Arquivo de dados: **`painel_indicadores_export.sql`**

## O que o script faz

1. `DELETE FROM painel_widgets;` — apaga **todos** os widgets do destino (todos os perfis/layouts).
2. Faz *upsert* (`ON CONFLICT (chave)`) das **41 métricas** referenciadas em `painel_metricas_catalogo`.
3. Recria os **41 widgets** em `painel_widgets`, resolvendo `metrica_id`/`spark_metrica_id`
   pela **chave** (o `id` SERIAL difere entre bancos, então nunca é copiado direto).

Tudo dentro de uma transação (`BEGIN … COMMIT`): se algo falhar, nada é aplicado.

> **Migration 031 primeiro.** Os widgets têm a coluna `painel_widgets.agregacao_periodo`
> (`ultimo_mes`/`soma`/`media`). Aplique `migration_031_widget_agregacao_periodo.sql` no
> destino antes deste import. Exports antigos sem a coluna caem no default `ultimo_mes`;
> para preservar `soma`/`media`, regenere o export incluindo `agregacao_periodo`.

> Não mexe no catálogo de descoberta automática do e-SUS (as ~6 mil métricas restantes
> continuam intactas — só entram as 41 usadas pelos widgets).

## Pré-requisitos

- Postgres do SIMPA rodando no Docker do destino.
- Nome do container Postgres (no padrão do compose: `simpa-postgres-1`).
  Confirme com: `docker ps --format "{{.Names}}"`
- Usuário `postgres`, banco `simpa` (ajuste se o destino usar outros).

## Rodar (uma vez)

```bash
# 1. copiar o .sql para dentro do container
docker cp painel_indicadores_export.sql simpa-postgres-1:/tmp/p.sql

# 2. aplicar (para no primeiro erro, sem aplicar nada)
docker exec simpa-postgres-1 psql -U postgres -d simpa -v ON_ERROR_STOP=1 -f /tmp/p.sql
```

PowerShell (Windows) é idêntico — mesmos comandos.

## Conferir

```bash
docker exec simpa-postgres-1 psql -U postgres -d simpa -c "SELECT count(*) FROM painel_widgets;"
```

Esperado: **41**. Depois abrir `/cadastros/indicadores-painel` e o Painel para validar.

Não precisa reiniciar a API — os widgets são lidos a cada carga do layout (`GET /painel-layout`).

## Reverter

Antes de rodar, faça backup dos widgets do destino, caso queira voltar:

```bash
docker exec simpa-postgres-1 pg_dump -U postgres -d simpa \
  --data-only --column-inserts -t painel_widgets > backup_widgets_destino.sql
```

---

## Como criar novos widgets

- **Guia campo a campo do formulário:** `manual-editar-widget-painel.md`
  (o mesmo do drawer *Novo widget* / *Editar widget* em `/cadastros/indicadores-painel`).
- **Estrutura e organização do banco:** `database.md` (tabelas `painel_widgets`,
  `painel_metricas_catalogo` e demais).

Fluxo resumido: cadastrar/editar pelo formulário do sistema é o caminho normal.
Este `.sql` serve só para **transportar em lote** os widgets de um servidor para outro.
