# Painel dinâmico — widgets e catálogo de métricas

**Data:** 2026-06-20  
**Status:** Fase 1 (schema + seed) ✅ · API/UI pendente

## Decisões

| Tópico | Decisão |
|--------|---------|
| Fonte de dados | SQL em tempo real (opção B), templates parametrizados no backend |
| Seleção no cadastro | Lista flat de métricas descobertas (`painel_metricas_catalogo`) |
| SQL customizado | Campo `sql_preview` / `sql_template` visível ao admin (opção C), sem SQL livre |
| Permissão | CRUD apenas Administrador + Planejamento (`requirePlanningStaff`) |
| Escopo MVP | Perfil APS · Layout A · 6 cards + 2 gráficos (paridade com LayoutA atual) |

## Schema (migration 008)

### `painel_metricas_catalogo`

Métricas descobíveis ou seedadas manualmente.

- `chave` — identificador estável (`esus.atendimento_individual.resumo.registros.quantidade`)
- `fonte_tipo` — `esus_raw` \| `sia` \| `consolidado` \| `meta` \| `placeholder`
- `tipo_relatorio`, `secao`, `descricao_linha`, `campo_json` — endereço EAV e-SUS
- `agregacao` — `valor_unico`, `sum_turnos`, `historico`, `ranking_unidade`, …
- `sql_template` — query com placeholders `:competencia`, `:estabelecimento_id`, `:equipe_id`

Job futuro: `POST /api/cadastros/painel-metricas/descobrir` escaneia `esus_indicadores_raw` e faz UPSERT no catálogo.

### `painel_widgets`

Slots do Painel.

- `perfil`, `layout`, `ordem`, `tipo` (`card` \| `grafico_linha` \| `grafico_ranking`)
- `metrica_id` → catálogo
- `fonte_config` JSONB — fallbacks, eixos de gráfico, par de métricas (ex.: metas atingidas/total)
- `spark_metrica_id` — série para sparkline em cards
- `sql_preview` — cópia legível do template (admin)

## Seed inicial

10 métricas + 8 widgets APS Layout A espelham `buildPainelKpis()` e `LayoutA.tsx`.

Placeholders mantidos: Cobertura APS, Equipes ativas (valor `NULL`).

## Próximas fases

1. **Backend:** `painelWidgetsService.js` — list CRUD + `resolveWidgetValues(competencia, filtros)`
2. **Cadastro UI:** `/cadastros/indicadores-painel` — picker do catálogo + detalhe SQL + preview
3. **Painel:** `LayoutA` lê widgets da API em vez de `buildPainelKpis` hardcoded
4. **Descoberta:** job pós-importação popula catálogo a partir de cargas novas

## Arquivos

- `migration_008_painel_widgets.sql`
- `docker-compose.yml` (init `08-…`)
- `docs/agent/database.md`
