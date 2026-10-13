# Indicadores de Vacina em /vacinas + denominador prorrateado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar indicadores configuráveis (reuso de `painel_widgets`, perfil `Vacinas`) ao relatório `/vacinas` e fazer o percentual de cobertura usar denominador prorrateado pelo mês (`pop × esquema × mês/12`).

**Architecture:** Reuso máximo. O núcleo de widgets/métricas/período não muda. Proração da matriz é 1 argumento novo em `computeCobertura`; proração dos widgets sai no SQL via `EXTRACT(MONTH FROM :competencia_fim::date)/12.0`. Renderização no `/vacinas` reutiliza o grid dinâmico extraído de `LayoutB`. Criação de indicadores reaproveita `/cadastros/indicadores-painel` via novo perfil `Vacinas` + deep-link `?perfil=Vacinas`.

**Tech Stack:** Node/Express + `pg` (backend), React 19 + Vite + Vitest (frontend), PostgreSQL (migration), Jest (backend tests).

**Commits:** Este projeto comita só quando o usuário pede (CLAUDE.md). Trate os passos "Commit" como checkpoints — rode-os quando o usuário autorizar o commit. Use `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` ao final da mensagem.

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---------|------------------|------|
| `simpa-backend/src/services/vacinaService.js` | Proração linear no cálculo de cobertura | Modificar |
| `simpa-backend/tests/vacinaService.test.js` | Testes de proração | Modificar |
| `migration_047_vacina_metricas_seed.sql` | Seed idempotente de métricas `vacina.*` no catálogo | Criar |
| `simpa-frontend/src/utils/indicadoresPainelView.ts` | Lista de perfis (adicionar `Vacinas`) | Modificar |
| `simpa-frontend/src/utils/painelWidgetSqlExamples.ts` | Grupo de exemplos SQL "Vacinas" | Modificar |
| `simpa-frontend/src/pages/Cadastros/IndicadoresPainelPage.tsx` | Pré-selecionar perfil via `?perfil=` | Modificar |
| `simpa-frontend/src/components/painel/DynamicWidgetGrid.tsx` | Grid dinâmico reutilizável (cards/linha/ranking) | Criar |
| `simpa-frontend/src/pages/Painel/LayoutB.tsx` | Consumir `DynamicWidgetGrid` | Modificar |
| `simpa-frontend/src/pages/Vacinas/index.tsx` | Seção "Indicadores" + link + nota de proração | Modificar |
| `docs/agent/vacinas.md` | Documentar indicadores + proração | Modificar |

---

## Task 1: Proração linear na cobertura (backend)

**Files:**
- Modify: `simpa-backend/src/services/vacinaService.js`
- Test: `simpa-backend/tests/vacinaService.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final do `describe('computeCobertura', ...)` em `simpa-backend/tests/vacinaService.test.js` (antes do `});` que fecha o describe, linha ~29):

```javascript
  it('fatorPeriodo escala o denominador (março = 3/12)', () => {
    const out = computeCobertura(
      [{ imuno_codigo: '42', imuno_nome: 'Penta', grupo_id: 1, grupo_nome: '<1a', doses: 1424, pop_alvo: 2320, num_doses: 3 }],
      3 / 12,
    );
    expect(out[0].denominador).toBeCloseTo(2320 * 3 * (3 / 12)); // 1740
    expect(out[0].cobertura_pct).toBeCloseTo((1424 / 1740) * 100); // ~81.8
  });

  it('fatorPeriodo default = 1 (compatível com chamadas antigas)', () => {
    const out = computeCobertura([
      { imuno_codigo: '93', imuno_nome: 'HPV', grupo_id: 1, grupo_nome: 'Adol', doses: 200, pop_alvo: 100, num_doses: 2 },
    ]);
    expect(out[0].denominador).toBe(200);
    expect(out[0].cobertura_pct).toBeCloseTo(100);
  });

  it('fatorPeriodo = 0 → denominador 0 → cobertura null', () => {
    const out = computeCobertura(
      [{ imuno_codigo: '42', imuno_nome: 'Penta', grupo_id: 1, grupo_nome: '<1a', doses: 100, pop_alvo: 2320, num_doses: 3 }],
      0,
    );
    expect(out[0].cobertura_pct).toBeNull();
  });
```

Adicionar ao `describe('getCobertura', ...)`:

```javascript
  it('deriva fatorPeriodo do mês de competenciaAte (junho = 6/12)', async () => {
    query.mockResolvedValueOnce({
      rows: [{ imuno_codigo: '42', imuno_nome: 'Penta', grupo_id: 1, grupo_nome: '<1a', num_doses: 3, pop_alvo: 2320, doses: 1740 }],
    });
    const result = await getCobertura({ ano: 2026, competenciaAte: '2026-06-01' });
    expect(result[0].denominador).toBeCloseTo(2320 * 3 * (6 / 12)); // 3480
    expect(result[0].cobertura_pct).toBeCloseTo((1740 / 3480) * 100); // 50
  });
```

- [ ] **Step 2: Rodar e verificar que falham**

Run: `npm --prefix simpa-backend test -- tests/vacinaService.test.js`
Expected: FAIL (denominador ainda não escala; `computeCobertura` ignora 2º argumento).

- [ ] **Step 3: Implementar a proração**

Em `simpa-backend/src/services/vacinaService.js`, substituir `computeCobertura` e ajustar `getCobertura`:

```javascript
/**
 * Pure. Coerces pg strings; computes denominador (prorrateado) e cobertura_pct.
 * @param {Array} rows — {imuno_codigo, imuno_nome, grupo_id, grupo_nome, doses, pop_alvo, num_doses}
 * @param {number} fatorPeriodo — fração do ano decorrida (mês/12). Default 1 (ano cheio).
 */
function computeCobertura(rows, fatorPeriodo = 1) {
  return rows.map((r) => {
    const doses = Number(r.doses);
    const pop_alvo = Number(r.pop_alvo);
    const num_doses = Number(r.num_doses);
    const denominador = pop_alvo * num_doses * fatorPeriodo;
    const cobertura_pct = denominador > 0 ? (doses / denominador) * 100 : null;
    return { imuno_codigo: r.imuno_codigo, imuno_nome: r.imuno_nome, grupo_id: r.grupo_id, grupo_nome: r.grupo_nome, doses, pop_alvo, num_doses, denominador, cobertura_pct };
  });
}
```

Em `getCobertura`, antes do `return computeCobertura(rows);`, derivar o fator do mês de `competenciaAte` (formato `YYYY-MM-01`) e passar adiante:

```javascript
  // Meta proporcional ao período decorrido: mês/12 (dezembro → 1 = meta anual cheia).
  const mesNum = Number.parseInt(String(competenciaAte).slice(5, 7), 10);
  const fatorPeriodo = Number.isFinite(mesNum) && mesNum >= 1 && mesNum <= 12 ? mesNum / 12 : 1;
  return computeCobertura(rows, fatorPeriodo);
```

- [ ] **Step 4: Rodar e verificar que passam**

Run: `npm --prefix simpa-backend test -- tests/vacinaService.test.js`
Expected: PASS (todos, incluindo os antigos — `competenciaAte: '2026-12-01'` → fator 1).

- [ ] **Step 5: Commit (checkpoint)**

```bash
git add simpa-backend/src/services/vacinaService.js simpa-backend/tests/vacinaService.test.js
git commit -m "feat(vacinas): denominador de cobertura prorrateado pelo mês (mês/12)"
```

---

## Task 2: Seed de métricas `vacina.*` no catálogo (migration)

**Files:**
- Create: `migration_047_vacina_metricas_seed.sql`

- [ ] **Step 1: Criar a migration**

Criar `migration_047_vacina_metricas_seed.sql` na raiz:

```sql
-- =============================================================================
-- SIMPA — Migration 047: seed de métricas de vacina no catálogo do Painel
-- Depends on: migration_008_painel_widgets.sql, migration_036 + 045/046 (vacinas)
--
-- GUARD: só popula quando ainda não há métrica vacina.* (sobrevive a restore;
-- re-rode após subir backup). Join/assunção: tabelas vacina_* já existem.
-- fonte_tipo='consolidado' (CHECK do catálogo não tem 'vacina').
-- Placeholders válidos: :competencia_inicio/:fim (YYYY-MM-01). Proração de
-- cobertura % é feita por sql_override no widget (EXTRACT(MONTH ...)/12.0).
--
-- Manual:  psql -h localhost -p 5433 -U postgres -d simpa -f migration_047_vacina_metricas_seed.sql
-- Docker:  Get-Content migration_047_vacina_metricas_seed.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
-- =============================================================================

INSERT INTO painel_metricas_catalogo (chave, fonte_tipo, label, descricao, agregacao, sql_template, status, ocorrencias)
SELECT v.chave, 'consolidado', v.label, v.descricao, v.agregacao, v.sql_template, 'ativo', 0
FROM (VALUES
  (
    'vacina.doses_total',
    'Vacinas · Doses aplicadas (período)',
    'Total de doses aplicadas no período selecionado.',
    'valor_unico',
    $sql$SELECT COALESCE(SUM(d.doses), 0)::bigint AS valor
FROM vacina_doses d
WHERE d.competencia BETWEEN :competencia_inicio::date AND :competencia_fim::date$sql$
  ),
  (
    'vacina.doses_serie',
    'Vacinas · Doses por mês (ano)',
    'Série mensal de doses de janeiro até o mês selecionado.',
    'historico',
    $sql$SELECT to_char(d.competencia, 'YYYY-MM') AS competencia,
       COALESCE(SUM(d.doses), 0)::bigint AS valor
FROM vacina_doses d
WHERE d.competencia BETWEEN make_date(EXTRACT(YEAR FROM :competencia_fim::date)::int, 1, 1)
                        AND :competencia_fim::date
GROUP BY d.competencia
ORDER BY d.competencia$sql$
  ),
  (
    'vacina.ranking_vacina',
    'Vacinas · Ranking por imunobiológico',
    'Top imunobiológicos por doses no período.',
    'ranking_unidade',
    $sql$SELECT COALESCE(i.imuno_nome, d.imuno_codigo) AS unidade,
       COALESCE(SUM(d.doses), 0)::bigint AS valor
FROM vacina_doses d
LEFT JOIN vacina_imunobiologicos i ON i.imuno_codigo = d.imuno_codigo
WHERE d.competencia BETWEEN :competencia_inicio::date AND :competencia_fim::date
GROUP BY 1
ORDER BY valor DESC
LIMIT 10$sql$
  )
) AS v(chave, label, descricao, agregacao, sql_template)
WHERE NOT EXISTS (SELECT 1 FROM painel_metricas_catalogo WHERE chave LIKE 'vacina.%')
ON CONFLICT (chave) DO NOTHING;
```

- [ ] **Step 2: Aplicar no DB rodando**

Run: `Get-Content migration_047_vacina_metricas_seed.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa`
Expected: `INSERT 0 3`

- [ ] **Step 3: Verificar o seed e o guard (re-run = 0)**

Run:
```powershell
docker exec simpa-postgres-1 psql -U postgres -d simpa -c "SELECT chave, agregacao FROM painel_metricas_catalogo WHERE chave LIKE 'vacina.%' ORDER BY chave"
Get-Content migration_047_vacina_metricas_seed.sql | docker exec -i simpa-postgres-1 psql -U postgres -d simpa
```
Expected: 3 linhas (`vacina.doses_serie`, `vacina.doses_total`, `vacina.ranking_vacina`); segundo comando → `INSERT 0 0`.

- [ ] **Step 4: Validar que uma métrica executa (smoke)**

Run:
```powershell
docker exec simpa-postgres-1 psql -U postgres -d simpa -c "SELECT COALESCE(SUM(d.doses),0)::bigint AS valor FROM vacina_doses d WHERE d.competencia BETWEEN '2026-01-01' AND '2026-03-01'"
```
Expected: um valor numérico (> 0 com as cargas jan–mar).

- [ ] **Step 5: Commit (checkpoint)**

```bash
git add migration_047_vacina_metricas_seed.sql
git commit -m "feat(vacinas): seed de métricas vacina.* no catálogo do Painel"
```

---

## Task 3: Perfil `Vacinas` + exemplos SQL (frontend config)

**Files:**
- Modify: `simpa-frontend/src/utils/indicadoresPainelView.ts`
- Modify: `simpa-frontend/src/utils/painelWidgetSqlExamples.ts`
- Test: `simpa-frontend/src/utils/indicadoresPainelView.test.ts` (criar se não existir)

- [ ] **Step 1: Escrever o teste que falha**

Criar/editar `simpa-frontend/src/utils/indicadoresPainelView.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { PAINEL_WIDGET_PERFIS } from './indicadoresPainelView';

describe('PAINEL_WIDGET_PERFIS', () => {
  it('inclui o perfil Vacinas', () => {
    expect(PAINEL_WIDGET_PERFIS).toContain('Vacinas');
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm --prefix simpa-frontend test -- run src/utils/indicadoresPainelView.test.ts`
Expected: FAIL (`'Vacinas'` ausente).

- [ ] **Step 3: Adicionar o perfil**

Em `simpa-frontend/src/utils/indicadoresPainelView.ts`, linha ~75, alterar:

```typescript
export const PAINEL_WIDGET_PERFIS = ['APS', 'MAC', 'Hospitalar', 'Misto', 'Vacinas'] as const;
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm --prefix simpa-frontend test -- run src/utils/indicadoresPainelView.test.ts`
Expected: PASS

- [ ] **Step 5: Adicionar o grupo de exemplos "Vacinas"**

Em `simpa-frontend/src/utils/painelWidgetSqlExamples.ts`, adicionar um novo grupo ao array `PAINEL_SQL_EXAMPLE_GROUPS` (antes do `]` que fecha o array):

```typescript
  {
    id: 'vacinas',
    label: 'Vacinas (cobertura prorrateada)',
    examples: [
      {
        id: 'vacina-cobertura-card',
        title: 'Card % cobertura de uma vacina×grupo (prorrateado)',
        hint: 'Troque imuno_codigo e o slug do grupo. Formato = Percentual. O mês vem de :competencia_fim.',
        target: 'main',
        sql: `SELECT COALESCE(SUM(d.doses),0)::numeric
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
  AND e.grupo_id = (SELECT id FROM vacina_grupos WHERE slug = 'criancas-menores-1-ano')`,
      },
      {
        id: 'vacina-doses-serie',
        title: 'Linha/sparkline — doses por mês no ano',
        hint: 'Série mensal de janeiro até o mês selecionado.',
        target: 'both',
        sql: `SELECT to_char(d.competencia,'YYYY-MM') AS competencia,
       COALESCE(SUM(d.doses),0)::bigint AS valor
FROM vacina_doses d
WHERE d.competencia BETWEEN make_date(EXTRACT(YEAR FROM :competencia_fim::date)::int,1,1)
                        AND :competencia_fim::date
GROUP BY d.competencia
ORDER BY d.competencia`,
      },
      {
        id: 'vacina-ranking',
        title: 'Ranking — doses por imunobiológico no período',
        hint: 'Alias obrigatório: unidade + valor.',
        target: 'main',
        sql: `SELECT COALESCE(i.imuno_nome, d.imuno_codigo) AS unidade,
       COALESCE(SUM(d.doses),0)::bigint AS valor
FROM vacina_doses d
LEFT JOIN vacina_imunobiologicos i ON i.imuno_codigo = d.imuno_codigo
WHERE d.competencia BETWEEN :competencia_inicio::date AND :competencia_fim::date
GROUP BY 1
ORDER BY valor DESC
LIMIT 10`,
      },
    ],
  },
```

- [ ] **Step 6: Rodar a suíte frontend (nada quebrou)**

Run: `npm --prefix simpa-frontend test -- run src/utils/`
Expected: PASS

- [ ] **Step 7: Commit (checkpoint)**

```bash
git add simpa-frontend/src/utils/indicadoresPainelView.ts simpa-frontend/src/utils/indicadoresPainelView.test.ts simpa-frontend/src/utils/painelWidgetSqlExamples.ts
git commit -m "feat(vacinas): perfil Vacinas e exemplos SQL de cobertura prorrateada"
```

---

## Task 4: Deep-link `?perfil=` em IndicadoresPainelPage

**Files:**
- Modify: `simpa-frontend/src/pages/Cadastros/IndicadoresPainelPage.tsx`
- Test: `simpa-frontend/src/pages/Cadastros/IndicadoresPainelPage.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao `simpa-frontend/src/pages/Cadastros/IndicadoresPainelPage.test.tsx` um teste que monta a página com a rota `?perfil=Vacinas` e verifica que o select de perfil inicia em `Vacinas`. Seguir o padrão de render já usado no arquivo (provavelmente `MemoryRouter`). Exemplo (ajustar imports ao topo do arquivo existente):

```tsx
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

it('pré-seleciona perfil a partir de ?perfil=Vacinas', async () => {
  render(
    <MemoryRouter initialEntries={['/cadastros/indicadores-painel?perfil=Vacinas']}>
      <IndicadoresPainelPage />
    </MemoryRouter>,
  );
  const select = await screen.findByTestId('indicadores-painel-perfil-select');
  expect((select as HTMLSelectElement).value).toBe('Vacinas');
});
```

> Nota: se o arquivo de teste já tem um helper de render com providers (AuthContext etc.), reutilize-o em vez de `MemoryRouter` cru — veja o topo do arquivo antes de escrever.

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm --prefix simpa-frontend test -- run src/pages/Cadastros/IndicadoresPainelPage.test.tsx`
Expected: FAIL (valor inicial = `APS`).

- [ ] **Step 3: Ler o query param no estado inicial**

Em `IndicadoresPainelPage.tsx`:

Adicionar `useSearchParams` ao import do react-router-dom (linha 2):
```typescript
import { Link, useSearchParams } from 'react-router-dom';
```

Adicionar `PAINEL_WIDGET_PERFIS` ao import de `indicadoresPainelView` (já está importado o módulo; garantir que `PAINEL_WIDGET_PERFIS` consta na lista — já consta, linha ~31).

Substituir a inicialização do estado `widgetPerfil` (linha ~54):
```typescript
  const [searchParams] = useSearchParams();
  const perfilParam = searchParams.get('perfil');
  const initialPerfil: PainelWidgetPerfil = (PAINEL_WIDGET_PERFIS as readonly string[]).includes(
    perfilParam ?? '',
  )
    ? (perfilParam as PainelWidgetPerfil)
    : 'APS';
  const [widgetPerfil, setWidgetPerfil] = useState<PainelWidgetPerfil>(initialPerfil);
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm --prefix simpa-frontend test -- run src/pages/Cadastros/IndicadoresPainelPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit (checkpoint)**

```bash
git add simpa-frontend/src/pages/Cadastros/IndicadoresPainelPage.tsx simpa-frontend/src/pages/Cadastros/IndicadoresPainelPage.test.tsx
git commit -m "feat(painel): indicadores-painel aceita ?perfil= para pré-seleção"
```

---

## Task 5: Extrair `DynamicWidgetGrid` reutilizável

**Files:**
- Create: `simpa-frontend/src/components/painel/DynamicWidgetGrid.tsx`
- Create: `simpa-frontend/src/components/painel/DynamicWidgetGrid.test.tsx`
- Modify: `simpa-frontend/src/pages/Painel/LayoutB.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Criar `simpa-frontend/src/components/painel/DynamicWidgetGrid.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DynamicWidgetGrid } from './DynamicWidgetGrid';
import type { ResolvedPainelWidget } from '../../types/painelWidgets';

vi.mock('../charts/LazyEChart', () => ({
  EChart: () => <div data-testid="echart" />,
  trendOption: () => ({}),
  competenciaMesAno: (c: string) => c,
}));

const card: ResolvedPainelWidget = {
  slug: 'c1', ordem: 1, tipo: 'card', titulo: 'Doses', subtitulo: null,
  formato: 'numero', value: 123, valueLabel: '123', isNull: false,
} as ResolvedPainelWidget;

describe('DynamicWidgetGrid', () => {
  it('renderiza cards e usa testId custom', () => {
    render(<DynamicWidgetGrid widgets={[card]} testId="vacinas-indicadores-grid" />);
    expect(screen.getByTestId('vacinas-indicadores-grid')).toBeInTheDocument();
    expect(screen.getByText('Doses')).toBeInTheDocument();
  });

  it('lista vazia não quebra', () => {
    render(<DynamicWidgetGrid widgets={[]} testId="empty-grid" />);
    expect(screen.getByTestId('empty-grid')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm --prefix simpa-frontend test -- run src/components/painel/DynamicWidgetGrid.test.tsx`
Expected: FAIL (`DynamicWidgetGrid` não existe).

- [ ] **Step 3: Criar o componente**

Criar `simpa-frontend/src/components/painel/DynamicWidgetGrid.tsx` (conteúdo extraído de `FocoDynamic` em LayoutB, parametrizando `className`/`testId`):

```tsx
import {
  competenciaMesAno,
  EChart,
  trendOption,
} from '../charts/LazyEChart';
import { KpiCard } from './KpiCard';
import { RankingBar } from './RankingBar';
import type { ResolvedPainelWidget } from '../../types/painelWidgets';
import {
  mapWidgetToKpi,
  mapWidgetToRanking,
  mapWidgetToTrendSeries,
  splitPainelWidgetsByTipo,
} from '../../utils/painelWidgetsView';

interface DynamicWidgetGridProps {
  widgets: ResolvedPainelWidget[];
  loading?: boolean;
  className?: string;
  testId?: string;
}

export function DynamicWidgetGrid({
  widgets,
  loading = false,
  className = 'painel-dynamic-grid',
  testId = 'dynamic-widget-grid',
}: DynamicWidgetGridProps) {
  const sorted = [...widgets].sort((a, b) => a.ordem - b.ordem || a.slug.localeCompare(b.slug));
  const { cards, linhas, rankings } = splitPainelWidgetsByTipo(sorted);

  return (
    <div className={className} data-testid={testId}>
      {loading ? <p className="painel-state-inline">Atualizando indicadores dinâmicos…</p> : null}

      {cards.length ? (
        <div className="foco-cards-grid">
          {cards.map((widget) => (
            <KpiCard key={widget.slug} kpi={mapWidgetToKpi(widget)} />
          ))}
        </div>
      ) : null}

      {linhas.map((widget) => {
        const series = mapWidgetToTrendSeries(widget);
        return (
          <section key={widget.slug} className="card painel-trend-card foco-linha">
            <div className="painel-section-head">
              <h3>{widget.titulo}</h3>
              <span className="mono painel-section-meta">
                {series[0] ? competenciaMesAno(series[0].competencia) : '—'} —{' '}
                {series[series.length - 1]
                  ? competenciaMesAno(series[series.length - 1].competencia)
                  : '—'}
              </span>
            </div>
            <EChart option={trendOption(series)} height={200} />
          </section>
        );
      })}

      {rankings.length ? (
        <div className="foco-rankings-grid">
          {rankings.map((widget) => (
            <section key={widget.slug} className="card painel-ranking-card">
              <h3>{widget.titulo}</h3>
              <div className="ranking-list">
                {mapWidgetToRanking(widget).map((row) => (
                  <RankingBar key={row.nome} row={row} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm --prefix simpa-frontend test -- run src/components/painel/DynamicWidgetGrid.test.tsx`
Expected: PASS

- [ ] **Step 5: LayoutB consome o componente**

Em `simpa-frontend/src/pages/Painel/LayoutB.tsx`:

Trocar os imports de topo (remover `KpiCard`, `RankingBar`, `competenciaMesAno/EChart/trendOption` se não usados em outro trecho — `FocoConsolidado` ainda usa `EChart`, `heroTrendOption`, `KpiCard`, `QualityBars`; manter esses). Adicionar:
```typescript
import { DynamicWidgetGrid } from '../../components/painel/DynamicWidgetGrid';
```

Substituir todo o corpo da função `FocoDynamic` (linhas ~38-94) por uma chamada ao componente novo. Trocar o uso dentro de `LayoutB`:
```tsx
  if (widgets.length) {
    return (
      <DynamicWidgetGrid
        widgets={widgets}
        loading={loading}
        className="painel-layout-b"
        testId="layout-b"
      />
    );
  }
```
E remover a definição local de `FocoDynamic` e os imports que só ela usava (`mapWidgetToKpi`, `mapWidgetToRanking`, `mapWidgetToTrendSeries`, `splitPainelWidgetsByTipo`, `RankingBar`, `trendOption`, `competenciaMesAno`) — mantendo os que `FocoConsolidado` ainda usa (`EChart`, `heroTrendOption`, `KpiCard`, `QualityBars`, `buildPainelKpis`, `buildTrendSeries`).

- [ ] **Step 6: Rodar os testes do Painel (comportamento idêntico)**

Run: `npm --prefix simpa-frontend test -- run src/pages/Painel src/hooks/usePainelLayout.test.tsx`
Expected: PASS (testid `layout-b` preservado).

- [ ] **Step 7: Commit (checkpoint)**

```bash
git add simpa-frontend/src/components/painel/DynamicWidgetGrid.tsx simpa-frontend/src/components/painel/DynamicWidgetGrid.test.tsx simpa-frontend/src/pages/Painel/LayoutB.tsx
git commit -m "refactor(painel): extrai DynamicWidgetGrid reutilizável de LayoutB"
```

---

## Task 6: Seção "Indicadores" + link + nota de proração em /vacinas

**Files:**
- Modify: `simpa-frontend/src/pages/Vacinas/index.tsx`
- Test: `simpa-frontend/src/pages/Vacinas/index.test.tsx` (criar se não existir)

- [ ] **Step 1: Escrever o teste que falha**

Criar `simpa-frontend/src/pages/Vacinas/index.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VacinasPage from './index';

vi.mock('../../api/vacina', () => ({
  fetchCobertura: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../api/painelWidgets', () => ({
  fetchPainelLayout: vi.fn().mockResolvedValue({
    perfil: 'Vacinas', layout: 'A', periodo: '2026-12', competencia: '2026-12',
    widgets: [{ slug: 'c1', ordem: 1, tipo: 'card', titulo: 'Doses', subtitulo: null, formato: 'numero', value: 10, valueLabel: '10', isNull: false }],
  }),
}));
vi.mock('../../components/painel/DynamicWidgetGrid', () => ({
  DynamicWidgetGrid: () => <div data-testid="vacinas-indicadores-grid" />,
}));

describe('VacinasPage — indicadores', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza a seção de indicadores quando há widgets', async () => {
    render(<MemoryRouter><VacinasPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('vacinas-indicadores-grid')).toBeInTheDocument());
  });

  it('mostra link para gerenciar indicadores', () => {
    render(<MemoryRouter><VacinasPage /></MemoryRouter>);
    const link = screen.getByTestId('vacinas-gerenciar-indicadores');
    expect(link).toHaveAttribute('href', expect.stringContaining('perfil=Vacinas'));
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm --prefix simpa-frontend test -- run src/pages/Vacinas/index.test.tsx`
Expected: FAIL (seção/link não existem).

- [ ] **Step 3: Implementar a seção e o link**

Em `simpa-frontend/src/pages/Vacinas/index.tsx`:

Adicionar imports no topo:
```typescript
import { Link } from 'react-router-dom';
import { fetchPainelLayout } from '../../api/painelWidgets';
import type { ResolvedPainelWidget } from '../../types/painelWidgets';
import { DynamicWidgetGrid } from '../../components/painel/DynamicWidgetGrid';
```

Adicionar estado e efeito (junto dos hooks existentes, após o `useEffect` da cobertura):
```typescript
  const [indicadores, setIndicadores] = useState<ResolvedPainelWidget[]>([]);

  useEffect(() => {
    fetchPainelLayout({ perfil: 'Vacinas', layout: 'A', periodo: `${ANO}-${mes}` })
      .then((r) => setIndicadores(r.widgets))
      .catch(() => setIndicadores([])); // 404 (sem widgets) → seção some
  }, [mes]);
```

No cabeçalho (`vacinas-header-controls`), adicionar o link após o botão de export:
```tsx
          <Link
            to="/cadastros/indicadores-painel?perfil=Vacinas"
            className="vacinas-export-btn"
            data-testid="vacinas-gerenciar-indicadores"
          >
            Gerenciar indicadores
          </Link>
```

Adicionar nota de proração na legenda (dentro do bloco `vacinas-legend`, como último filho):
```tsx
            <span className="vacinas-legend-note">Meta proporcional ao mês ({mes}/12)</span>
```

Adicionar a seção de indicadores após o fechamento do bloco da matriz (depois do `</>` condicional, antes do `</div>` final da página):
```tsx
      {indicadores.length > 0 && (
        <section className="vacinas-indicadores" data-testid="vacinas-indicadores">
          <h3 className="painel-title">Indicadores</h3>
          <DynamicWidgetGrid widgets={indicadores} testId="vacinas-indicadores-grid" />
        </section>
      )}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm --prefix simpa-frontend test -- run src/pages/Vacinas/index.test.tsx`
Expected: PASS

- [ ] **Step 5: Smoke manual (opcional, stack :8080)**

Abrir `http://localhost:8080/vacinas`: matriz com % prorrateado + nota "Meta proporcional ao mês"; botão "Gerenciar indicadores" → abre indicadores-painel já em Vacinas. Criar um widget card com o exemplo "Card % cobertura" → aparece na seção Indicadores.

- [ ] **Step 6: Commit (checkpoint)**

```bash
git add simpa-frontend/src/pages/Vacinas/index.tsx simpa-frontend/src/pages/Vacinas/index.test.tsx
git commit -m "feat(vacinas): seção de indicadores dinâmicos e nota de proração em /vacinas"
```

---

## Task 7: Documentação

**Files:**
- Modify: `docs/agent/vacinas.md`

- [ ] **Step 1: Documentar**

Em `docs/agent/vacinas.md`, na seção "Fórmula de cobertura", ajustar a fórmula para incluir o fator do período e adicionar uma subseção "Indicadores dinâmicos":

- Fórmula: `cobertura = Σ doses(jan→mês) / (pop_alvo × num_doses × (mês/12))`; dezembro → fator 1.
- Nova subseção: indicadores de vacina são widgets do perfil `Vacinas` (cadastro em `/cadastros/indicadores-painel?perfil=Vacinas`), renderizados em `/vacinas` via `DynamicWidgetGrid`; proração de % no `sql_override` via `EXTRACT(MONTH FROM :competencia_fim::date)/12.0`; métricas base `vacina.*` em `migration_039`.

- [ ] **Step 2: Commit (checkpoint)**

```bash
git add docs/agent/vacinas.md
git commit -m "docs(vacinas): proração de cobertura e indicadores dinâmicos"
```

---

## Verificação final

- [ ] `npm --prefix simpa-backend test -- tests/vacinaService.test.js` → PASS
- [ ] `npm --prefix simpa-frontend test -- run src/pages/Vacinas src/components/painel src/pages/Cadastros/IndicadoresPainelPage.test.tsx src/utils/indicadoresPainelView.test.ts` → PASS
- [ ] `migration_039` aplicada; re-run = `INSERT 0 0`
- [ ] Matriz `/vacinas` mostra % prorrateado; nota de proração visível
- [ ] `/vacinas` → "Gerenciar indicadores" abre perfil Vacinas; widget criado aparece na seção Indicadores

## Self-review (cobertura do spec)

- R1 (criar indicadores): Task 3 (perfil) + Task 4 (deep-link) + Task 6 (link) ✓
- R2 (renderizar em /vacinas): Task 5 (grid) + Task 6 (seção) ✓
- R3 (proração): Task 1 (matriz) + Task 3 (exemplo SQL widget) ✓
- Apoio: Task 2 (métricas seed) + Task 3 (exemplos) ✓
- Fora de escopo respeitado (sem trimestre/quadri no /vacinas, sem meta mensal, sem widget no Painel principal) ✓
