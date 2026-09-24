# Relatórios de Doses Aplicadas (Vacinas) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Doses Aplicadas" tab to `/vacinas` with operational reports (by month, unit, registration mechanism, and year-accumulated by vaccine and age band) read straight from the `vacina_doses` fact table.

**Architecture:** New read-only backend service (`vacinaRelatorioService.js`) exposing two endpoints under `/api/vacina/doses/*`, aggregating `vacina_doses` with `GROUP BY` queries run in parallel. New React component (`DosesReport.tsx`) with filters (ano/mês/unidade), persona presets, ECharts visualizations, and CSV export. No migration, no ETL, no changes to cobertura.

**Tech Stack:** Node 18 + Express + `pg` (backend); React 19 + Vite + ECharts (frontend). Tests: Jest (backend), Vitest + Testing Library (frontend).

**Spec:** `docs/superpowers/specs/2026-09-24-vacinas-relatorios-doses-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `simpa-backend/src/services/vacinaRelatorioService.js` | **Create.** `getResumoDoses`, `getFiltros` — raw-dose aggregations |
| `simpa-backend/tests/vacinaRelatorioService.test.js` | **Create.** Jest unit test mocking `query` |
| `simpa-backend/src/routes/vacina.js` | **Modify.** Add `GET /doses/resumo`, `GET /doses/filtros` |
| `simpa-frontend/src/types/vacina.ts` | **Modify.** Add `VacinaDosesResumo`, `VacinaDosesFiltros` |
| `simpa-frontend/src/api/vacina.ts` | **Modify.** Add `fetchDosesResumo`, `fetchDosesFiltros` |
| `simpa-frontend/src/pages/Vacinas/DosesReport.tsx` | **Create.** Filters + presets + charts + CSV |
| `simpa-frontend/src/pages/Vacinas/DosesReport.test.tsx` | **Create.** Vitest render test |
| `simpa-frontend/src/pages/Vacinas/index.tsx` | **Modify.** Tab switch Cobertura \| Doses |
| `docs/agent/vacinas.md` | **Modify.** Document endpoints + new tab |

---

## Task 1: Backend aggregation service

**Files:**
- Create: `simpa-backend/src/services/vacinaRelatorioService.js`
- Test: `simpa-backend/tests/vacinaRelatorioService.test.js`

- [ ] **Step 1: Write the failing test**

Create `simpa-backend/tests/vacinaRelatorioService.test.js`:

```javascript
jest.mock('../src/services/db', () => ({ query: jest.fn() }));

const db = require('../src/services/db');
const { getResumoDoses, getFiltros } = require('../src/services/vacinaRelatorioService');

describe('vacinaRelatorioService.getResumoDoses', () => {
  beforeEach(() => jest.clearAllMocks());

  it('assembles breakdowns and computes accumulated/month totals from serie', async () => {
    // Promise.all order: serie, vacina, faixa, unidade, sistema
    db.query
      .mockResolvedValueOnce({ rows: [
        { competencia: '2026-01', doses: '100' },
        { competencia: '2026-02', doses: '200' },
        { competencia: '2026-03', doses: '300' },
        { competencia: '2026-04', doses: '999' },
      ] })
      .mockResolvedValueOnce({ rows: [{ imuno_codigo: '85', imuno_nome: 'BCG', doses: '350' }] })
      .mockResolvedValueOnce({ rows: [{ faixa_nies: '< 01 ano', doses: '250' }] })
      .mockResolvedValueOnce({ rows: [{ cnes_sala: '4032128', sala_nome: 'UBS A', doses: '600' }] })
      .mockResolvedValueOnce({ rows: [{ sistema_origem: 'NOVO PNI', doses: '600' }] });

    const out = await getResumoDoses({ ano: 2026, mes: 3, cnesSala: null });

    expect(out.total_doses_ano).toBe(600); // jan+fev+mar, abril excluded by mes=3
    expect(out.total_doses_mes).toBe(300); // março only
    expect(out.serie_mensal).toHaveLength(4);
    expect(out.por_vacina[0]).toEqual({ imuno_codigo: '85', imuno_nome: 'BCG', doses: 350 });
    expect(out.por_faixa[0].doses).toBe(250);
    expect(out.por_unidade[0].sala_nome).toBe('UBS A');
    expect(out.por_sistema[0].sistema_origem).toBe('NOVO PNI');
  });

  it('without mes, total_doses_mes equals full-year accumulated', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [
        { competencia: '2026-01', doses: '100' },
        { competencia: '2026-02', doses: '200' },
      ] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const out = await getResumoDoses({ ano: 2026, mes: null, cnesSala: null });
    expect(out.total_doses_ano).toBe(300);
    expect(out.total_doses_mes).toBe(300);
    expect(out.mes).toBeNull();
  });
});

describe('vacinaRelatorioService.getFiltros', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns distinct anos and salas', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ ano: 2026 }] })
      .mockResolvedValueOnce({ rows: [{ cnes_sala: '4032128', sala_nome: 'UBS A' }] });

    const out = await getFiltros();
    expect(out.anos).toEqual([2026]);
    expect(out.salas).toEqual([{ cnes_sala: '4032128', sala_nome: 'UBS A' }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd simpa-backend && npx jest vacinaRelatorioService`
Expected: FAIL — `Cannot find module '../src/services/vacinaRelatorioService'`

- [ ] **Step 3: Write the service**

Create `simpa-backend/src/services/vacinaRelatorioService.js`:

```javascript
'use strict';

const { query } = require('./db');

/**
 * Aggregations over vacina_doses for the doses reports.
 * - serie_mensal: full calendar year (Jan..Dec) of `ano`.
 * - accumulated breakdowns: Jan..mes (or whole year when mes is null).
 * - cnesSala filters every slice to one unit when provided.
 */
async function getResumoDoses({ ano, mes = null, cnesSala = null }) {
  const inicioAno = `${ano}-01-01`;
  const fimAno = `${ano}-12-01`;
  const mesPad = mes ? String(mes).padStart(2, '0') : null;
  const fimAcum = mes ? `${ano}-${mesPad}-01` : fimAno;

  const range = 'competencia BETWEEN $1 AND $2 AND ($3::text IS NULL OR cnes_sala = $3)';
  const anoParams = [inicioAno, fimAno, cnesSala];
  const acumParams = [inicioAno, fimAcum, cnesSala];

  const [serie, vacina, faixa, unidade, sistema] = await Promise.all([
    query(
      `SELECT to_char(competencia, 'YYYY-MM') AS competencia, COALESCE(SUM(doses), 0)::int AS doses
         FROM vacina_doses WHERE ${range}
        GROUP BY competencia ORDER BY competencia`,
      anoParams
    ),
    query(
      `SELECT imuno_codigo, MAX(imuno_nome) AS imuno_nome, COALESCE(SUM(doses), 0)::int AS doses
         FROM vacina_doses WHERE ${range}
        GROUP BY imuno_codigo ORDER BY doses DESC`,
      acumParams
    ),
    query(
      `SELECT faixa_nies, COALESCE(SUM(doses), 0)::int AS doses
         FROM vacina_doses WHERE ${range}
        GROUP BY faixa_nies ORDER BY doses DESC`,
      acumParams
    ),
    query(
      `SELECT cnes_sala, MAX(sala_nome) AS sala_nome, COALESCE(SUM(doses), 0)::int AS doses
         FROM vacina_doses WHERE ${range}
        GROUP BY cnes_sala ORDER BY doses DESC`,
      acumParams
    ),
    query(
      `SELECT sistema_origem, COALESCE(SUM(doses), 0)::int AS doses
         FROM vacina_doses WHERE ${range}
        GROUP BY sistema_origem ORDER BY doses DESC`,
      acumParams
    ),
  ]);

  const serie_mensal = serie.rows.map((r) => ({ competencia: r.competencia, doses: Number(r.doses) }));
  const mesAlvo = fimAcum.slice(0, 7); // 'YYYY-MM'
  const total_doses_ano = serie_mensal
    .filter((r) => r.competencia <= mesAlvo)
    .reduce((sum, r) => sum + r.doses, 0);
  const total_doses_mes = mes
    ? (serie_mensal.find((r) => r.competencia === mesAlvo)?.doses ?? 0)
    : total_doses_ano;

  return {
    ano,
    mes,
    total_doses_mes,
    total_doses_ano,
    serie_mensal,
    por_vacina: vacina.rows.map((r) => ({ imuno_codigo: r.imuno_codigo, imuno_nome: r.imuno_nome, doses: Number(r.doses) })),
    por_faixa: faixa.rows.map((r) => ({ faixa_nies: r.faixa_nies, doses: Number(r.doses) })),
    por_unidade: unidade.rows.map((r) => ({ cnes_sala: r.cnes_sala, sala_nome: r.sala_nome, doses: Number(r.doses) })),
    por_sistema: sistema.rows.map((r) => ({ sistema_origem: r.sistema_origem, doses: Number(r.doses) })),
  };
}

/** Filter options for the report: available years and units (independent of active filters). */
async function getFiltros() {
  const [anos, salas] = await Promise.all([
    query(`SELECT DISTINCT EXTRACT(YEAR FROM competencia)::int AS ano FROM vacina_doses ORDER BY ano DESC`),
    query(`SELECT DISTINCT cnes_sala, sala_nome FROM vacina_doses ORDER BY sala_nome`),
  ]);
  return {
    anos: anos.rows.map((r) => r.ano),
    salas: salas.rows.map((r) => ({ cnes_sala: r.cnes_sala, sala_nome: r.sala_nome })),
  };
}

module.exports = { getResumoDoses, getFiltros };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd simpa-backend && npx jest vacinaRelatorioService`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add simpa-backend/src/services/vacinaRelatorioService.js simpa-backend/tests/vacinaRelatorioService.test.js
git commit -m "feat(vacinas): serviço de agregação de doses aplicadas"
```

---

## Task 2: Wire the routes

**Files:**
- Modify: `simpa-backend/src/routes/vacina.js`

- [ ] **Step 1: Add the service import**

In `simpa-backend/src/routes/vacina.js`, right after the existing `getCobertura` import (line 10 `const { getCobertura } = require('../services/vacinaService');`), add:

```javascript
const { getResumoDoses, getFiltros } = require('../services/vacinaRelatorioService');
```

- [ ] **Step 2: Add the routes**

In the same file, immediately after the `router.get('/cobertura', ...)` handler block closes (after its closing `});`, before the `// ── Cadastros ──` comment), insert:

```javascript
// ── Relatórios de doses ─────────────────────────────────────────────────────────

router.get('/doses/resumo', async (req, res, next) => {
  try {
    const ano = parseInt(req.query.ano, 10);
    if (!Number.isFinite(ano) || ano < 2000 || ano > 2100) {
      return res.status(400).json({ error: 'ano deve ser inteiro entre 2000 e 2100' });
    }
    let mes = null;
    if (req.query.mes != null && req.query.mes !== '') {
      mes = parseInt(req.query.mes, 10);
      if (!Number.isFinite(mes) || mes < 1 || mes > 12) {
        return res.status(400).json({ error: 'mes deve ser inteiro entre 1 e 12' });
      }
    }
    const cnesSala = req.query.cnes_sala || null;
    return res.json(await getResumoDoses({ ano, mes, cnesSala }));
  } catch (err) {
    return next(err);
  }
});

router.get('/doses/filtros', async (_req, res, next) => {
  try {
    return res.json(await getFiltros());
  } catch (err) {
    return next(err);
  }
});
```

- [ ] **Step 3: Verify the app still boots (route registration)**

Run: `cd simpa-backend && node -e "require('./src/routes/vacina.js'); console.log('routes ok')"`
Expected: prints `routes ok` with no throw.

- [ ] **Step 4: Commit**

```bash
git add simpa-backend/src/routes/vacina.js
git commit -m "feat(vacinas): endpoints /doses/resumo e /doses/filtros"
```

---

## Task 3: Frontend types + API client

**Files:**
- Modify: `simpa-frontend/src/types/vacina.ts`
- Modify: `simpa-frontend/src/api/vacina.ts`

- [ ] **Step 1: Add the types**

Append to `simpa-frontend/src/types/vacina.ts`:

```typescript
export interface VacinaDosesResumo {
  ano: number;
  mes: number | null;
  total_doses_mes: number;
  total_doses_ano: number;
  serie_mensal: { competencia: string; doses: number }[];
  por_vacina: { imuno_codigo: string; imuno_nome: string; doses: number }[];
  por_faixa: { faixa_nies: string; doses: number }[];
  por_unidade: { cnes_sala: string; sala_nome: string; doses: number }[];
  por_sistema: { sistema_origem: string; doses: number }[];
}

export interface VacinaDosesFiltros {
  anos: number[];
  salas: { cnes_sala: string; sala_nome: string }[];
}
```

- [ ] **Step 2: Add the API functions**

In `simpa-frontend/src/api/vacina.ts`:

Add to the type import block (after `Imunobiologico,` on line 9) and to the re-export block (after `Imunobiologico,` on line 19) the two new names:

```typescript
  VacinaDosesResumo,
  VacinaDosesFiltros,
```

Then append at end of file:

```typescript
export function fetchDosesResumo(params: {
  ano: number;
  mes?: number | null;
  cnes_sala?: string | null;
}): Promise<VacinaDosesResumo> {
  const p = new URLSearchParams({ ano: String(params.ano) });
  if (params.mes != null) p.set('mes', String(params.mes));
  if (params.cnes_sala) p.set('cnes_sala', params.cnes_sala);
  return apiFetch<VacinaDosesResumo>(`/api/vacina/doses/resumo?${p}`);
}

export function fetchDosesFiltros(): Promise<VacinaDosesFiltros> {
  return apiFetch<VacinaDosesFiltros>('/api/vacina/doses/filtros');
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd simpa-frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add simpa-frontend/src/types/vacina.ts simpa-frontend/src/api/vacina.ts
git commit -m "feat(vacinas): tipos e client para relatórios de doses"
```

---

## Task 4: DosesReport component

**Files:**
- Create: `simpa-frontend/src/pages/Vacinas/DosesReport.tsx`
- Test: `simpa-frontend/src/pages/Vacinas/DosesReport.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `simpa-frontend/src/pages/Vacinas/DosesReport.test.tsx`:

```typescript
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDosesResumo, fetchDosesFiltros } from '../../api/vacina';
import { DosesReport } from './DosesReport';

vi.mock('../../api/vacina', async () => {
  const actual = await vi.importActual<typeof import('../../api/vacina')>('../../api/vacina');
  return { ...actual, fetchDosesResumo: vi.fn(), fetchDosesFiltros: vi.fn() };
});

const mockResumo = vi.mocked(fetchDosesResumo);
const mockFiltros = vi.mocked(fetchDosesFiltros);

const sampleResumo = {
  ano: 2026,
  mes: 3,
  total_doses_mes: 300,
  total_doses_ano: 600,
  serie_mensal: [
    { competencia: '2026-01', doses: 100 },
    { competencia: '2026-02', doses: 200 },
    { competencia: '2026-03', doses: 300 },
  ],
  por_vacina: [{ imuno_codigo: '85', imuno_nome: 'BCG', doses: 350 }],
  por_faixa: [{ faixa_nies: '< 01 ano', doses: 250 }],
  por_unidade: [{ cnes_sala: '4032128', sala_nome: 'UBS A', doses: 600 }],
  por_sistema: [{ sistema_origem: 'NOVO PNI', doses: 600 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFiltros.mockResolvedValue({ anos: [2026], salas: [{ cnes_sala: '4032128', sala_nome: 'UBS A' }] });
  mockResumo.mockResolvedValue(sampleResumo);
});

afterEach(() => cleanup());

describe('DosesReport', () => {
  it('renders KPIs and chart containers after load', async () => {
    render(<DosesReport />);
    await waitFor(() => expect(screen.getByTestId('doses-kpi-ano')).toHaveTextContent('600'));
    expect(screen.getByTestId('doses-kpi-mes')).toHaveTextContent('300');
    expect(screen.getByTestId('doses-chart-serie')).toBeInTheDocument();
    expect(screen.getByTestId('doses-chart-vacina')).toBeInTheDocument();
    expect(screen.getByTestId('doses-chart-faixa')).toBeInTheDocument();
    expect(screen.getByTestId('doses-chart-unidade')).toBeInTheDocument();
    expect(screen.getByTestId('doses-chart-sistema')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd simpa-frontend && npx vitest run src/pages/Vacinas/DosesReport.test.tsx`
Expected: FAIL — cannot resolve `./DosesReport`.

- [ ] **Step 3: Write the component**

Create `simpa-frontend/src/pages/Vacinas/DosesReport.tsx`:

```typescript
import { useEffect, useMemo, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import { fetchDosesResumo, fetchDosesFiltros } from '../../api/vacina';
import type { VacinaDosesResumo, VacinaDosesFiltros } from '../../types/vacina';
import { EChart } from '../../components/charts/EChart';
import { downloadCsv } from '../../utils/csv';

const MONTHS: Array<[string, string]> = [
  ['1', 'Janeiro'], ['2', 'Fevereiro'], ['3', 'Março'], ['4', 'Abril'],
  ['5', 'Maio'], ['6', 'Junho'], ['7', 'Julho'], ['8', 'Agosto'],
  ['9', 'Setembro'], ['10', 'Outubro'], ['11', 'Novembro'], ['12', 'Dezembro'],
];

const BAR_COLOR = '#0b5fad';

function barOption(labels: string[], values: number[], horizontal = false): EChartsCoreOption {
  const cat = { type: 'category' as const, data: labels, axisLabel: { color: '#8595a8', fontSize: 9 } };
  const val = { type: 'value' as const, axisLabel: { color: '#8595a8', fontSize: 9 }, splitLine: { lineStyle: { color: '#eef2f7' } } };
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" },
    grid: { left: 8, right: 12, top: 16, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: horizontal ? val : cat,
    yAxis: horizontal ? { ...cat, inverse: true } : val,
    series: [{ type: 'bar', data: values, itemStyle: { color: BAR_COLOR, borderRadius: 3 } }],
  };
}

function lineOption(points: Array<{ competencia: string; doses: number }>): EChartsCoreOption {
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" },
    grid: { left: 8, right: 8, top: 16, bottom: 24, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: points.map((p) => p.competencia.slice(5)), axisLabel: { color: '#8595a8', fontSize: 9 } },
    yAxis: { type: 'value', axisLabel: { color: '#8595a8', fontSize: 9 }, splitLine: { lineStyle: { color: '#eef2f7' } } },
    series: [{ type: 'line', data: points.map((p) => p.doses), smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { color: BAR_COLOR, width: 2.5 } }],
  };
}

type Persona = 'secretario' | 'coordenador' | 'vigilancia';

export function DosesReport() {
  const [filtros, setFiltros] = useState<VacinaDosesFiltros>({ anos: [], salas: [] });
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [mes, setMes] = useState<string>(''); // '' = ano todo
  const [cnesSala, setCnesSala] = useState<string>(''); // '' = todas
  const [data, setData] = useState<VacinaDosesResumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDosesFiltros()
      .then((f) => {
        setFiltros(f);
        if (f.anos.length > 0) setAno((prev) => (f.anos.includes(prev) ? prev : f.anos[0]));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchDosesResumo({ ano, mes: mes ? Number(mes) : null, cnes_sala: cnesSala || null })
      .then((r) => { setData(r); setLoading(false); })
      .catch(() => setLoading(false));
  }, [ano, mes, cnesSala]);

  const ultimoMes = useMemo(() => {
    const withData = (data?.serie_mensal ?? []).filter((r) => r.doses > 0);
    return withData.length > 0 ? String(Number(withData[withData.length - 1].competencia.slice(5, 7))) : '';
  }, [data]);

  const applyPersona = (p: Persona) => {
    if (p === 'secretario') { setCnesSala(''); setMes(''); }
    else if (p === 'coordenador') { setCnesSala(filtros.salas[0]?.cnes_sala ?? ''); setMes(ultimoMes); }
    else { setCnesSala(''); setMes(ultimoMes); } // vigilancia: município, mês mais recente
  };

  return (
    <div data-testid="doses-report">
      <div className="vacinas-header-controls" style={{ flexWrap: 'wrap', gap: 8 }}>
        <select className="vacinas-filter-select" value={ano} onChange={(e) => setAno(Number(e.target.value))} aria-label="Ano">
          {(filtros.anos.length ? filtros.anos : [ano]).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="vacinas-filter-select" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês">
          <option value="">Ano todo</option>
          {MONTHS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <select className="vacinas-filter-select" value={cnesSala} onChange={(e) => setCnesSala(e.target.value)} aria-label="Unidade">
          <option value="">Todas as unidades</option>
          {filtros.salas.map((s) => <option key={s.cnes_sala} value={s.cnes_sala}>{s.sala_nome}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="vacinas-export-btn" onClick={() => applyPersona('secretario')}>Secretário</button>
          <button className="vacinas-export-btn" onClick={() => applyPersona('coordenador')}>Coordenador</button>
          <button className="vacinas-export-btn" onClick={() => applyPersona('vigilancia')}>Vigilância</button>
        </div>
      </div>

      {loading || !data ? (
        <p className="vacinas-state" data-testid="doses-loading">Carregando…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 16, margin: '12px 0' }}>
            <div className="card" style={{ padding: 16, flex: 1 }}>
              <div className="mono">Doses no mês</div>
              <div style={{ fontSize: 28, fontWeight: 700 }} data-testid="doses-kpi-mes">{data.total_doses_mes.toLocaleString('pt-BR')}</div>
            </div>
            <div className="card" style={{ padding: 16, flex: 1 }}>
              <div className="mono">Acumulado no ano</div>
              <div style={{ fontSize: 28, fontWeight: 700 }} data-testid="doses-kpi-ano">{data.total_doses_ano.toLocaleString('pt-BR')}</div>
            </div>
          </div>

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <h3 className="cadastro-sync-title">Evolução mensal</h3>
            <EChart option={lineOption(data.serie_mensal)} height={220} testId="doses-chart-serie" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3 className="cadastro-sync-title">Por vacina (acumulado)</h3>
                <button className="vacinas-export-btn" onClick={() => downloadCsv('doses_por_vacina.csv', [{ key: 'imuno_nome', label: 'Vacina' }, { key: 'doses', label: 'Doses' }], data.por_vacina)} disabled={data.por_vacina.length === 0}>CSV</button>
              </div>
              <EChart option={barOption(data.por_vacina.map((r) => r.imuno_nome), data.por_vacina.map((r) => r.doses))} height={220} testId="doses-chart-vacina" />
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3 className="cadastro-sync-title">Por faixa etária (acumulado)</h3>
                <button className="vacinas-export-btn" onClick={() => downloadCsv('doses_por_faixa.csv', [{ key: 'faixa_nies', label: 'Faixa' }, { key: 'doses', label: 'Doses' }], data.por_faixa)} disabled={data.por_faixa.length === 0}>CSV</button>
              </div>
              <EChart option={barOption(data.por_faixa.map((r) => r.faixa_nies), data.por_faixa.map((r) => r.doses))} height={220} testId="doses-chart-faixa" />
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3 className="cadastro-sync-title">Por unidade</h3>
                <button className="vacinas-export-btn" onClick={() => downloadCsv('doses_por_unidade.csv', [{ key: 'sala_nome', label: 'Unidade' }, { key: 'doses', label: 'Doses' }], data.por_unidade)} disabled={data.por_unidade.length === 0}>CSV</button>
              </div>
              <EChart option={barOption(data.por_unidade.map((r) => r.sala_nome), data.por_unidade.map((r) => r.doses), true)} height={Math.max(220, data.por_unidade.length * 26)} testId="doses-chart-unidade" />
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3 className="cadastro-sync-title">Por mecanismo de registro</h3>
                <button className="vacinas-export-btn" onClick={() => downloadCsv('doses_por_sistema.csv', [{ key: 'sistema_origem', label: 'Sistema' }, { key: 'doses', label: 'Doses' }], data.por_sistema)} disabled={data.por_sistema.length === 0}>CSV</button>
              </div>
              <EChart option={barOption(data.por_sistema.map((r) => r.sistema_origem ?? '—'), data.por_sistema.map((r) => r.doses))} height={220} testId="doses-chart-sistema" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd simpa-frontend && npx vitest run src/pages/Vacinas/DosesReport.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add simpa-frontend/src/pages/Vacinas/DosesReport.tsx simpa-frontend/src/pages/Vacinas/DosesReport.test.tsx
git commit -m "feat(vacinas): componente DosesReport (filtros, presets, gráficos, CSV)"
```

---

## Task 5: Tab switch on the Vacinas page

**Files:**
- Modify: `simpa-frontend/src/pages/Vacinas/index.tsx`

- [ ] **Step 1: Import the component and add tab state**

In `simpa-frontend/src/pages/Vacinas/index.tsx`:

Add after line 5 (`import { CoberturaMatrix } from './CoberturaMatrix';`):

```typescript
import { DosesReport } from './DosesReport';
```

Add as the first line inside `export default function VacinasPage() {` (before `const [mes, setMes] = useState('12');`):

```typescript
  const [aba, setAba] = useState<'cobertura' | 'doses'>('cobertura');
```

- [ ] **Step 2: Render the tab bar and branch content**

Replace the opening of the returned JSX. Change this block:

```typescript
  return (
    <div className="vacinas-page simpa-rise" data-testid="vacinas-page">
      <div className="vacinas-header">
        <div>
          <h2 className="painel-title">Cobertura Vacinal {ANO}</h2>
        </div>
```

into:

```typescript
  return (
    <div className="vacinas-page simpa-rise" data-testid="vacinas-page">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          className={aba === 'cobertura' ? 'cadastro-btn primary' : 'cadastro-btn'}
          onClick={() => setAba('cobertura')}
          data-testid="vacinas-tab-cobertura"
        >
          Cobertura
        </button>
        <button
          className={aba === 'doses' ? 'cadastro-btn primary' : 'cadastro-btn'}
          onClick={() => setAba('doses')}
          data-testid="vacinas-tab-doses"
        >
          Doses Aplicadas
        </button>
      </div>

      {aba === 'doses' ? <DosesReport /> : (
      <>
      <div className="vacinas-header">
        <div>
          <h2 className="painel-title">Cobertura Vacinal {ANO}</h2>
        </div>
```

Then find the final closing of the cobertura content. The component currently ends with:

```typescript
      )}
    </div>
  );
}
```

Change it to close the cobertura fragment before the outer `div`:

```typescript
      )}
      </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify types compile and existing page test still passes**

Run: `cd simpa-frontend && npx tsc --noEmit && npx vitest run src/pages/Vacinas`
Expected: no TS errors; existing Vacinas tests + new DosesReport test PASS.

- [ ] **Step 4: Commit**

```bash
git add simpa-frontend/src/pages/Vacinas/index.tsx
git commit -m "feat(vacinas): abas Cobertura | Doses Aplicadas na página /vacinas"
```

---

## Task 6: Documentation

**Files:**
- Modify: `docs/agent/vacinas.md`

- [ ] **Step 1: Document the endpoints**

In `docs/agent/vacinas.md`, in the "### Cobertura" endpoints area, add a new subsection right after the cobertura endpoint table:

```markdown
### Relatórios de doses

Leem `vacina_doses` direto (sem cobertura). Só JWT (leitura).

| Método | Path | Query params |
|--------|------|--------------|
| GET | `/api/vacina/doses/resumo` | `ano` (obrigatório 2000–2100), `mes` (1–12; ausente = ano todo), `cnes_sala` (opcional; filtra a uma unidade) |
| GET | `/api/vacina/doses/filtros` | — (retorna `{ anos, salas }` para os dropdowns) |

`resumo` retorna `{ ano, mes, total_doses_mes, total_doses_ano, serie_mensal, por_vacina, por_faixa, por_unidade, por_sistema }`. `serie_mensal` cobre o ano inteiro; os demais cortes acumulam janeiro→`mes`. Implementação: `services/vacinaRelatorioService.js`.
```

- [ ] **Step 2: Document the frontend tab**

In `docs/agent/vacinas.md`, under "### Página `/vacinas`", add after the cobertura bullets:

```markdown
- **Abas:** `Cobertura` (heatmap atual) e `Doses Aplicadas` (`DosesReport.tsx`).
- **Aba Doses Aplicadas:** filtros ano/mês/unidade + presets Secretário/Coordenador/Vigilância (apenas ajustam filtros). Gráficos ECharts: evolução mensal (linha), por vacina, por faixa etária, por unidade (ranking), por mecanismo de registro. Export CSV por corte. Dados via `GET /api/vacina/doses/resumo`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/agent/vacinas.md
git commit -m "docs(vacinas): relatórios de doses (endpoints + aba /vacinas)"
```

---

## Final verification

- [ ] **Backend suite:** `cd simpa-backend && npx jest vacina` → all vacina tests PASS.
- [ ] **Frontend suite:** `cd simpa-frontend && npx vitest run src/pages/Vacinas` → PASS.
- [ ] **Types:** `cd simpa-frontend && npx tsc --noEmit` → clean.
- [ ] **Manual smoke (Docker):** rebuild api, open `http://localhost:8080/vacinas`, click "Doses Aplicadas", confirm charts render for 2026 and change with mês/unidade filters.

---

## Self-review notes

- **Spec coverage:** mês (filtro + `mes` param) ✅; por unidade (`por_unidade` + filtro `cnes_sala`) ✅; por mecanismo (`por_sistema`) ✅; acumulado por vacina (`por_vacina`) ✅; acumulado por faixa (`por_faixa`) ✅; personas (presets) ✅.
- **PieChart:** `EChart.tsx` só registra Line/Bar; mecanismo de registro usa barra (sem registrar novo tipo) — decisão consciente do plano.
- **Type consistency:** `getResumoDoses`/`getFiltros`, `fetchDosesResumo`/`fetchDosesFiltros`, `VacinaDosesResumo`/`VacinaDosesFiltros` usados de forma idêntica entre tasks.
```
