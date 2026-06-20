import { describe, expect, it } from 'vitest';
import { computeDelta, EM_DASH, formatKpi, formatPercent } from './kpi';

describe('kpi utils', () => {
  it('formatKpi(null) returns em dash', () => {
    expect(formatKpi(null)).toBe(EM_DASH);
    expect(formatKpi(undefined)).toBe(EM_DASH);
  });

  it('formatKpi formats numeric values in pt-BR', () => {
    expect(formatKpi(540)).toBe('540');
    expect(formatKpi(1426)).toBe('1.426');
  });

  it('formatPercent renders null as em dash', () => {
    expect(formatPercent(null)).toBe(EM_DASH);
    expect(formatPercent(0.784)).toBe('78,4%');
  });

  it('computeDelta compares current and previous values', () => {
    expect(computeDelta(540, 515).direction).toBe('up');
    expect(computeDelta(500, 515).direction).toBe('down');
    expect(computeDelta(540, 0).label).toBe('—');
    expect(computeDelta(540, 540).direction).toBe('flat');
  });
});
