# Indicadores de Vacina em /vacinas + denominador prorrateado — Design

**Data:** 2026-10-13
**Branch base:** `feat/painel-periodo-foco-hospitalar`
**Status:** aprovado (design) · aguardando spec review

## Problema

A página `/vacinas` hoje mostra só a matriz de cobertura (fórmula
`doses_acum(jan→mês) / (pop × num_doses)`), com denominador fixo = meta anual.
Dois pedidos:

1. **Criar indicadores** no relatório `/vacinas`, do mesmo jeito que
   `/cadastros/indicadores-painel` faz para o Painel.
2. O **denominador da meta** deve escalar com o mês selecionado, para o
   percentual refletir o ritmo esperado (meta proporcional ao período).

## Decisões (aprovadas)

- **Reusar a máquina `painel_widgets`** (não criar modelo novo). Indicadores de
  vacina = widgets de um perfil novo `'Vacinas'`.
- **Renderizar no próprio `/vacinas`** (não no Painel principal).
- **Proração linear**: `denominador = pop × num_doses × (mês/12)`.

## Arquitetura

Reuso máximo do que existe. Núcleo de widgets/métricas/period não muda.

```
/vacinas (page)
 ├── Matriz cobertura (atual)  ← proração no vacinaService
 ├── botão "Gerenciar indicadores" → /cadastros/indicadores-painel?perfil=Vacinas
 └── Seção "Indicadores"  ← fetchPainelLayout({perfil:'Vacinas',layout:'A',periodo})
                              render via <DynamicWidgetGrid> (extraído de LayoutB)
```

### Componentes e mudanças

| # | Camada | Arquivo | Mudança |
|---|--------|---------|---------|
| R1a | FE | `utils/indicadoresPainelView.ts` | Adicionar `'Vacinas'` a `PAINEL_WIDGET_PERFIS`. |
| R1b | FE | `pages/Cadastros/IndicadoresPainelPage.tsx` | Ler `?perfil=` (query param) para pré-selecionar perfil no mount. |
| R1c | FE | `pages/Vacinas/index.tsx` | Botão "Gerenciar indicadores" → link com `?perfil=Vacinas`. |
| R2a | FE | `pages/Painel/LayoutB.tsx` → novo `components/painel/DynamicWidgetGrid.tsx` | Extrair `FocoDynamic` para componente compartilhado `DynamicWidgetGrid`. LayoutB passa a consumi-lo (comportamento idêntico). |
| R2b | FE | `pages/Vacinas/index.tsx` | Nova seção "Indicadores": chama `fetchPainelLayout` direto (perfil fixo `'Vacinas'`, layout `'A'`, `periodo = '2026-'+mes`), renderiza `<DynamicWidgetGrid>`. Lista vazia / 404 → não renderiza (silencioso). |
| R3a | BE | `services/vacinaService.js` | `computeCobertura(rows, fatorPeriodo)` multiplica `denominador` por `fatorPeriodo`. `getCobertura` deriva `fatorPeriodo = mês(competenciaAte)/12`. |
| R3b | FE | `pages/Vacinas/CoberturaMatrix.tsx` + `index.tsx` legenda | Denominador já vem prorrateado do backend; adicionar nota "meta proporcional ao mês". |
| Apoio-1 | DB | `migration_047_vacina_metricas_seed.sql` | Seed idempotente + guard de métricas `vacina.*` em `painel_metricas_catalogo` (satisfaz `metrica_id` obrigatório e dá defaults sem-código). |

> **Nota (pós-implementação):** as migrations de vacina foram renumeradas para evitar colisão com números já usados (037 sia_sih, 038/039 widgets): grupos/faixa/pop = **045**, esquema PNI = **046**, métricas = **047**. Todas ligadas no `docker-compose.yml`.
| Apoio-2 | FE | `utils/painelWidgetSqlExamples.ts` | Grupo "Vacinas": exemplos de SQL (card % prorrateado, linha doses/mês, ranking por vacina) usando `:competencia_inicio/:fim`. |

### Fórmula do denominador (R3)

```
mesN         = mês de competenciaAte (1..12)
fatorPeriodo = mesN / 12
denominador  = pop_alvo × num_doses × fatorPeriodo
cobertura%   = doses_acum(jan→mesN) / denominador × 100   (null se denominador=0)
```

- Dezembro (mesN=12) → fatorPeriodo=1 → idêntico ao comportamento atual.
- Numerador continua acumulando jan→mesN (inalterado).

### Proração no SQL de widget (R3, exemplo)

Placeholders permitidos não incluem "mês", mas a proração sai de
`:competencia_fim` (liga como `YYYY-MM-01`):

```sql
SELECT COALESCE(SUM(d.doses),0)::numeric
     / NULLIF(p.populacao * e.num_doses
              * (EXTRACT(MONTH FROM :competencia_fim::date)/12.0), 0) AS valor
FROM vacina_esquema e
JOIN vacina_populacao_alvo p
  ON p.grupo_id = e.grupo_id
 AND p.ano = EXTRACT(YEAR FROM :competencia_fim::date)
JOIN vacina_faixa_grupo fg ON fg.grupo_id = e.grupo_id
LEFT JOIN vacina_doses d
  ON d.imuno_codigo = e.imuno_codigo
 AND d.faixa_nies = fg.faixa_nies
 AND d.competencia BETWEEN make_date(EXTRACT(YEAR FROM :competencia_fim::date)::int,1,1)
                       AND :competencia_fim::date
WHERE e.imuno_codigo = '42'
  AND e.grupo_id = (SELECT id FROM vacina_grupos WHERE slug='criancas-menores-1-ano')
```

`formato='percentual'` multiplica o `valor` (fração) por 100 na UI.

## Fluxo de dados

1. Usuário seleciona mês em `/vacinas` (`mes`, default `12`).
2. Matriz: `fetchCobertura({ano:2026, competencia:'2026-'+mes})` →
   `getCobertura` aplica `fatorPeriodo`.
3. Indicadores: `fetchPainelLayout({perfil:'Vacinas',layout:'A',periodo:'2026-'+mes})`
   → `resolvePainelLayout` resolve widgets (cada um com seu SQL prorrateado) →
   `<DynamicWidgetGrid>`.
4. Criação/edição: link → `/cadastros/indicadores-painel?perfil=Vacinas` (máquina atual).

## Isolamento

- `DynamicWidgetGrid`: entrada = `widgets[]` + `loading`; saída = grid. Sem
  dependência de filtros globais. Testável com widgets mock.
- `computeCobertura`: puro, ganha 1 argumento; testável sem DB.
- `/vacinas` não usa `useFilters`/`usePainelLayout` (presos ao Painel); fetch
  direto com perfil fixo.

## Testes

- `vacinaService` (backend): `computeCobertura` com `fatorPeriodo` (mês parcial,
  mês 12 = sem proração, denominador 0 → null).
- `DynamicWidgetGrid` (Vitest): cards/linha/ranking a partir de widgets mock.
- `/vacinas` (Vitest): seção Indicadores renderiza com `fetchPainelLayout`
  mockado; vazio → só matriz.
- `IndicadoresPainelPage` (Vitest): `?perfil=Vacinas` pré-seleciona.
- `migration_039`: aplicar + re-run (guard = 0 inserts).

## Fora de escopo (YAGNI)

- Trimestre/quadrimestre no seletor de `/vacinas` (cobertura é anual-acumulada).
- Tabela de meta mensal não-linear.
- Widget de vacina no Painel principal `/`.
- Editor de indicador embutido no `/vacinas` (usa o link p/ indicadores-painel).

## Riscos / notas

- Proração vira comportamento padrão da matriz (sem toggle). Jan com doses
  front-loaded pode dar % alto — é a natureza da métrica de ritmo.
- `metrica_id` é obrigatório no form; por isso o seed `migration_039` precede o
  uso do perfil Vacinas (senão o select fica vazio e só resta sql_override).
