import { describe, expect, it } from 'vitest';
import type { IndicadorQualidade, Unidade } from '../../types/contrato';
import { buildUnitComparison, buildHistoricoSeries } from './qualidadeView';

const ind = (over: Partial<IndicadorQualidade> = {}): IndicadorQualidade =>
  ({ cod: 'C1', exec: 0.8, meta: 0.6, ...over } as IndicadorQualidade);
const u = (id: number, nome: string, extra: Partial<Unidade> = {}): Unidade =>
  ({ id, nome, status: 'ativo', tipo: 'UBS', ...extra } as Unidade);

describe('buildUnitComparison', () => {
  it('uses porUnidade when present', () => {
    const out = buildUnitComparison(ind({ porUnidade: [{ unidade: 'A', exec: 0.9 }, { unidade: 'B', exec: null }] }), []);
    expect(out.map((r) => r.nome)).toEqual(['A', 'B']);
    expect(out[0].widthPct).toBeGreaterThan(0);
  });

  it('synthetic path: filters inativo/Hospitalar, active unit keeps baseExec', () => {
    const out = buildUnitComparison(
      ind({ exec: 0.5 }),
      [u(1, 'A'), u(2, 'H', { tipo: 'Hospitalar' }), u(3, 'Z', { status: 'inativo' }), u(4, 'B')],
      'A',
    );
    expect(out.map((r) => r.nome)).toEqual(['A', 'B']);
  });

  it('synthetic path with null exec yields null execs', () => {
    const out = buildUnitComparison(ind({ exec: null }), [u(1, 'A')]);
    expect(out[0].execText).toBeDefined();
  });
});

describe('buildHistoricoSeries', () => {
  it('returns provided historico', () => {
    const h = [{ competencia: '2026-01', exec: 0.5 }];
    expect(buildHistoricoSeries(ind({ historico: h }))).toBe(h);
  });
  it('empty when exec null and no historico', () => {
    expect(buildHistoricoSeries(ind({ exec: null }))).toEqual([]);
  });
  it('synthesizes 12 months otherwise, clamped 0..1', () => {
    const out = buildHistoricoSeries(ind({ exec: 0.8 }));
    expect(out).toHaveLength(12);
    expect(out.every((p) => p.exec! >= 0 && p.exec! <= 1)).toBe(true);
  });
});
