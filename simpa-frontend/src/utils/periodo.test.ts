import { describe, expect, it } from 'vitest';
import {
  periodoTipo,
  periodoFimCompetencia,
  formatPeriodoLabel,
  buildPeriodoValues,
} from './periodo';

describe('periodo (frontend)', () => {
  it('periodoTipo detecta grão', () => {
    expect(periodoTipo('2026-05')).toBe('mes');
    expect(periodoTipo('2026-T2')).toBe('trimestre');
    expect(periodoTipo('2026-Q3')).toBe('quadrimestre');
    expect(periodoTipo('2026')).toBe('ano');
  });

  it('periodoFimCompetencia devolve o mês final', () => {
    expect(periodoFimCompetencia('2026-05')).toBe('2026-05');
    expect(periodoFimCompetencia('2026-T2')).toBe('2026-06');
    expect(periodoFimCompetencia('2026-Q2')).toBe('2026-08');
    expect(periodoFimCompetencia('2026')).toBe('2026-12');
  });

  it('formatPeriodoLabel formata legível', () => {
    expect(formatPeriodoLabel('2026-T1')).toBe('1º trim · 2026');
    expect(formatPeriodoLabel('2026-Q3')).toBe('3º quad · 2026');
    expect(formatPeriodoLabel('2026')).toBe('Ano 2026');
    expect(formatPeriodoLabel('2026-05')).toBe('2026-05');
  });

  it('buildPeriodoValues gera opções por grão', () => {
    const comps = ['2026-05', '2026-04', '2025-11'];
    expect(buildPeriodoValues(comps, 'mes')).toEqual(comps);
    expect(buildPeriodoValues(comps, 'ano')).toEqual(['2026', '2025']);
    expect(buildPeriodoValues(comps, 'trimestre')).toEqual([
      '2026-T4', '2026-T3', '2026-T2', '2026-T1',
      '2025-T4', '2025-T3', '2025-T2', '2025-T1',
    ]);
    expect(buildPeriodoValues(comps, 'quadrimestre')).toEqual([
      '2026-Q3', '2026-Q2', '2026-Q1',
      '2025-Q3', '2025-Q2', '2025-Q1',
    ]);
  });
});
