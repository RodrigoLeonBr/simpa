# SQL customizado por widget — Indicadores do Painel

**Data:** 2026-06-28 · **Status:** Implementado  
**Escopo:** Opção B (override por widget) + opção 2 (principal + sparkline)

## Decisões

| Tópico | Decisão |
|--------|---------|
| Onde vive o SQL editável | `painel_widgets.sql_override` e `spark_sql_override` |
| Catálogo | Referência semântica (`metrica_id` / `spark_metrica_id`); template padrão quando override null |
| Runtime | `executeSqlTemplate` se override preenchido; senão `executeMetric` |
| UI | Drawer ~1240px com editor SQL, teste (competência + estabelecimento), painel de exemplos |
| Público | Planejamento / Administrador (`requirePlanningStaff`) |
| SIH máscara AIH | Documentado em exemplos; requer futura tabela `sih_aih` no PG |

## Schema

Migration `019_widget_sql_override.sql`:

- `sql_override TEXT NULL`
- `spark_sql_override TEXT NULL`

## API

Sem novos endpoints. `PUT /painel-widgets/:id` e `POST /painel-widgets/preview` aceitam os novos campos no body `widget`.

## Frontend

- `WidgetEditDrawer.tsx` substitui `FormDialog` na edição
- `painelWidgetSqlExamples.ts` — referência SIA/SIH/placeholders
- Preload `fetchPainelMetrica` ao abrir edição (fix selects vazios)
